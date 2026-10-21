import { ConfigService } from '@nestjs/config';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../../database/prisma.service';
import { CustomerAuthProviders } from './customer-auth.providers';
import { CustomerAuthService, normalizeAccountPhone, tokenHash } from './customer-auth.service';

const site = 'https://grqaser.digitalize.am';
const request = (headers: Record<string, string | undefined> = {}) => ({ headers, ip: '127.0.0.1' }) as unknown as FastifyRequest;
function fixture() {
  const prisma = {
    isPostgres: true,
    customer: { upsert: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
    customerSession: { create: jest.fn(), findUnique: jest.fn(), deleteMany: jest.fn() },
    customerAuthRate: { upsert: jest.fn().mockResolvedValue({ count: 1 }) },
    customerChallenge: { findUnique: jest.fn(), updateMany: jest.fn() },
    customerOAuthFlow: { findUnique: jest.fn(), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const client = { getToken: jest.fn().mockResolvedValue({ tokens: { id_token: 'signed-id-token' } }), verifyIdToken: jest.fn() };
  const providers = { site, smsEnabled: true, googleEnabled: true, sendCode: jest.fn(), verifyCode: jest.fn(), googleClient: () => client };
  const auth = new CustomerAuthService(prisma as unknown as PrismaService, providers as unknown as CustomerAuthProviders,
    new ConfigService({ NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com' }));
  return { auth, prisma, providers, client };
}
describe('Customer account authentication boundaries', () => {
  it('normalizes Armenian numbers and rejects foreign, malformed and injected values', () => {
    for (const phone of ['99 123456', '099123456', '+374 (99) 123456', '37499123456']) expect(normalizeAccountPhone(phone)).toBe('+37499123456');
    for (const phone of ['++37499123456', '+79991234567', 'abc99123456', '374+99123456', '99123', '']) expect(() => normalizeAccountPhone(phone)).toThrow();
  });
  it('requires a same-origin mutation and the custom browser header', () => {
    const { auth } = fixture();
    expect(() => auth.assertMutation(request({ origin: site, 'x-grqaser-client': 'storefront' }))).not.toThrow();
    for (const headers of [{ origin: site }, { origin: 'https://attacker.example', 'x-grqaser-client': 'storefront' }, { 'x-grqaser-client': 'storefront' }]) expect(() => auth.assertMutation(request(headers))).toThrow();
  });
  it('stores only a session hash and issues a host-only HttpOnly secure cookie', async () => {
    const { auth, prisma } = fixture();
    const cookie = await auth.session('customer-1');
    const token = cookie.split(';')[0]!.split('=')[1]!;
    expect(token).toHaveLength(43);
    expect(cookie).toContain('__Host-grqaser_session=');
    expect(cookie).toContain('HttpOnly; SameSite=Lax; Max-Age=2592000; Secure');
    expect(cookie).not.toContain('Domain=');
    expect(prisma.customerSession.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tokenHash: tokenHash(token), customerId: 'customer-1' }) });
    expect(JSON.stringify(prisma.customerSession.create.mock.calls)).not.toContain(token);
  });
  it('rejects expired sessions and never queries storage for malformed cookies', async () => {
    const { auth, prisma } = fixture();
    expect(await auth.identity(request({ cookie: '__Host-grqaser_session=bad' }))).toBeNull();
    expect(prisma.customerSession.findUnique).not.toHaveBeenCalled();
    prisma.customerSession.findUnique.mockResolvedValue({ customer: { id: 'secret' }, expiresAt: new Date(0) });
    expect(await auth.identity(request({ cookie: '__Host-grqaser_session=' + 'a'.repeat(43) }))).toBeNull();
  });
  it('expired codes and exhausted attempt budgets cannot reach the SMS provider', async () => {
    const { auth, prisma, providers } = fixture();
    prisma.customerChallenge.findUnique.mockResolvedValue({ phone: '+37499123456', expiresAt: new Date(0) });
    await expect(auth.verifyCode('challenge', '123456', request())).rejects.toThrow();
    prisma.customerChallenge.findUnique.mockResolvedValue({ phone: '+37499123456', expiresAt: new Date(Date.now() + 60_000) });
    prisma.customerChallenge.updateMany.mockResolvedValue({ count: 0 });
    await expect(auth.verifyCode('challenge', '123456', request())).rejects.toThrow();
    expect(providers.verifyCode).not.toHaveBeenCalled();
    expect(prisma.customerSession.create).not.toHaveBeenCalled();
  });
  it('a wrong code consumes an attempt and cannot create a session', async () => {
    const { auth, prisma, providers } = fixture();
    prisma.customerChallenge.findUnique.mockResolvedValue({ phone: '+37499123456', expiresAt: new Date(Date.now() + 60_000) });
    prisma.customerChallenge.updateMany.mockResolvedValue({ count: 1 });
    providers.verifyCode.mockResolvedValue(false);
    await expect(auth.verifyCode('challenge', '999999', request())).rejects.toThrow();
    expect(prisma.customerChallenge.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ attempts: { lt: 5 }, consumedAt: null }) }));
    expect(prisma.customerSession.create).not.toHaveBeenCalled();
  });
  it('an approval already consumed by another request cannot be replayed', async () => {
    const { auth, prisma, providers } = fixture();
    prisma.customerChallenge.findUnique.mockResolvedValue({ phone: '+37499123456', expiresAt: new Date(Date.now() + 60_000) });
    prisma.customerChallenge.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    providers.verifyCode.mockResolvedValue(true);
    await expect(auth.verifyCode('challenge', '123456', request())).rejects.toThrow();
    expect(prisma.customer.upsert).not.toHaveBeenCalled();
    expect(prisma.customerSession.create).not.toHaveBeenCalled();
  });
  it('rejects a Google callback without the browser state cookie before exchanging its code', async () => {
    const { auth, client } = fixture();
    await expect(auth.googleFinish('code', 'a'.repeat(43), request())).rejects.toThrow();
    expect(client.getToken).not.toHaveBeenCalled();
  });
  it('checks Google token nonce before touching a customer identity', async () => {
    const { auth, prisma, client } = fixture();
    const state = 'a'.repeat(43);
    prisma.customerOAuthFlow.findUnique.mockResolvedValue({ stateHash: tokenHash(state), expiresAt: new Date(Date.now() + 60_000), nonce: 'expected', codeVerifier: 'pkce', locale: 'hy' });
    client.verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: 'google-user', email: 'reader@example.test', email_verified: true, nonce: 'wrong' }) });
    await expect(auth.googleFinish('code', state, request({ cookie: '__Host-grqaser_oauth=' + state }))).rejects.toThrow();
    expect(client.getToken).toHaveBeenCalledWith({ code: 'code', codeVerifier: 'pkce' });
    expect(client.verifyIdToken).toHaveBeenCalledWith({ idToken: 'signed-id-token', audience: 'client.apps.googleusercontent.com' });
    expect(prisma.customer.findUnique).not.toHaveBeenCalled();
    expect(prisma.customerSession.create).not.toHaveBeenCalled();
  });
});
