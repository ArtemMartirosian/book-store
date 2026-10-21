import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Customer, Prisma } from '@prisma/client';
import { isEmail } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { CustomerAuthProviders } from './customer-auth.providers';
import { assertNewPassword, assertPasswordInput, hashCustomerPassword, verifyCustomerPassword } from './customer-password';

export function normalizeAccountEmail(value: string): string {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[\x21-\x7e]+$/u.test(email) || !isEmail(email, { allow_utf8_local_part: false })) {
    throw new BadRequestException({ code: 'INVALID_EMAIL' });
  }
  return email;
}

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
  private nextCleanupAt = 0;
  constructor(readonly prisma: PrismaService, readonly providers: CustomerAuthProviders, private readonly config: ConfigService) {}

  get secure(): boolean { return this.config.get('NODE_ENV') === 'production'; }
  get cookieName(): string { return this.secure ? '__Host-grqaser_session' : 'grqaser_session'; }
  get flowCookieName(): string { return this.secure ? '__Host-grqaser_oauth' : 'grqaser_oauth'; }
  cookie(name: string, value: string, maxAge: number): string {
    return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${this.secure ? '; Secure' : ''}`;
  }
  publicCustomer(customer: Customer) {
    return { id: customer.id, fullName: customer.fullName, email: customer.email ?? null, passwordEnabled: Boolean(customer.passwordHash), emailVerified: false,
      phone: customer.phone, googleEmail: customer.googleEmail,
      googleConnected: Boolean(customer.googleSubject), locale: customer.locale, createdAt: customer.createdAt.toISOString() };
  }
  configuration() {
    return { passwordEnabled: this.prisma.isPostgres, smsEnabled: false,
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
  private async passwordLimits(kind: 'register' | 'login' | 'password', email: string, ip: string): Promise<void> {
    if (Date.now() >= this.nextCleanupAt) {
      this.nextCleanupAt = Date.now() + 60_000;
      // Expired rows must also be maintained when all authentication attempts fail.
      try { await this.cleanup(); } catch { /* Retry on a later request; never log credentials. */ }
    }
    if (kind === 'register') {
      await this.limit('register-global', 100, 3600);
      await this.limit('register-global', 500, 86400);
      await this.limit('register-ip:' + ip, 10, 3600);
      await this.limit('register-email:' + email, 3, 3600);
    } else {
      await this.limit('password-kdf-global', 300, 60);
      await this.limit(kind + '-ip:' + ip, 30, 900);
      await this.limit(kind + '-identity:' + email, 10, 900);
    }
  }
  private async safeAuthentication<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof HttpException) throw error;
      // Prisma invocation errors can include write data, including password hashes.
      throw new ServiceUnavailableException({ code: 'ACCOUNT_UNAVAILABLE' });
    }
  }
  private async transactionalSession(tx: Prisma.TransactionClient, customerId: string, request: FastifyRequest, all = false): Promise<string> {
    const previous = readCookie(request, this.cookieName);
    if (all) await tx.customerSession.deleteMany({ where: { customerId } });
    else if (previous) await tx.customerSession.deleteMany({ where: { tokenHash: tokenHash(previous) } });
    const token = randomBytes(32).toString('base64url');
    await tx.customerSession.create({ data: { tokenHash: tokenHash(token), customerId, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
    return this.cookie(this.cookieName, token, 30 * 86400);
  }
  async register(input: { email: string; password: string; fullName: string; locale: string }, request: FastifyRequest) {
    return this.safeAuthentication(async () => {
      this.assertStorage();
      const email = normalizeAccountEmail(input.email);
      assertNewPassword(input.password);
      const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
      if (!['hy', 'ru', 'en'].includes(input.locale) || [...fullName].length < 2 || [...fullName].length > 100) {
        throw new BadRequestException({ code: 'INVALID_PROFILE' });
      }
      await this.passwordLimits('register', email, request.ip);
      const passwordHash = await hashCustomerPassword(input.password);
      try {
        return await this.prisma.$transaction(async tx => {
          const customer = await tx.customer.create({ data: { email, passwordHash, fullName, locale: input.locale } });
          const cookie = await this.transactionalSession(tx, customer.id, request);
          return { customer, cookie };
        });
      } catch (error) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
          throw new ConflictException({ code: 'EMAIL_ALREADY_REGISTERED' });
        }
        throw error;
      }
    });
  }
  async login(input: { email: string; password: string }, request: FastifyRequest) {
    return this.safeAuthentication(async () => {
      this.assertStorage();
      const email = normalizeAccountEmail(input.email);
      assertPasswordInput(input.password);
      await this.passwordLimits('login', email, request.ip);
      const customer = await this.prisma.customer.findUnique({ where: { email } });
      const valid = await verifyCustomerPassword(input.password, customer?.passwordHash);
      if (!customer?.passwordHash || !valid) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
      return this.prisma.$transaction(async tx => {
        // A no-op conditional UPDATE takes the customer row lock. Password changes
        // use the same lock, preventing a verified old password creating a late session.
        const locked = await tx.customer.updateMany({ where: { id: customer.id, passwordHash: customer.passwordHash }, data: { passwordHash: customer.passwordHash } });
        if (locked.count !== 1) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
        return { customer, cookie: await this.transactionalSession(tx, customer.id, request) };
      });
    });
  }
  async changePassword(input: { currentPassword: string; newPassword: string }, request: FastifyRequest) {
    return this.safeAuthentication(async () => {
      this.assertStorage();
      const customer = await this.requireIdentity(request);
      assertPasswordInput(input.currentPassword); assertNewPassword(input.newPassword);
      await this.passwordLimits('password', customer.id, request.ip);
      const valid = await verifyCustomerPassword(input.currentPassword, customer.passwordHash);
      if (!customer.passwordHash || !valid) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
      const passwordHash = await hashCustomerPassword(input.newPassword);
      return this.prisma.$transaction(async tx => {
        const changed = await tx.customer.updateMany({ where: { id: customer.id, passwordHash: customer.passwordHash }, data: { passwordHash } });
        if (changed.count !== 1) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
        const cookie = await this.transactionalSession(tx, customer.id, request, true);
        return { customer: { ...customer, passwordHash }, cookie };
      });
    });
  }
  async requestCode(_phoneInput: string, _locale: string, _ip: string, _customerId?: string): Promise<never> {
    throw new ServiceUnavailableException({ code: 'SMS_UNAVAILABLE' });
  }
  async verifyCode(_challengeId: string, _code: string, _request: FastifyRequest): Promise<never> {
    throw new ServiceUnavailableException({ code: 'SMS_UNAVAILABLE' });
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
    const cutoff = new Date();
    await Promise.all([
      this.prisma.customerAuthRate.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.customerChallenge.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.customerOAuthFlow.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.customerSession.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
  }
}
