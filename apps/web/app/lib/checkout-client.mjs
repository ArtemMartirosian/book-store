export function normalizeCheckoutPhone(value) {
  const input = String(value).trim();
  if (!/^\+?[\d\s()-]+$/u.test(input)) return "";
  const digits = input.replace(/\D/g, "");
  if (input.startsWith("+")) return "+" + digits;
  if (digits.startsWith("374")) return "+" + digits;
  if (digits.length === 9 && digits.startsWith("0")) return "+374" + digits.slice(1);
  if (digits.length === 8) return "+374" + digits;
  return "+" + digits;
}

export function checkoutFieldErrors(values, districts) {
  const errors = {};
  const name = String(values.name ?? "").trim();
  const phone = String(values.phone ?? "").trim();
  const address = String(values.address ?? "").trim();
  if (name.length < 2 || name.length > 100) errors.name = true;
  if (!/^[+\d\s()-]+$/.test(phone) || !/^\+[0-9]{8,15}$/.test(normalizeCheckoutPhone(phone))) errors.phone = true;
  if (address.length < 5 || address.length > 200) errors.address = true;
  if (!districts.includes(values.district)) errors.district = true;
  return errors;
}

/**
 * Rechecks only books already in the cart; a failed request never becomes an
 * available item. Calls are bounded to five concurrent requests.
 * @param {{items: Array<{id: string, slug?: string}>, locale: string, baseUrl: string, signal?: AbortSignal, fetchImpl?: typeof fetch}} options
 * @returns {Promise<{books: import("./catalog-api").CatalogApiBook[], unavailableIds: string[], policy: {deliveryFeeAmd: number, pricingRuleVersion: string}}>}
 */
export async function fetchCartSnapshot({ items, locale, baseUrl, signal, fetchImpl = fetch }) {
  const base = baseUrl.replace(/\/$/, "");
  const policyResponse = await fetchImpl(base + "/pricing/policy", { signal, cache: "no-store" });
  if (!policyResponse.ok) throw new Error("Could not refresh checkout");
  const policy = await policyResponse.json();
  if (policy?.currency !== "AMD" || !Number.isSafeInteger(policy.deliveryFeeAmd) || policy.deliveryFeeAmd < 0
      || typeof policy.pricingRuleVersion !== "string" || !policy.pricingRuleVersion.trim() || policy.pricingRuleVersion.length > 64) {
    throw new Error("Invalid checkout policy");
  }
  const books = [];
  const unavailableIds = [];
  for (let start = 0; start < items.length; start += 5) {
    const batch = await Promise.all(items.slice(start, start + 5).map(async (item) => {
      const response = await fetchImpl(base + "/catalog/books/" + encodeURIComponent(item.id)
        + "?locale=" + encodeURIComponent(locale), { signal, cache: "no-store" });
      if (response.status === 404) return { id: item.id, book: null };
      if (!response.ok) throw new Error("Could not refresh a book");
      const book = await response.json();
      if (book?.id !== item.id || typeof book.slug !== "string" || typeof book.title !== "string"
          || typeof book.author !== "string" || typeof book.description !== "string"
          || !["hy", "ru", "en"].includes(book.language) || !["hy", "ru", "en"].includes(book.locale)
          || book.price?.currency !== "AMD" || !Number.isSafeInteger(book.price.amount) || book.price.amount <= 0
          || !["PRELIMINARY_AVAILABLE", "OUT_OF_STOCK"].includes(book.availability)) {
        throw new Error("Invalid book response");
      }
      return { id: item.id, book };
    }));
    for (const item of batch) {
      if (item.book) books.push(item.book);
      if (!item.book || item.book.availability === "OUT_OF_STOCK") unavailableIds.push(item.id);
    }
  }
  return { books, unavailableIds, policy: {
    deliveryFeeAmd: policy.deliveryFeeAmd, pricingRuleVersion: policy.pricingRuleVersion,
  } };
}

export const CHECKOUT_PENDING_STORAGE_KEY = "lumi-checkout-pending-v1";
export const MAX_PENDING_CHECKOUT_BODY_BYTES = 65_536;

/** @typedef {{key: string, body: string}} PendingCheckout */
/** @typedef {{getItem: (key: string) => string|null, setItem: (key: string, value: string) => void, removeItem: (key: string) => void}} CheckoutStorage */

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const pendingDistricts = new Set([
  "KENTRON", "ARABKIR", "KANAKER_ZEYTUN", "NOR_NORK", "AVAN", "EREBUNI",
  "SHENGAVIT", "DAVTASHEN", "AJAPNYAK", "MALATIA_SEBASTIA", "NUBARASHEN", "NORK_MARASH",
]);
const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
const boundedText = (value, min, max) => typeof value === "string"
  && value.trim().length >= min && value.length <= max;
const optionalText = (value, max) => value === undefined || boundedText(value, 0, max);

