import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKOUT_PENDING_STORAGE_KEY, MAX_PENDING_CHECKOUT_BODY_BYTES,
  checkoutFieldErrors, fetchCartSnapshot, normalizeCheckoutPhone,
  parsePendingCheckout, readPendingCheckout, savePendingCheckout, clearPendingCheckout,
  classifyCheckoutResponse, subtractOrderedItems,
} from "../app/lib/checkout-client.mjs";

const policy = { currency: "AMD", deliveryFeeAmd: 1000, pricingRuleVersion: "amd-fixed-v1" };
const book = { id: "book-1", slug: "book-1", title: "Book", author: "Author", description: "",
  language: "ru", locale: "ru", price: { amount: 5700, currency: "AMD" }, availability: "PRELIMINARY_AVAILABLE" };
const options = { items: [{ id: book.id, slug: book.slug }], locale: "ru", baseUrl: "/api/v1" };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("checkout normalizes Armenian phones and rejects blank or malformed fields", () => {
  assert.equal(normalizeCheckoutPhone("099 12 34 56"), "+37499123456");
  assert.equal(normalizeCheckoutPhone("+374 (99) 123456"), "+37499123456");
  assert.deepEqual(checkoutFieldErrors({name:"  ", phone:"abc99123456", address:"     ", district:"x"}, ["KENTRON"]),
    {name:true, phone:true, address:true, district:true});
  assert.deepEqual(checkoutFieldErrors({name:" Anna ", phone:"099 12 34 56", address:" Abovyan 1 ", district:"KENTRON"}, ["KENTRON"]), {});
});

test("cart refresh uses current prices and public delivery policy", async () => {
  const urls = [];
  const result = await fetchCartSnapshot({...options, fetchImpl: async (url) => {
    urls.push(url);
    return response(url.endsWith("/policy") ? {...policy, deliveryFeeAmd:1200} : {...book,price:{amount:6200,currency:"AMD"}});
  }});
  assert.equal(result.books[0].price.amount, 6200);
  assert.equal(result.policy.deliveryFeeAmd, 1200);
  assert.deepEqual(result.unavailableIds, []);
  assert.ok(urls[1].endsWith("/catalog/books/book-1?locale=ru"));
});

test("missing or sold-out books remain unavailable for checkout", async () => {
  for (const status of [200,404]) {
    const result = await fetchCartSnapshot({...options, fetchImpl: async url => url.endsWith("/policy")
      ? response(policy) : response({...book,availability:"OUT_OF_STOCK"},status)});
    assert.deepEqual(result.unavailableIds,[book.id]);
  }
});

test("cart refresh fails closed on wrong IDs, invalid prices, API failure and abort", async () => {
  for (const badBook of [{...book,id:"another-book"}, {...book,price:{amount:-1,currency:"AMD"}},
    {...book,availability:"UNKNOWN"}, {...book,locale:"xx"}]) {
    await assert.rejects(fetchCartSnapshot({...options, fetchImpl:async url=>response(url.endsWith("/policy")?policy:badBook)}));
  }
  await assert.rejects(fetchCartSnapshot({...options, fetchImpl:async()=>response({},503)}));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchCartSnapshot({...options,signal:controller.signal,fetchImpl:async(_url,init)=>{
    init.signal.throwIfAborted();
    return response(policy);
  }}), {name:"AbortError"});
});

test("cart refresh rejects invalid delivery policies", async () => {
  for (const badPolicy of [{...policy,deliveryFeeAmd:-1},{...policy,pricingRuleVersion:""},{...policy,currency:"USD"}]) {
    await assert.rejects(fetchCartSnapshot({...options,fetchImpl:async()=>response(badPolicy)}));
  }
});

test("explicit international phones retain their country code and malformed plus signs are rejected", () => {
  assert.equal(normalizeCheckoutPhone("+49 123456"), "+49123456");
  assert.equal(normalizeCheckoutPhone("+374 (99) 123456"), "+37499123456");
  for (const phone of ["++37499123456", "374+99123456", "(+374)99123456"]) {
    assert.equal(normalizeCheckoutPhone(phone), "");
    assert.equal(checkoutFieldErrors({ name: "Anna", phone, address: "Abovyan 1", district: "KENTRON" }, ["KENTRON"]).phone, true);
  }
});

