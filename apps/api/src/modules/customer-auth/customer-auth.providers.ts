import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class CustomerAuthProviders {
  constructor(private readonly config: ConfigService) {}

  get smsEnabled(): boolean {
    return this.config.get('CUSTOMER_SMS_ENABLED') === true &&
      ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_VERIFY_SERVICE_SID'].every(key => Boolean(this.config.get<string>(key)));
  }

  get googleEnabled(): boolean {
    return this.config.get('CUSTOMER_GOOGLE_ENABLED') === true &&
      Boolean(this.config.get<string>('GOOGLE_CLIENT_ID') && this.config.get<string>('GOOGLE_CLIENT_SECRET'));
  }

  get site(): string {
    return new URL(this.config.get<string>('CUSTOMER_SITE_URL', 'http://localhost:3000')).origin;
  }

  googleClient(): OAuth2Client {
    if (!this.googleEnabled) throw new ServiceUnavailableException({ code: 'GOOGLE_UNAVAILABLE' });
    return new OAuth2Client({
      clientId: this.config.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: this.config.get<string>('GOOGLE_CLIENT_SECRET'),
      redirectUri: this.site + '/api/v1/customer/auth/google/callback',
    });
  }

  private async twilio(resource: string, values: Record<string, string>) {
    if (!this.smsEnabled) throw new ServiceUnavailableException({ code: 'SMS_UNAVAILABLE' });
    try {
      const sid = this.config.get<string>('TWILIO_VERIFY_SERVICE_SID')!;
      const credentials = this.config.get<string>('TWILIO_ACCOUNT_SID') + ':' + this.config.get<string>('TWILIO_AUTH_TOKEN');
      const response = await fetch(`https://verify.twilio.com/v2/Services/${encodeURIComponent(sid)}/${resource}`, {
        method: 'POST',
        headers: { Authorization: 'Basic ' + Buffer.from(credentials).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(values), signal: AbortSignal.timeout(10_000),
      });
      const payload = await response.json() as { status?: string };
      if (!response.ok) {
        if (resource === 'VerificationCheck' && [400, 404].includes(response.status)) return false;
        throw new Error('Verification provider did not accept the request');
      }
      return resource === 'Verifications' ? payload.status === 'pending' : payload.status === 'approved';
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      // Provider bodies, credentials and phone numbers must never enter error responses/logs.
      throw new ServiceUnavailableException({ code: 'SMS_UNAVAILABLE' });
    }
  }

  async sendCode(phone: string, locale: string): Promise<void> {
    if (!await this.twilio('Verifications', { To: phone, Channel: 'sms', Locale: locale === 'hy' ? 'en' : locale })) {
      throw new ServiceUnavailableException({ code: 'SMS_UNAVAILABLE' });
    }
  }

  verifyCode(phone: string, code: string): Promise<boolean> {
    return this.twilio('VerificationCheck', { To: phone, Code: code });
  }
}
