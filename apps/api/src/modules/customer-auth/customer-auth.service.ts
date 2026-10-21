import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Customer } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { CustomerAuthProviders } from './customer-auth.providers';

export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function normalizeAccountPhone(value: string): string {
  if (!/^[+\d\s()-]+$/u.test(value)) throw new BadRequestException({ code: 'INVALID_PHONE' });
  let phone = value.replace(/[\s()-]/gu, '');
  if (/^0\d{8}$/u.test(phone)) phone = phone.slice(1);
  if (/^\d{8}$/u.test(phone)) phone = '+374' + phone;
  if (/^374\d{8}$/u.test(phone)) phone = '+' + phone;
  if (!/^\+374\d{8}$/u.test(phone)) throw new BadRequestException({ code: 'INVALID_PHONE' });
  return phone;
}

export function readCookie(request: FastifyRequest, name: string): string | undefined {
  const pair = request.headers.cookie?.split(';').find(value => value.trim().startsWith(name + '='));
  const value = pair?.trim().slice(name.length + 1);
  return value && /^[A-Za-z0-9_-]{40,128}$/u.test(value) ? value : undefined;
}

@Injectable()
export class CustomerAuthService {
  constructor(readonly prisma: PrismaService, readonly providers: CustomerAuthProviders, private readonly config: ConfigService) {}