test("cart refresh follows stable IDs when the stored slug has been renamed", async () => {
  const result = await fetchCartSnapshot({ ...options, fetchImpl: async url => {
    if (url.endsWith("/policy")) return response(policy);
    assert.ok(url.endsWith("/catalog/books/book-1?locale=ru"));
    assert.ok(!url.includes("by-slug"));
    return response({ ...book, slug: "new-public-address" });
  } });
  assert.equal(result.books[0].slug, "new-public-address");
  assert.deepEqual(result.unavailableIds, []);
});

const productId = "11111111-1111-4111-8111-111111111111";
const otherProductId = "22222222-2222-4222-8222-222222222222";
const requestBody = () => ({
  locale: "ru",
  items: [{ productId, quantity: 2 }],
  customer: { fullName: "Anna Reader", phone: "+37499123456" },
  delivery: { city: "YEREVAN", district: "ARABKIR", addressLine: "Komitas 42", notes: "Call on arrival" },
  paymentMethod: "CASH_ON_DELIVERY",
  acceptsPreliminaryAvailability: true,
  expectedTotalAmd: 12400,
  expectedPricingRuleVersion: "amd-fixed-v1",
});
const pendingRequest = body => ({
  key: "b1754e3d-5648-4ac9-949c-534d59a6c0a5",
  body: body ?? JSON.stringify(requestBody()),
});
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

test("pending checkout survives a new reader without reserializing its exact body or replacing its key", () => {
  const body = "\n" + JSON.stringify(requestBody(), null, 2) + "\n";
  const pending = pendingRequest(body);
  const storage = memoryStorage();
  assert.equal(savePendingCheckout(pending, storage), true);
  const stored = storage.getItem(CHECKOUT_PENDING_STORAGE_KEY);
  assert.deepEqual(parsePendingCheckout(stored), pending);
  assert.deepEqual(readPendingCheckout(storage), pending);
  assert.equal(readPendingCheckout(storage).body, body);
  assert.equal(clearPendingCheckout(storage), true);
  assert.equal(readPendingCheckout(storage), null);
});

test("a different submission cannot overwrite an unresolved pending checkout", () => {
  const storage = memoryStorage();
  const original = pendingRequest();
  assert.equal(savePendingCheckout(original, storage), true);
  assert.equal(savePendingCheckout({ ...original, key: "another-valid-key" }, storage), false);
  assert.equal(savePendingCheckout(pendingRequest(JSON.stringify({ ...requestBody(), expectedTotalAmd: 13000 })), storage), false);
  assert.deepEqual(readPendingCheckout(storage), original);
  assert.equal(savePendingCheckout(original, storage), true);
});

test("clearing a resolved checkout never removes a different pending key or body", () => {
  const storage = memoryStorage();
  const original = pendingRequest();
  for (const other of [{ ...original, key: "another-valid-key" },
    pendingRequest(JSON.stringify({ ...requestBody(), expectedTotalAmd: 13000 }))]) {
    storage.setItem(CHECKOUT_PENDING_STORAGE_KEY, JSON.stringify(other));
    assert.equal(clearPendingCheckout(storage, original), false);
    assert.deepEqual(readPendingCheckout(storage), other);
  }
  storage.setItem(CHECKOUT_PENDING_STORAGE_KEY, "malformed saved request");
  assert.equal(clearPendingCheckout(storage, original), false);
  assert.equal(storage.getItem(CHECKOUT_PENDING_STORAGE_KEY), "malformed saved request");
  storage.setItem(CHECKOUT_PENDING_STORAGE_KEY, JSON.stringify(original));
  assert.equal(clearPendingCheckout(storage, original), true);
  assert.equal(clearPendingCheckout(storage, original), true);
});

test("clearing reports failure when browser storage cannot remove the resolved request", () => {
  const storage = memoryStorage();
  const original = pendingRequest();
  assert.equal(savePendingCheckout(original, storage), true);
  assert.equal(clearPendingCheckout({ ...storage, removeItem() {} }, original), false);
  assert.deepEqual(readPendingCheckout(storage), original);
  assert.equal(clearPendingCheckout({ ...storage, removeItem() { throw new Error("denied"); } }, original), false);
  assert.deepEqual(readPendingCheckout(storage), original);
});

