import assert from "node:assert/strict";
import test from "node:test";

import {
  basicAuthorization,
  isAuthorizationStatus,
  isOrderCancellable,
  normalizeAdminApiBase,
  procurementActionVisibility,
  normalizeReceiptNumber,
  requestHeaders,
} from "../app/admin/admin-client.mjs";

const origin = "https://shop.example";

test("admin API base is restricted to the configured same-origin path", () => {
  assert.equal(normalizeAdminApiBase("/api/v1", origin), "/api/v1");
  assert.equal(normalizeAdminApiBase("/api/v1/", origin), "/api/v1");
  assert.equal(normalizeAdminApiBase("https://shop.example/api/v1", origin), "/api/v1");

  for (const unsafe of [
    "//evil.example/api/v1",
    "https://evil.example/api/v1",
    "http://shop.example/api/v1",
    "https://user:pass@shop.example/api/v1",
    "/api/v1?log=1",
    "/api/v1#fragment",
    "/api/../api/v1",
    "javascript:alert(1)",
  ]) {
    assert.throws(() => normalizeAdminApiBase(unsafe, origin), /UNSAFE_ADMIN_API_BASE/u);
  }
});

test("login credentials are attached only to protected admin paths", () => {
  const credentials = { username: "admin", password: "test-password" };
  assert.equal(
    requestHeaders("/admin/dashboard", credentials).authorization,
    basicAuthorization("admin", "test-password"),
  );
  assert.equal(requestHeaders("/catalog/books", credentials).authorization, undefined);
  assert.equal(requestHeaders("/catalog/books", credentials, true)["content-type"], "application/json");
});

test("basic authorization encodes UTF-8 credentials", () => {
  const encoded = basicAuthorization("օպերատոր", "գաղտնաբառ").slice("Basic ".length);
  assert.equal(Buffer.from(encoded, "base64").toString("utf8"), "օպերատոր:գաղտնաբառ");
});

test("receipt normalization matches the API contract", () => {
  assert.equal(normalizeReceiptNumber("  e-HDM_123/45  "), "e-HDM_123/45");
  assert.equal(normalizeReceiptNumber("ՀԴՄ-123"), "ՀԴՄ-123");
  for (const invalid of ["", "ab", "has spaces", "<script>", "a\nb", "x".repeat(101)]) {
    assert.equal(normalizeReceiptNumber(invalid), null);
  }
});

test("authorization status classification covers expired credentials", () => {
  assert.equal(isAuthorizationStatus(401), true);
  assert.equal(isAuthorizationStatus(403), true);
  assert.equal(isAuthorizationStatus(500), false);
});


test("procurement confirmation requires its matching order to await procurement", () => {
  const task = { orderId: "target", status: "PENDING_OPERATOR" };

  assert.deepEqual(
    procurementActionVisibility(task, [{ id: "target", status: "REQUEST_RECEIVED" }]),
    { canConfirm: false, canCancel: true },
  );
  assert.deepEqual(
    procurementActionVisibility(task, [{ id: "target", status: "PROCUREMENT_PENDING" }]),
    { canConfirm: true, canCancel: true },
  );
  assert.deepEqual(
    procurementActionVisibility(task, [
      { id: "target", status: "REQUEST_RECEIVED" },
      { id: "other", status: "PROCUREMENT_PENDING" },
    ]),
    { canConfirm: false, canCancel: true },
  );
});

test("confirmed procurement cancellation follows the matching order state", () => {
  const task = { orderId: "target", status: "SUPPLIER_CONFIRMED" };

  assert.deepEqual(
    procurementActionVisibility(task, [{ id: "target", status: "READY_FOR_DELIVERY" }]),
    { canConfirm: false, canCancel: true },
  );
  assert.deepEqual(
    procurementActionVisibility(task, [{ id: "target", status: "OUT_FOR_DELIVERY" }]),
    { canConfirm: false, canCancel: false },
  );
  assert.deepEqual(
    procurementActionVisibility(task, [
      { id: "target", status: "OUT_FOR_DELIVERY" },
      { id: "other", status: "READY_FOR_DELIVERY" },
    ]),
    { canConfirm: false, canCancel: false },
  );
  assert.equal(isOrderCancellable("SUPPLIER_CONFIRMED"), true);
  assert.equal(isOrderCancellable("OUT_FOR_DELIVERY"), false);
});
