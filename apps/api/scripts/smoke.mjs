import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = (process.env.API_BASE_URL ?? "http://127.0.0.1:4000/api/v1").replace(/\/$/, "");
const knownInsecureAdminKeys = new Set([
  "development-admin-api-key-change-me",
  "replace-with-at-least-32-random-characters",
]);
const adminKey = process.env.ADMIN_API_KEY?.trim();

if (!adminKey) {
  throw new Error("ADMIN_API_KEY is required for the API smoke test");
}
if (knownInsecureAdminKeys.has(adminKey.toLowerCase())) {
  throw new Error("ADMIN_API_KEY cannot use a known default or placeholder");
}
if (adminKey.length < 32) {
  throw new Error("ADMIN_API_KEY must contain at least 32 characters");
}

const runSuffix = randomUUID();
const idempotencyKey = `smoke-${runSuffix}`;

async function request(path, { method = "GET", body, admin = false, expected = 200 } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(admin ? { "x-admin-api-key": adminKey } : {}),
      ...(!admin && path === "/orders" ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

const orderInput = {
  locale: "hy",
  items: [{ productId: "d1e7c1be-74e2-4c7a-9e9d-4aee1bc12301", quantity: 1 }],
  customer: { fullName: "Smoke Test", phone: "+37499123456" },
  delivery: { city: "YEREVAN", district: "KENTRON", addressLine: "Abovyan 10" },
  paymentMethod: "CASH_ON_DELIVERY",
  acceptsPreliminaryAvailability: true,
  expectedTotalAmd: 6700,
  expectedPricingRuleVersion: "amd-fixed-v1",
};

const created = await request("/orders", { method: "POST", body: orderInput, expected: 201 });
assert.equal(created.totalAmd, 6700);
assert.equal(created.cod.status, "CASH_DUE");

const replay = await request("/orders", { method: "POST", body: orderInput, expected: 201 });
assert.equal(replay.id, created.id, "Idempotency replay created a duplicate order");

const queue = await request("/admin/procurements", { admin: true });
const task = queue.find((candidate) => candidate.orderId === created.id);
assert.ok(task, "Procurement task was not created");

for (const status of ["CUSTOMER_CONFIRMED", "PROCUREMENT_PENDING"]) {
  await request(`/admin/orders/${created.id}/status`, { method: "PATCH", admin: true, body: { status } });
}
await request(`/admin/procurements/${task.id}/transition`, {
  method: "POST",
  admin: true,
  body: { status: "SUPPLIER_CONFIRMED", supplierReference: `SMOKE-SUPPLIER-${runSuffix}` },
  expected: 201,
});
for (const status of ["READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"]) {
  await request(`/admin/orders/${created.id}/status`, { method: "PATCH", admin: true, body: { status } });
}

await request(`/admin/orders/${created.id}/cash/collect`, {
  method: "POST",
  admin: true,
  body: { fiscalReceiptNumber: `SMOKE-EHDM-${runSuffix}` },
  expected: 201,
});
await request(`/admin/orders/${created.id}/status`, {
  method: "PATCH",
  admin: true,
  body: { status: "DELIVERED" },
  expected: 409,
});
await request(`/admin/orders/${created.id}/cash/reconcile`, {
  method: "POST",
  admin: true,
  body: { reconciliationReference: `SMOKE-CASH-${runSuffix}` },
  expected: 201,
});
const delivered = await request(`/admin/orders/${created.id}/status`, {
  method: "PATCH",
  admin: true,
  body: { status: "DELIVERED" },
});
assert.equal(delivered.status, "DELIVERED");
assert.equal(delivered.cod.status, "CASH_RECONCILED");

const finalQueue = await request("/admin/procurements", { admin: true });
assert.equal(finalQueue.filter((candidate) => candidate.orderId === created.id).length, 1);

process.stdout.write(
  JSON.stringify({
    ok: true,
    orderNumber: created.orderNumber,
    totalAmd: created.totalAmd,
    procurementStatus: "SUPPLIER_CONFIRMED",
    cashStatus: delivered.cod.status,
    orderStatus: delivered.status,
  }),
);