test("pending parsing rejects invalid envelopes and invalid checkout structures", () => {
  for (const raw of [null, undefined, "", "{", "[]", "null", JSON.stringify({ key: "short", body: "{}" }),
    JSON.stringify({ key: "valid-key", body: {} }), JSON.stringify({ key: "valid-key", body: "not json" })]) {
    assert.equal(parsePendingCheckout(raw), null);
  }
  const invalidBodies = [
    { ...requestBody(), locale: "xx" },
    { ...requestBody(), paymentMethod: "CARD" },
    { ...requestBody(), acceptsPreliminaryAvailability: false },
    { ...requestBody(), expectedTotalAmd: -1 },
    { ...requestBody(), expectedTotalAmd: 10.5 },
    { ...requestBody(), expectedPricingRuleVersion: " " },
    { ...requestBody(), items: [] },
    { ...requestBody(), items: [{ productId: "not-a-uuid", quantity: 1 }] },
    { ...requestBody(), items: [{ productId, quantity: 0 }] },
    { ...requestBody(), items: [{ productId, quantity: 1.5 }] },
    { ...requestBody(), items: [{ productId, quantity: 11 }] },
    { ...requestBody(), items: [{ productId, quantity: 6 }, { productId, quantity: 6 }] },
    { ...requestBody(), items: Array(31).fill({ productId, quantity: 1 }) },
    { ...requestBody(), customer: null },
    { ...requestBody(), customer: { fullName: " ", phone: "+37499123456" } },
    { ...requestBody(), customer: { fullName: "Anna", phone: "++37499123456" } },
    { ...requestBody(), delivery: { ...requestBody().delivery, city: "GYUMRI" } },
    { ...requestBody(), delivery: { ...requestBody().delivery, district: "UNKNOWN" } },
    { ...requestBody(), delivery: { ...requestBody().delivery, addressLine: " " } },
  ];
  for (const body of invalidBodies) assert.equal(parsePendingCheckout(JSON.stringify(pendingRequest(JSON.stringify(body)))), null);
});

test("pending size limits count UTF-8 bytes and handle blocked or silently failing storage", () => {
  const oversized = pendingRequest(" ".repeat(MAX_PENDING_CHECKOUT_BODY_BYTES) + JSON.stringify(requestBody()));
  assert.equal(parsePendingCheckout(JSON.stringify(oversized)), null);
  const utf8Oversized = pendingRequest(JSON.stringify({ ...requestBody(), padding: "ա".repeat(MAX_PENDING_CHECKOUT_BODY_BYTES / 2) }));
  assert.ok(utf8Oversized.body.length < MAX_PENDING_CHECKOUT_BODY_BYTES);
  assert.equal(parsePendingCheckout(JSON.stringify(utf8Oversized)), null);
  const denied = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  assert.equal(readPendingCheckout(denied), null);
  assert.equal(savePendingCheckout(pendingRequest(), denied), false);
  assert.equal(clearPendingCheckout(denied), false);
  assert.equal(savePendingCheckout(pendingRequest(), { ...memoryStorage(), setItem() {} }), false);
});

test("only definite HTTP failures release an unresolved request; timeouts and rate limits retain it", () => {
  for (const status of [200, 201, 204]) assert.equal(classifyCheckoutResponse(status), "success");
  for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(classifyCheckoutResponse(status), "definite-error");
  for (const status of [undefined, null, 0, 301, 408, 429, 500, 502, 503, NaN]) assert.equal(classifyCheckoutResponse(status), "uncertain");
});

test("confirmed replay subtracts only ordered copies and keeps later cart additions", () => {
  const first = { book: { id: productId, title: "First book" }, quantity: 5 };
  const added = { book: { id: otherProductId, title: "New book" }, quantity: 2 };
  const cart = [first, added];
  assert.deepEqual(subtractOrderedItems(cart, [{ productId, quantity: 2 }]), [
    { ...first, quantity: 3 }, added,
  ]);
  assert.equal(first.quantity, 5);
  assert.equal(cart.length, 2);
});

test("confirmed replay handles removed items and duplicate lines without subtracting twice", () => {
  const cart = [
    { book: { id: productId }, quantity: 1 },
    { book: { id: productId }, quantity: 4 },
    { book: { id: otherProductId }, quantity: 2 },
  ];
  assert.deepEqual(subtractOrderedItems(cart, [{ productId, quantity: 1 }, { productId, quantity: 2 }]), [
    { book: { id: productId }, quantity: 2 },
    { book: { id: otherProductId }, quantity: 2 },
  ]);
  assert.deepEqual(subtractOrderedItems(cart, [{ productId: "removed", quantity: 2 }]), cart);
  assert.deepEqual(subtractOrderedItems([cart[0]], [{ productId, quantity: 10 }]), []);
});
