export const adminRequestTimeoutMs = 10_000;

const receiptPattern = /^[\p{L}\p{N}._/-]+$/u;
const cancellableOrderStatuses = new Set([
  "REQUEST_RECEIVED",
  "CUSTOMER_CONFIRMED",
  "PROCUREMENT_PENDING",
  "SUPPLIER_CONFIRMED",
  "READY_FOR_DELIVERY",
]);

export function normalizeAdminApiBase(value, origin, expectedPath = "/api/v1") {
  const input = String(value ?? "").trim();
  const safeExpectedPath = String(expectedPath || "/api/v1").replace(/\/+$/u, "") || "/api/v1";

  if (!input || input.startsWith("//") || /(?:^|\/)\.{1,2}(?:\/|$)/u.test(input) || /%2e/iu.test(input)) {
    throw new Error("UNSAFE_ADMIN_API_BASE");
  }

  let pageOrigin;
  let parsed;
  try {
    pageOrigin = new URL(origin).origin;
    parsed = new URL(input, pageOrigin);
  } catch {
    throw new Error("UNSAFE_ADMIN_API_BASE");
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/u, "") || "/";
  if (
    !["http:", "https:"].includes(parsed.protocol)
    || parsed.origin !== pageOrigin
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash
    || normalizedPath !== safeExpectedPath
  ) {
    throw new Error("UNSAFE_ADMIN_API_BASE");
  }

  return safeExpectedPath;
}

export function basicAuthorization(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export function requestHeaders(path, credentials, hasBody = false) {
  const headers = { accept: "application/json" };
  if (hasBody) headers["content-type"] = "application/json";
  if (String(path).startsWith("/admin/")) {
    headers.authorization = basicAuthorization(credentials.username, credentials.password);
  }
  return headers;
}

export function normalizeReceiptNumber(value) {
  const normalized = String(value ?? "").trim();
  if (normalized.length < 3 || normalized.length > 100 || !receiptPattern.test(normalized)) return null;
  return normalized;
}

export function isAuthorizationStatus(status) {
  return status === 401 || status === 403;
}

export function isOrderCancellable(status) {
  return cancellableOrderStatuses.has(status);
}

export function procurementActionVisibility(task, orders) {
  const orderStatus = orders.find((order) => order.id === task.orderId)?.status;
  const pendingOrConfirmed = task.status === "PENDING_OPERATOR" || task.status === "SUPPLIER_CONFIRMED";

  return {
    canConfirm: task.status === "PENDING_OPERATOR" && orderStatus === "PROCUREMENT_PENDING",
    canCancel: (
      pendingOrConfirmed
    && isOrderCancellable(orderStatus)
    ),
  };
}