function validPendingBody(body) {
  if (!isObject(body) || !["hy", "ru", "en"].includes(body.locale)
      || body.paymentMethod !== "CASH_ON_DELIVERY" || body.acceptsPreliminaryAvailability !== true
      || !Number.isSafeInteger(body.expectedTotalAmd) || body.expectedTotalAmd <= 0
      || !boundedText(body.expectedPricingRuleVersion, 1, 64)
      || !Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30
      || !isObject(body.customer) || !isObject(body.delivery)) return false;
  const quantities = new Map();
  for (const item of body.items) {
    if (!isObject(item) || typeof item.productId !== "string" || !uuidPattern.test(item.productId)
        || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) return false;
    const quantity = (quantities.get(item.productId.toLowerCase()) ?? 0) + item.quantity;
    if (quantity > 10) return false;
    quantities.set(item.productId.toLowerCase(), quantity);
  }
  const customer = body.customer;
  const delivery = body.delivery;
  return boundedText(customer.fullName, 2, 100)
    && typeof customer.phone === "string" && /^\+?[0-9]{8,15}$/u.test(customer.phone)
    && optionalText(customer.email, 254)
    && delivery.city === "YEREVAN" && pendingDistricts.has(delivery.district)
    && boundedText(delivery.addressLine, 5, 250)
    && optionalText(delivery.apartment, 20) && optionalText(delivery.entrance, 20)
    && optionalText(delivery.floor, 20) && optionalText(delivery.notes, 500);
}

/**
 * Validates the saved envelope without changing the serialized request body.
 * No expiry is applied: a lost response can be replayed with its original key.
 * @param {string|null|undefined} raw
 * @returns {PendingCheckout|null}
 */
export function parsePendingCheckout(raw) {
  if (typeof raw !== "string" || raw.length > MAX_PENDING_CHECKOUT_BODY_BYTES * 2 + 512) return null;
  try {
    const pending = JSON.parse(raw);
    if (!isObject(pending) || typeof pending.key !== "string"
        || !/^[A-Za-z0-9._:-]{8,128}$/u.test(pending.key)
        || typeof pending.body !== "string" || !pending.body
        || pending.body.length > MAX_PENDING_CHECKOUT_BODY_BYTES
        || new TextEncoder().encode(pending.body).byteLength > MAX_PENDING_CHECKOUT_BODY_BYTES
        || !validPendingBody(JSON.parse(pending.body))) return null;
    return { key: pending.key, body: pending.body };
  } catch {
    return null;
  }
}

/** @param {CheckoutStorage} [storage] @returns {PendingCheckout|null} */
export function readPendingCheckout(storage) {
  try {
    return parsePendingCheckout((storage ?? globalThis.localStorage).getItem(CHECKOUT_PENDING_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Returns false if the original request cannot be durably retained.
 * Callers must check this before dispatching a new order.
 * @param {PendingCheckout} pending
 * @param {CheckoutStorage} [storage]
 * @returns {boolean}
 */
export function savePendingCheckout(pending, storage) {
  try {
    const serialized = JSON.stringify({ key: pending.key, body: pending.body });
    if (!parsePendingCheckout(serialized)) return false;
    const target = storage ?? globalThis.localStorage;
    const previous = parsePendingCheckout(target.getItem(CHECKOUT_PENDING_STORAGE_KEY));
    if (previous && (previous.key !== pending.key || previous.body !== pending.body)) return false;
    target.setItem(CHECKOUT_PENDING_STORAGE_KEY, serialized);
    return target.getItem(CHECKOUT_PENDING_STORAGE_KEY) === serialized;
  } catch {
    return false;
  }
}

/**
 * An older response must not clear a newer request saved by another tab.
 * @param {CheckoutStorage} [storage]
 * @param {PendingCheckout} [expected]
 * @returns {boolean}
 */
export function clearPendingCheckout(storage, expected) {
  try {
    const target = storage ?? globalThis.localStorage;
    const stored = target.getItem(CHECKOUT_PENDING_STORAGE_KEY);
    if (stored === null) return true;
    if (expected) {
      const current = parsePendingCheckout(stored);
      if (!current || current.key !== expected.key || current.body !== expected.body) return false;
    }
    target.removeItem(CHECKOUT_PENDING_STORAGE_KEY);
    return target.getItem(CHECKOUT_PENDING_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * HTTP classification only: a 2xx still needs a valid order confirmation body.
 * Missing/malformed confirmations, timeouts and transport errors stay uncertain.
 * @param {number|undefined|null} status
 * @returns {"success"|"definite-error"|"uncertain"}
 */
export function classifyCheckoutResponse(status) {
  if (Number.isInteger(status) && status >= 200 && status < 300) return "success";
  if (Number.isInteger(status) && status >= 400 && status < 500 && status !== 408 && status !== 429) return "definite-error";
  return "uncertain";
}

/**
 * Removes the quantities confirmed by a replay, leaving additions made later.
 * Duplicate cart or request lines are handled cumulatively without mutation.
 * @template {{book: {id: string}, quantity: number}} T
 * @param {T[]} cart
 * @param {Array<{productId: string, quantity: number}>} submittedItems
 * @returns {T[]}
 */
export function subtractOrderedItems(cart, submittedItems) {
  const remaining = new Map();
  for (const item of submittedItems) {
    if (typeof item.productId !== "string" || !Number.isSafeInteger(item.quantity) || item.quantity < 1) continue;
    remaining.set(item.productId, (remaining.get(item.productId) ?? 0) + item.quantity);
  }
  return cart.flatMap(line => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) return [line];
    const ordered = remaining.get(line.book.id) ?? 0;
    if (ordered === 0) return [line];
    const removed = Math.min(line.quantity, ordered);
    remaining.set(line.book.id, ordered - removed);
    const quantity = line.quantity - removed;
    return quantity > 0 ? [{ ...line, quantity }] : [];
  });
}
