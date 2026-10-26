/* Manual real-HTTP PostgreSQL QA. Refuses non-QA schemas and never binds a TCP port. */
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const requireApp = createRequire(process.cwd() + '/package.json');
const connection = new URL(process.env.DATABASE_URL || process.env.LUMI_DATABASE_URL);
const schema = process.env.ACCOUNT_QA_SCHEMA;
if (!schema || !/^qa_accounts_[a-z0-9_]{1,40}$/.test(schema)) throw new Error('An explicitly named isolated QA schema is required');
connection.searchParams.set('schema', schema);
process.env.DATABASE_URL = connection.toString();

const { Module, ValidationPipe } = requireApp('@nestjs/common');
const { NestFactory } = requireApp('@nestjs/core');
const { FastifyAdapter } = requireApp('@nestjs/platform-fastify');
const { ConfigService } = requireApp('@nestjs/config');
const { PrismaService } = requireApp('./dist/database/prisma.service');
const { CustomerAuthService, tokenHash } = requireApp('./dist/modules/customer-auth/customer-auth.service');
const { CustomerAuthController } = requireApp('./dist/modules/customer-auth/customer-auth.controller');
const { CustomersService } = requireApp('./dist/modules/customers/customers.service');
const { CustomersController } = requireApp('./dist/modules/customers/customers.controller');
const { CustomerGuard } = requireApp('./dist/modules/customers/customer.guard');
const { PrismaOrderRepository } = requireApp('./dist/modules/orders/repositories/prisma-order.repository');
const site = 'https://qa.example.test';
const config = new ConfigService({ PERSISTENCE_ADAPTER: 'POSTGRES', DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: 'production' });
const db = new PrismaService(config);
// No real external provider is ever called by this isolated test.
const providers = { site, smsEnabled: true, googleEnabled: false, sendCode: async () => { throw new Error('SMS must never be called'); } };
const auth = new CustomerAuthService(db, providers, config);
const customers = new CustomersService(db);
class QaHttpModule {}
Module({ controllers: [CustomerAuthController, CustomersController], providers: [
 { provide: CustomerAuthService, useValue: auth }, { provide: CustomersService, useValue: customers }, CustomerGuard,
] })(QaHttpModule);
const request = cookie => ({ headers: cookie ? { cookie } : {}, ip: '192.0.2.50' });
const cookieFrom = response => {
 const value = response.headers['set-cookie'];
 const first = Array.isArray(value) ? value[0] : value;
 assert.ok(first, 'successful authentication sets a cookie');
 assert.match(first, /__Host-grqaser_session=.*HttpOnly; SameSite=Lax; Max-Age=2592000; Secure/u);
 assert.ok(!first.includes('Domain='));
 return first.split(';')[0];
};
const checks = [];
let app;
(async () => {
 try {
  execFileSync(process.execPath, [requireApp.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit' });
  await db.ping();
  app = await NestFactory.create(QaHttpModule, new FastifyAdapter(), { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true,
    transformOptions: { enableImplicitConversion: false }, validationError: { target: false, value: false } }));
  await app.init();
  const http = app.getHttpAdapter().getInstance();
  await http.ready();
  const call = (method, path, payload, cookie, additionalHeaders = {}) => http.inject({
   method, url: '/api/v1/customer/' + path, payload,
   headers: { origin: site, 'x-grqaser-client': 'storefront', ...(cookie ? { cookie } : {}), ...additionalHeaders },
   remoteAddress: '192.0.2.50',
  });
  const email = 'qa-' + randomUUID() + '@example.test';
  // Exactly six characters, including a common choice: length is the only new-password policy.
  const password = '123456';
  const input = { fullName: 'QA Reader', email, password, locale: 'hy' };
  // An unverified email must never take over a Google identity with the same email.
  const googleOnly = await db.customer.create({ data: { googleSubject: 'qa-google-' + randomUUID(), googleEmail: email, fullName: 'Google-only QA' } });
  assert.equal((await call('POST', 'auth/code', { phone: '+37499123456' })).statusCode, 404);
  assert.equal((await call('POST', 'auth/verify', { challengeId: randomUUID(), code: '123456' })).statusCode, 404);
  assert.equal((await call('POST', 'auth/register', { ...input, password: 'short' })).statusCode, 400);
  assert.equal(await db.customer.count({ where: { email } }), 0, 'five-character passwords cannot create a customer');
  assert.equal(await db.customerSession.count(), 0, 'invalid registration cannot create a session');
  assert.equal(await db.customerAuthRate.count(), 0, 'invalid registration is rejected before rate-limit writes');
  assert.equal((await call('POST', 'auth/register', input, undefined, { origin: 'https://other.example.test' })).statusCode, 403);
  assert.equal((await call('POST', 'auth/register', { ...input, unexpected: true })).statusCode, 400);
  assert.equal(await db.customer.count({ where: { email } }), 0);
  const created = await call('POST', 'auth/register', { ...input, email: ' ' + email.toUpperCase() + ' ' });
  assert.equal(created.statusCode, 201);
  const signedIn = created.json();
  assert.notEqual(signedIn.customer.id, googleOnly.id);
  assert.equal(signedIn.customer.email, email);
  assert.equal(signedIn.customer.emailVerified, false);
  assert.equal(signedIn.customer.googleConnected, false);
  assert.equal(signedIn.customer.passwordEnabled, true);
  assert.ok(!created.body.includes('passwordHash') && !created.body.includes(password));
  assert.equal(created.headers['cache-control'], 'no-store');
  let cookie = cookieFrom(created);
  assert.equal((await auth.identity(request(cookie))).id, signedIn.customer.id);
  const row = await db.customer.findUnique({ where: { email } });
  assert.ok(row.passwordHash.startsWith('scrypt$1$32768$8$3$'));
  assert.notEqual(row.passwordHash, password);
  assert.notEqual((await db.customerSession.findFirst()).tokenHash, cookie.split('=')[1]);
  assert.equal((await call('POST', 'auth/register', input)).statusCode, 409);
  assert.equal(await db.customer.count({ where: { email } }), 1);
  checks.push('http_registration_validation_unverified_email_no_google_merge_and_secure_cookie');

  // More than 128 Unicode code points must remain intact through registration and login.
  const unicodeEmail = 'unicode-' + randomUUID() + '@example.test';
  const unicodePassword = '🔑'.repeat(128) + 'Ж';
  assert.equal(Array.from(unicodePassword).length, 129);
  const unicodeRegistered = await call('POST', 'auth/register', { ...input, email: unicodeEmail, password: unicodePassword });
  assert.equal(unicodeRegistered.statusCode, 201);
  const unicodeCookie = cookieFrom(unicodeRegistered);
  assert.equal((await call('POST', 'auth/login', { email: unicodeEmail, password: unicodePassword })).statusCode, 201);
  assert.equal((await call('POST', 'auth/login', { email: unicodeEmail, password: '🔑'.repeat(128) + 'ж' })).statusCode, 401,
   'the final character after the former maximum is not truncated or normalized');
  assert.equal((await call('GET', 'profile', undefined, unicodeCookie)).statusCode, 200);
  assert.equal((await call('POST', 'auth/logout?all=true', undefined, unicodeCookie)).statusCode, 201);
  assert.equal((await call('GET', 'profile', undefined, unicodeCookie)).statusCode, 401);
  checks.push('http_password_129_unicode_code_points_round_trip_without_truncation');

  const wrong = await call('POST', 'auth/login', { email, password: 'wrong password phrase' });
  const unknown = await call('POST', 'auth/login', { email: 'absent-' + randomUUID() + '@example.test', password });
  assert.equal(wrong.statusCode, 401); assert.equal(unknown.statusCode, 401);
  assert.deepEqual(wrong.json(), unknown.json());
  assert.equal((await call('GET', 'profile')).statusCode, 401);
  const oldCookie = cookie;
  const login = await call('POST', 'auth/login', { email, password }, cookie);
  assert.equal(login.statusCode, 201);
  cookie = cookieFrom(login);
  assert.equal((await call('GET', 'profile', undefined, oldCookie)).statusCode, 401);
  assert.equal((await call('GET', 'profile', undefined, cookie)).statusCode, 200);
  const secondDevice = cookieFrom(await call('POST', 'auth/login', { email, password }));
  assert.equal((await call('GET', 'profile', undefined, cookie)).statusCode, 200);
  checks.push('http_login_generic_errors_and_current_session_rotation');

  const raceEmail = 'race-' + randomUUID() + '@example.test';
  const raceResults = await Promise.all([
   call('POST', 'auth/register', { ...input, email: raceEmail }),
   call('POST', 'auth/register', { ...input, email: raceEmail }),
  ]);
  assert.deepEqual(raceResults.map(result => result.statusCode).sort(), [201, 409]);
  assert.equal(await db.customer.count({ where: { email: raceEmail } }), 1);
  checks.push('concurrent_duplicate_registration_is_atomic');

  const other = await db.customer.create({ data: { googleSubject: 'other-qa-' + randomUUID(), fullName: 'Other QA' } });
  const address = { label: 'QA only', fullName: 'QA Reader', phone: '+37499123456', district: 'KENTRON', addressLine: 'QA address 10', isDefault: true };
  const first = await customers.saveAddress(signedIn.customer.id, address);
  await Promise.all([customers.saveAddress(signedIn.customer.id, { ...address, label: 'Second' }), customers.saveAddress(signedIn.customer.id, { ...address, label: 'Third' })]);
  assert.equal(await db.customerAddress.count({ where: { customerId: signedIn.customer.id, isDefault: true } }), 1);
  await assert.rejects(customers.saveAddress(other.id, address, first.id));
  await assert.rejects(customers.deleteAddress(other.id, first.id));
  assert.equal((await customers.addresses(other.id)).length, 0);
  const currentDefault = await db.customerAddress.findFirst({ where: { customerId: signedIn.customer.id, isDefault: true } });
  await customers.deleteAddress(signedIn.customer.id, currentDefault.id);
  assert.equal(await db.customerAddress.count({ where: { customerId: signedIn.customer.id, isDefault: true } }), 1);
  checks.push('address_ownership_and_concurrent_default');

  const repository = new PrismaOrderRepository(db), now = new Date().toISOString();
  const order = { id: randomUUID(), customerId: signedIn.customer.id, orderNumber: 'QA-' + randomUUID(), idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64),
   status: 'REQUEST_RECEIVED', locale: 'hy', customer: { fullName: 'QA Reader', phone: '+37499123456', email: null },
   delivery: { city: 'YEREVAN', district: 'KENTRON', addressLine: 'QA address', apartment: null, entrance: null, floor: null, notes: null },
   paymentMethod: 'CASH_ON_DELIVERY', cod: { dueAmd: 6700, status: 'CASH_DUE', collectedAt: null, reconciledAt: null, fiscalReceiptNumber: null, reconciliationReference: null, refusalReason: null },
   currency: 'AMD', items: [{ productId: randomUUID(), supplierSku: 'QA_SUPPLIER_SECRET', title: 'QA book', author: 'QA author', sourceUrl: 'https://example.test/private-source', quantity: 1, sourceUnitPriceAmd: 5200, customerUnitPriceAmd: 5700, customerSubtotalAmd: 5700 }],
   itemsSubtotalAmd: 5700, deliveryFeeAmd: 1000, totalAmd: 6700, projectedMarginAmd: 500, customerConfirmationRequired: true, createdAt: now, updatedAt: now };
  assert.equal((await repository.createIdempotently(order)).outcome, 'CREATED');
  assert.equal((await repository.createIdempotently({ ...order, customerId: other.id })).outcome, 'REPLAYED');
  assert.equal((await repository.findById(order.id)).customerId, signedIn.customer.id);
  const historyResponse = await call('GET', 'orders', undefined, cookie);
  assert.equal(historyResponse.statusCode, 200);
  const history = historyResponse.json();
  assert.equal(history.total, 1); assert.equal(history.items[0].status, 'received');
  for (const secret of ['QA_SUPPLIER_SECRET', 'private-source', 'projectedMargin', 'sourceUnitPrice']) assert.ok(!JSON.stringify(history).includes(secret));
  assert.equal((await customers.orders(other.id, 0)).total, 0);
  checks.push('http_private_order_projection_ownership_and_idempotent_replay');

  const nextPassword = '654321';
  const hashBeforeShortChange = (await db.customer.findUnique({ where: { email } })).passwordHash;
  assert.equal((await call('POST', 'auth/password', { currentPassword: password, newPassword: 'short' }, cookie)).statusCode, 400);
  assert.equal((await db.customer.findUnique({ where: { email } })).passwordHash, hashBeforeShortChange,
   'a five-character replacement must not change the stored hash');
  assert.equal((await call('GET', 'profile', undefined, cookie)).statusCode, 200);
  const wrongChange = await call('POST', 'auth/password', { currentPassword: 'wrong current phrase', newPassword: nextPassword }, cookie);
  assert.equal(wrongChange.statusCode, 401);
  const changed = await call('POST', 'auth/password', { currentPassword: password, newPassword: nextPassword }, cookie);
  assert.equal(changed.statusCode, 201);
  const changedCookie = cookieFrom(changed);
  assert.equal((await call('GET', 'profile', undefined, cookie)).statusCode, 401);
  assert.equal((await call('GET', 'profile', undefined, secondDevice)).statusCode, 401);
  assert.equal((await call('GET', 'profile', undefined, changedCookie)).statusCode, 200);
  assert.equal((await call('POST', 'auth/login', { email, password })).statusCode, 401);
  assert.equal((await call('POST', 'auth/login', { email, password: nextPassword })).statusCode, 201);
  cookie = changedCookie;
  checks.push('http_six_character_password_registration_login_and_change_with_session_revocation');

  let currentPassword = nextPassword;
  for (let i = 0; i < 3; i++) {
   const replacement = 'Concurrent replacement passphrase ' + i;
   const [racingLogin, racingChange] = await Promise.all([
    call('POST', 'auth/login', { email, password: currentPassword }),
    call('POST', 'auth/password', { currentPassword, newPassword: replacement }, cookie),
   ]);
   assert.equal(racingChange.statusCode, 201);
   assert.ok([201, 401].includes(racingLogin.statusCode));
   if (racingLogin.statusCode === 201) assert.equal((await call('GET', 'profile', undefined, cookieFrom(racingLogin))).statusCode, 401);
   cookie = cookieFrom(racingChange); currentPassword = replacement;
   assert.equal((await call('GET', 'profile', undefined, cookie)).statusCode, 200);
  }
  checks.push('concurrent_old_password_login_cannot_survive_password_change');

  const limitedEmail = 'limited-' + randomUUID() + '@example.test', bucket = Math.floor(Date.now() / 900_000);
  await db.customerAuthRate.create({ data: { key: tokenHash('login-identity:' + limitedEmail) + ':900:' + bucket, count: 10, expiresAt: new Date(Date.now() + 1800_000) } });
  assert.equal((await call('POST', 'auth/login', { email: limitedEmail, password })).statusCode, 429);
  assert.equal((await call('GET', 'auth/config')).json().smsEnabled, false);
  assert.equal((await call('GET', 'auth/config')).json().passwordEnabled, true);
  checks.push('durable_identifier_rate_limit_and_sms_disabled');
  await call('POST', 'auth/logout?all=true', undefined, cookie);
  assert.equal(await auth.identity(request(cookie)), null);
  checks.push('http_logout_server_revocation');
  console.log(JSON.stringify({ schema, passed: checks }));
 } finally {
  if (app) await app.close();
  await db.$executeRawUnsafe('DROP SCHEMA IF EXISTS "' + schema + '" CASCADE');
  await db.$disconnect();
  console.log('Isolated QA schema removed.');
 }
})().catch(error => {
 console.error(error instanceof assert.AssertionError ? error.message : 'Isolated account QA failed (' + (error.code || error.name || 'unknown') + ')');
 process.exitCode = 1;
});

