import { ConfigService } from '@nestjs/config';
import type { Customer } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../database/prisma.service';
import { CustomerAuthProviders } from './customer-auth.providers';
import { CustomerLoginDto, CustomerPasswordDto, CustomerRegisterDto } from './customer-auth.dto';
import { CustomerAuthService, normalizeAccountEmail, tokenHash } from './customer-auth.service';
import { assertNewPassword, assertPasswordInput, hashCustomerPassword, verifyCustomerPassword } from './customer-password';

const password = 'My bookstore passphrase 2026';
const nextPassword = 'N3xt📚!';
let passwordHash: string;
beforeAll(async () => { passwordHash = await hashCustomerPassword(password); });
const request = (cookie?: string) => ({ headers: cookie ? { cookie } : {}, ip: '192.0.2.10' }) as unknown as FastifyRequest;
function fixture() {
  const customer: Customer = { id: 'a23fb0c4-689b-4a29-af89-067be66dc309', email: 'reader@example.test', passwordHash, fullName: 'Reader',
    phone: null, googleSubject: null, googleEmail: null, locale: 'hy', createdAt: new Date(), updatedAt: new Date() };
  const prisma = {
    isPostgres: true,
    customer: { findUnique: jest.fn().mockResolvedValue(customer), create: jest.fn().mockImplementation(({ data }: { data: object }) => ({ ...customer, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }), upsert: jest.fn() },
    customerSession: { create: jest.fn(), findUnique: jest.fn().mockResolvedValue({ customer, expiresAt: new Date(Date.now() + 60_000) }), deleteMany: jest.fn() },
    customerAuthRate: { upsert: jest.fn().mockResolvedValue({ count: 1 }), deleteMany: jest.fn() },
    customerChallenge: { deleteMany: jest.fn() }, customerOAuthFlow: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  const providers = { site: 'https://grqaser.digitalize.am', smsEnabled: true, googleEnabled: false, sendCode: jest.fn() };
  const auth = new CustomerAuthService(prisma as unknown as PrismaService, providers as unknown as CustomerAuthProviders, new ConfigService({ NODE_ENV: 'production' }));
  return { auth, prisma, providers, customer };
}
describe('Password-based customer accounts', () => {
  it('normalizes email without merging aliases, and rejects invalid input', () => {
    expect(normalizeAccountEmail(' Reader+books@Example.test ')).toBe('reader+books@example.test');
    for (const input of ['a', 'a@@example.test', 'r\n@example.test', 'имя@example.test', 'x'.repeat(255) + '@example.test']) expect(() => normalizeAccountEmail(input)).toThrow();
  });
  it('DTOs normalize identifiers, never trim passwords, and require six characters only for new passwords', async () => {
    const login = plainToInstance(CustomerLoginDto, { email: ' Reader@Example.test ', password: '  keep whitespace  ' });
    expect(login.email).toBe('reader@example.test'); expect(login.password).toBe('  keep whitespace  '); expect(await validate(login)).toEqual([]);
    expect((await validate(plainToInstance(CustomerLoginDto, { email: 'bad', password: '' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CustomerRegisterDto, { email: 'reader@example.test', password, fullName: 'Reader', locale: 'xx' }))).length).toBeGreaterThan(0);
    expect((await validate(plainToInstance(CustomerPasswordDto, { currentPassword: password, newPassword: 'short' }))).length).toBeGreaterThan(0);
    for (const secret of ['123456', '📚📚📚📚📚📚', 'passwordpassword', 'x'.repeat(129)]) {
      expect(await validate(plainToInstance(CustomerRegisterDto, { email: 'reader@example.test', password: secret, fullName: 'Reader' }))).toEqual([]);
      expect(await validate(plainToInstance(CustomerPasswordDto, { currentPassword: secret, newPassword: secret }))).toEqual([]);
      expect(await validate(plainToInstance(CustomerLoginDto, { email: 'reader@example.test', password: secret }))).toEqual([]);
    }
    for (const secret of ['', '12345', '📚📚📚📚📚']) {
      expect((await validate(plainToInstance(CustomerRegisterDto, { email: 'reader@example.test', password: secret, fullName: 'Reader' }))).length).toBeGreaterThan(0);
      expect((await validate(plainToInstance(CustomerPasswordDto, { currentPassword: password, newPassword: secret }))).length).toBeGreaterThan(0);
    }
    expect(await validate(plainToInstance(CustomerLoginDto, { email: 'reader@example.test', password: 'x' }))).toEqual([]);
    expect(await validate(plainToInstance(CustomerPasswordDto, { currentPassword: 'x', newPassword: nextPassword }))).toEqual([]);
    expect((await validate(plainToInstance(CustomerPasswordDto, { currentPassword: '', newPassword: nextPassword }))).length).toBeGreaterThan(0);
  });
  it('requires a nonempty login input and at least six Unicode characters for new passwords without a blocklist or maximum', () => {
    for (const secret of ['', '12345', '📚📚📚📚📚']) expect(() => assertNewPassword(secret)).toThrow();
    for (const secret of ['123456', '📚📚📚📚📚📚', 'passwordpassword', 'x'.repeat(1024)]) expect(() => assertNewPassword(secret)).not.toThrow();
    expect(() => assertPasswordInput('x')).not.toThrow();
    expect(() => assertPasswordInput('x'.repeat(1024))).not.toThrow();
    expect(() => assertPasswordInput('')).toThrow();
  });
  it('uses unique salts and verifies a versioned slow hash without trimming Unicode secrets', async () => {
    const unicode = '  Հայերեն գաղտնի արտահայտություն 📚  ';
    const first = await hashCustomerPassword(unicode), second = await hashCustomerPassword(unicode);
    expect(first).toMatch(/^scrypt\$1\$32768\$8\$3\$/u); expect(first).not.toBe(second); expect(first).not.toContain(unicode);
    expect(await verifyCustomerPassword(unicode, first)).toBe(true);
    expect(await verifyCustomerPassword(unicode.trim(), first)).toBe(false);
    expect(await verifyCustomerPassword(password, 'scrypt$1$999999999$8$3$bad')).toBe(false);
    await expect(hashCustomerPassword('short')).rejects.toThrow();
  });
  it('hashes common and longer-than-128-character passwords without truncation', async () => {
    const commonHash = await hashCustomerPassword('passwordpassword');
    expect(await verifyCustomerPassword('passwordpassword', commonHash)).toBe(true);
    const prefix = 'x'.repeat(128), longPassword = prefix + 'Հայերեն📚';
    const longHash = await hashCustomerPassword(longPassword);
    expect(await verifyCustomerPassword(longPassword, longHash)).toBe(true);
    expect(await verifyCustomerPassword(prefix, longHash)).toBe(false);
    expect(await verifyCustomerPassword(longPassword + '!', longHash)).toBe(false);
  }, 15_000);
  it('bounds expensive concurrent derivations without an unbounded queue', async () => {
    const results = await Promise.allSettled([hashCustomerPassword(password), hashCustomerPassword(password), hashCustomerPassword(password)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(failure.reason.getStatus()).toBe(429); expect(failure.reason.getResponse()).toMatchObject({ code: 'HASH_BUSY' });
  });
  it('registers immediately and exposes no password/hash or verified-email claim', async () => {
    const { auth, prisma, providers } = fixture();
    const registrationPassword = '123456';
    const result = await auth.register({ email: ' New@Example.test ', password: registrationPassword, fullName: 'New Reader', locale: 'ru' }, request());
    expect(prisma.customer.create).toHaveBeenCalledWith({ data: expect.objectContaining({ email: 'new@example.test', fullName: 'New Reader', locale: 'ru' }) });
    const saved = prisma.customer.create.mock.calls[0]![0]!.data as { passwordHash: string };
    expect(await verifyCustomerPassword(registrationPassword, saved.passwordHash)).toBe(true);
    expect(result.cookie).toContain('__Host-grqaser_session=');
    const visible = auth.publicCustomer(result.customer);
    expect(visible).toMatchObject({ email: 'new@example.test', passwordEnabled: true, emailVerified: false });
    expect(JSON.stringify(visible)).not.toContain('passwordHash'); expect(JSON.stringify(visible)).not.toContain(registrationPassword);
    expect(providers.sendCode).not.toHaveBeenCalled(); expect(prisma.customer.upsert).not.toHaveBeenCalled();
  });
  it('rejects five-character registration passwords before database writes or rate-limit work', async () => {
    const { auth, prisma } = fixture();
    await expect(auth.register({ email: 'reader@example.test', password: '12345', fullName: 'Reader', locale: 'hy' }, request())).rejects.toMatchObject({ status: 400, response: { code: 'WEAK_PASSWORD' } });
    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.customerAuthRate.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('returns the same generic response for absent identities and a wrong password', async () => {
    const { auth, prisma } = fixture(); const responses = [];
    for (const absent of [true, false]) {
      if (absent) prisma.customer.findUnique.mockResolvedValueOnce(null);
      try { await auth.login({ email: 'reader@example.test', password: 'wrong but long enough' }, request()); } catch (error) {
        const failure = error as { getStatus(): number; getResponse(): unknown };
        expect(failure.getStatus()).toBe(401); responses.push(failure.getResponse());
      }
    }
    expect(responses).toEqual([{ code: 'INVALID_CREDENTIALS' }, { code: 'INVALID_CREDENTIALS' }]);
    expect(prisma.customerSession.create).not.toHaveBeenCalled();
  });
  it('enforces global and durable identifier/IP limits before credential reads or hashing', async () => {
    const { auth, prisma } = fixture(); prisma.customerAuthRate.upsert.mockResolvedValue({ count: 999 });
    await expect(auth.login({ email: 'reader@example.test', password }, request())).rejects.toMatchObject({ status: 429 });
    expect(prisma.customer.findUnique).not.toHaveBeenCalled(); expect(prisma.customerSession.create).not.toHaveBeenCalled();
    expect(prisma.customerAuthRate.deleteMany).toHaveBeenCalled();
  });
  it('translates duplicate races and unexpected DB errors without retaining secret causes', async () => {
    const { auth, prisma } = fixture();
    prisma.customer.create.mockRejectedValueOnce({ code: 'P2002', message: 'SECRET_HASH write collision' });
    await expect(auth.register({ email: 'reader@example.test', password, fullName: 'Reader', locale: 'hy' }, request())).rejects.toMatchObject({ status: 409 });
    prisma.customer.create.mockRejectedValueOnce(new Error('SECRET_HASH database invocation data'));
    await expect(auth.register({ email: 'reader@example.test', password, fullName: 'Reader', locale: 'hy' }, request())).rejects.toMatchObject({ status: 503, message: 'Service Unavailable Exception' });
  });
  it('locks the verified password version before creating a session and only rotates the current browser session', async () => {
    const { auth, prisma, customer } = fixture(); const oldToken = 'z'.repeat(43);
    const result = await auth.login({ email: customer.email!, password }, request('__Host-grqaser_session=' + oldToken));
    expect(prisma.customer.updateMany).toHaveBeenCalledWith({ where: { id: customer.id, passwordHash }, data: { passwordHash } });
    expect(prisma.customerSession.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: tokenHash(oldToken) } });
    expect(result.cookie).not.toContain(oldToken);
  });
  it('rejects an old verified hash that changed before transaction serialization', async () => {
    const { auth, prisma } = fixture(); prisma.customer.updateMany.mockResolvedValue({ count: 0 });
    await expect(auth.login({ email: 'reader@example.test', password }, request())).rejects.toMatchObject({ status: 401 });
    expect(prisma.customerSession.create).not.toHaveBeenCalled();
  });
  it('requires the current password, changes it atomically and revokes all sessions before issuing a fresh one', async () => {
    const { auth, prisma, customer } = fixture(); const req = request('__Host-grqaser_session=' + 'z'.repeat(43));
    await expect(auth.changePassword({ currentPassword: password, newPassword: '12345' }, req)).rejects.toMatchObject({ status: 400, response: { code: 'WEAK_PASSWORD' } });
    expect(prisma.customerAuthRate.upsert).not.toHaveBeenCalled();
    await expect(auth.changePassword({ currentPassword: 'incorrect secret', newPassword: nextPassword }, req)).rejects.toMatchObject({ status: 401 });
    expect(prisma.customer.updateMany).not.toHaveBeenCalled();
    const result = await auth.changePassword({ currentPassword: password, newPassword: nextPassword }, req);
    expect(prisma.customer.updateMany).toHaveBeenCalledWith({ where: { id: customer.id, passwordHash }, data: { passwordHash: expect.any(String) } });
    expect(prisma.customerSession.deleteMany).toHaveBeenCalledWith({ where: { customerId: customer.id } });
    expect(await verifyCustomerPassword(nextPassword, result.customer.passwordHash)).toBe(true);
    expect(result.cookie).toContain('HttpOnly');
  });
});
