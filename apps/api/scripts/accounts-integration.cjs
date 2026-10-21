/* Manual PostgreSQL integration check. Refuses non-QA schemas; never use a production schema. */
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
execFileSync(process.execPath, [requireApp.resolve('prisma/build/index.js'), 'migrate', 'deploy'], { stdio: 'inherit' });
const { ConfigService } = requireApp('@nestjs/config');
const { PrismaService } = requireApp('./dist/database/prisma.service');
const { CustomerAuthService, tokenHash } = requireApp('./dist/modules/customer-auth/customer-auth.service');
const { CustomersService } = requireApp('./dist/modules/customers/customers.service');
const { PrismaOrderRepository } = requireApp('./dist/modules/orders/repositories/prisma-order.repository');
const config = new ConfigService({ PERSISTENCE_ADAPTER: 'POSTGRES', DATABASE_URL: process.env.DATABASE_URL, NODE_ENV: 'production' });
const db = new PrismaService(config);
const providers = { site: 'https://qa.example.test', smsEnabled: true, googleEnabled: false,
 sendCode: async () => {}, verifyCode: async (_phone, code) => code === '123456' };
const auth = new CustomerAuthService(db, providers, config);
const customers = new CustomersService(db);
const request = cookie => ({ headers: cookie ? { cookie } : {}, ip: '192.0.2.50' });
const checks = [];
(async () => {
 try {
  await db.ping();
  const challenge = await auth.requestCode('+37499123456', 'hy', '192.0.2.50');
  await assert.rejects(auth.verifyCode(challenge.challengeId, '999999', request()), /Bad Request/);
  const signedIn = await auth.verifyCode(challenge.challengeId, '123456', request());
  const cookie = signedIn.cookie.split(';')[0];
  assert.equal((await auth.identity(request(cookie))).id, signedIn.customer.id);
  await assert.rejects(auth.verifyCode(challenge.challengeId, '123456', request()));
  await assert.rejects(auth.requestCode('+37499123456', 'hy', '192.0.2.50'));
  assert.equal(await db.customerSession.count(), 1);
  assert.ok((await db.customerSession.findFirst()).tokenHash !== cookie.split('=')[1]);
  checks.push('durable_sms_session_replay_and_rate_limit');
  const other = await db.customer.create({ data: { phone: '+37499123457', fullName: 'Other QA' } });
  const input = { label: 'QA only', fullName: 'QA Reader', phone: '+37499123456', district: 'KENTRON', addressLine: 'QA address 10', isDefault: true };
  const first = await customers.saveAddress(signedIn.customer.id, input);
  await Promise.all([customers.saveAddress(signedIn.customer.id, { ...input, label: 'Second' }), customers.saveAddress(signedIn.customer.id, { ...input, label: 'Third' })]);
  assert.equal(await db.customerAddress.count({ where: { customerId: signedIn.customer.id, isDefault: true } }), 1);
  await assert.rejects(customers.saveAddress(other.id, input, first.id));
  await assert.rejects(customers.deleteAddress(other.id, first.id));
  assert.equal((await customers.addresses(other.id)).length, 0);
  const currentDefault = await db.customerAddress.findFirst({ where: { customerId: signedIn.customer.id, isDefault: true } });
  await customers.deleteAddress(signedIn.customer.id, currentDefault.id);
  assert.equal(await db.customerAddress.count({ where: { customerId: signedIn.customer.id, isDefault: true } }), 1);
  checks.push('address_ownership_and_concurrent_default');
  const repository = new PrismaOrderRepository(db);
  const now = new Date().toISOString();
  const order = { id: randomUUID(), customerId: signedIn.customer.id, orderNumber: 'QA-' + randomUUID(), idempotencyKey: randomUUID(), requestHash: 'a'.repeat(64),
   status: 'REQUEST_RECEIVED', locale: 'hy', customer: { fullName: 'QA Reader', phone: '+37499123456', email: null },
   delivery: { city: 'YEREVAN', district: 'KENTRON', addressLine: 'QA address', apartment: null, entrance: null, floor: null, notes: null },
   paymentMethod: 'CASH_ON_DELIVERY', cod: { dueAmd: 6700, status: 'CASH_DUE', collectedAt: null, reconciledAt: null, fiscalReceiptNumber: null, reconciliationReference: null, refusalReason: null },
   currency: 'AMD', items: [{ productId: randomUUID(), supplierSku: 'QA_SUPPLIER_SECRET', title: 'QA book', author: 'QA author', sourceUrl: 'https://example.test/private-source', quantity: 1, sourceUnitPriceAmd: 5200, customerUnitPriceAmd: 5700, customerSubtotalAmd: 5700 }],
   itemsSubtotalAmd: 5700, deliveryFeeAmd: 1000, totalAmd: 6700, projectedMarginAmd: 500, customerConfirmationRequired: true, createdAt: now, updatedAt: now };
  assert.equal((await repository.createIdempotently(order)).outcome, 'CREATED');
  assert.equal((await repository.createIdempotently({ ...order, customerId: other.id })).outcome, 'REPLAYED');
  assert.equal((await repository.findById(order.id)).customerId, signedIn.customer.id);
  const history = await customers.orders(signedIn.customer.id, 0);
  assert.equal(history.total, 1);
  assert.equal(history.items[0].status, 'received');
  for (const secret of ['QA_SUPPLIER_SECRET', 'private-source', 'projectedMargin', 'sourceUnitPrice']) assert.ok(!JSON.stringify(history).includes(secret));
  assert.equal((await customers.orders(other.id, 0)).total, 0);
  checks.push('order_ownership_projection_and_idempotent_replay');
  await auth.logout(request(cookie), true);
  assert.equal(await auth.identity(request(cookie)), null);
  checks.push('server_logout_revocation');
  console.log(JSON.stringify({ schema, passed: checks }));
 } finally {
  await db.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
  await db.$disconnect();
  console.log('Isolated QA schema removed.');
 }
})().catch(error => { console.error(error); process.exitCode = 1; });