  get secure(): boolean { return this.config.get('NODE_ENV') === 'production'; }
  get cookieName(): string { return this.secure ? '__Host-grqaser_session' : 'grqaser_session'; }
  get flowCookieName(): string { return this.secure ? '__Host-grqaser_oauth' : 'grqaser_oauth'; }
  cookie(name: string, value: string, maxAge: number): string {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.secure ? '; Secure' : ''}`;
  }
  publicCustomer(customer: Customer) {
    return { id: customer.id, fullName: customer.fullName, phone: customer.phone, googleEmail: customer.googleEmail,
      googleConnected: Boolean(customer.googleSubject), locale: customer.locale, createdAt: customer.createdAt.toISOString() };
  }
  configuration() {
    return { smsEnabled: this.prisma.isPostgres && this.providers.smsEnabled,
      googleEnabled: this.prisma.isPostgres && this.providers.googleEnabled, codeLength: 6, resendAfterSeconds: 60 };
  }
  assertStorage(): void {
    if (!this.prisma.isPostgres) throw new ServiceUnavailableException({ code: 'ACCOUNT_UNAVAILABLE' });
  }
  assertMutation(request: FastifyRequest): void {
    const origin = request.headers.origin;
    if (request.headers['x-grqaser-client'] !== 'storefront' || origin !== this.providers.site) {
      throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED' });
    }
  }
  async identity(request: FastifyRequest): Promise<Customer | null> {
    if (!this.prisma.isPostgres) return null;
    const token = readCookie(request, this.cookieName);
    if (!token) return null;
    const session = await this.prisma.customerSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { customer: true } });
    return session && session.expiresAt > new Date() ? session.customer : null;
  }
  async requireIdentity(request: FastifyRequest): Promise<Customer> {
    const customer = await this.identity(request);
    if (!customer) throw new UnauthorizedException({ code: 'LOGIN_REQUIRED' });
    return customer;
  }
  async session(customerId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.customerSession.create({ data: { tokenHash: tokenHash(token), customerId, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
    return this.cookie(this.cookieName, token, 30 * 86400);
  }
  async logout(request: FastifyRequest, all = false): Promise<void> {
    const token = readCookie(request, this.cookieName);
    if (!this.prisma.isPostgres || !token) return;
    if (all) {
      const customer = await this.requireIdentity(request);
      await this.prisma.customerSession.deleteMany({ where: { customerId: customer.id } });
    } else await this.prisma.customerSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
  }
  async limit(key: string, maximum: number, seconds: number): Promise<void> {
    const bucket = Math.floor(Date.now() / (seconds * 1000));
    const count = await this.prisma.customerAuthRate.upsert({
      where: { key: tokenHash(key) + ':' + seconds + ':' + bucket },
      create: { key: tokenHash(key) + ':' + seconds + ':' + bucket, expiresAt: new Date((bucket + 2) * seconds * 1000) },
      update: { count: { increment: 1 } },
    });
    if (count.count > maximum) throw new HttpException({ code: 'TOO_MANY_ATTEMPTS', retryAfterSeconds: seconds }, 429);
  }
  async requestCode(phoneInput: string, locale: string, ip: string, customerId?: string) {
    this.assertStorage();
    if (!this.providers.smsEnabled) throw new ServiceUnavailableException({ code: 'SMS_UNAVAILABLE' });
    const phone = normalizeAccountPhone(phoneInput);
    await this.limit('sms-ip:' + ip, 10, 3600);
    await this.limit('sms-phone:' + phone, 1, 60);
    await this.limit('sms-phone:' + phone, 5, 86400);
    await this.limit('sms-global', 100, 86400);
    await this.providers.sendCode(phone, locale);
    // A new code invalidates earlier challenges for this number, including other tabs.
    await this.prisma.customerChallenge.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: new Date() } });
    const challenge = await this.prisma.customerChallenge.create({ data: { phone, customerId, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    await this.cleanup();
    return { challengeId: challenge.id, phone, expiresAt: challenge.expiresAt.toISOString(), resendAfterSeconds: 60 };
  }
  async verifyCode(challengeId: string, code: string, request: FastifyRequest) {
    this.assertStorage();
    await this.limit('verify-ip:' + request.ip, 30, 900);
    const challenge = await this.prisma.customerChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) throw new BadRequestException({ code: 'CODE_EXPIRED' });
    if (challenge.customerId && (await this.requireIdentity(request)).id !== challenge.customerId) throw new ForbiddenException();
    const attempt = await this.prisma.customerChallenge.updateMany({
      where: { id: challengeId, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } },
    });
    if (!attempt.count) throw new BadRequestException({ code: 'CODE_EXPIRED' });
    if (!await this.providers.verifyCode(challenge.phone, code)) throw new BadRequestException({ code: 'CODE_INVALID' });
    const used = await this.prisma.customerChallenge.updateMany({ where: { id: challengeId, consumedAt: null }, data: { consumedAt: new Date() } });
    if (!used.count) throw new BadRequestException({ code: 'CODE_EXPIRED' });
    const owner = await this.prisma.customer.findUnique({ where: { phone: challenge.phone } });
    if (challenge.customerId && owner && owner.id !== challenge.customerId) throw new ConflictException({ code: 'IDENTITY_ALREADY_LINKED' });
    const customer = challenge.customerId
      ? await this.prisma.customer.update({ where: { id: challenge.customerId }, data: { phone: challenge.phone } })
      : await this.prisma.customer.upsert({ where: { phone: challenge.phone }, create: { phone: challenge.phone }, update: {} });
    return { customer, cookie: await this.session(customer.id) };
  }
  async googleStart(locale: string, ip: string, customerId?: string) {
    this.assertStorage();
    await this.limit('google-ip:' + ip, 20, 900);
    const client = this.providers.googleClient();
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    await this.prisma.customerOAuthFlow.create({ data: { stateHash: tokenHash(state), codeVerifier, nonce, locale, customerId, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    return { url: client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce,
      code_challenge: codeChallenge, code_challenge_method: 'S256' as never, prompt: 'select_account' }),
      cookie: this.cookie(this.flowCookieName, state, 600) };
  }
  async googleFinish(code: string, state: string, request: FastifyRequest) {
    this.assertStorage();
    if (!/^[A-Za-z0-9_-]{43}$/u.test(state) || readCookie(request, this.flowCookieName) !== state) throw new BadRequestException();
    const flow = await this.prisma.customerOAuthFlow.findUnique({ where: { stateHash: tokenHash(state) } });
    if (!flow || flow.expiresAt <= new Date()) throw new BadRequestException();
    const claimed = await this.prisma.customerOAuthFlow.deleteMany({ where: { stateHash: flow.stateHash } });
    if (claimed.count !== 1) throw new BadRequestException();
    if (flow.customerId && (await this.requireIdentity(request)).id !== flow.customerId) throw new ForbiddenException();
    const client = this.providers.googleClient();
    const { tokens } = await client.getToken({ code, codeVerifier: flow.codeVerifier });
    if (!tokens.id_token) throw new BadRequestException();
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: this.config.get<string>('GOOGLE_CLIENT_ID') });
    const claims = ticket.getPayload();
    if (!claims?.sub || claims.nonce !== flow.nonce || !claims.email_verified || !claims.email) throw new BadRequestException();
    const owner = await this.prisma.customer.findUnique({ where: { googleSubject: claims.sub } });
    if (flow.customerId && owner && owner.id !== flow.customerId) throw new ConflictException({ code: 'IDENTITY_ALREADY_LINKED' });
    // Identity is Google's immutable subject; matching email addresses never merge accounts.
    const customer = flow.customerId
      ? await this.prisma.customer.update({ where: { id: flow.customerId }, data: { googleSubject: claims.sub, googleEmail: claims.email.slice(0, 254) } })
      : await this.prisma.customer.upsert({ where: { googleSubject: claims.sub },
        create: { googleSubject: claims.sub, googleEmail: claims.email.slice(0, 254), fullName: (claims.name ?? '').slice(0, 100), locale: flow.locale },
        update: { googleEmail: claims.email.slice(0, 254) } });
    await this.cleanup();
    return { customer, locale: flow.locale, cookie: await this.session(customer.id) };
  }
  private async cleanup() {
    const cutoff = new Date(Date.now() - 86400_000);
    await Promise.all([
      this.prisma.customerAuthRate.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.customerChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.customerOAuthFlow.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.customerSession.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
  }
}
