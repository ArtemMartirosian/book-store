import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return "data:text/javascript;base64," + Buffer.from(outputText).toString("base64");
}

const clientSource = await readFile(new URL("../app/lib/catalog-api.ts", import.meta.url), "utf8");
const serverSource = await readFile(new URL("../app/lib/server-catalog-api.ts", import.meta.url), "utf8");
// Only the server-only build marker is omitted; execute the real fetch/validation/mapping code.
const api = await import(moduleUrl(serverSource.replace('import "server-only";', "").replace('from "./catalog-api"', 'from "' + moduleUrl(clientSource) + '"')));

const book = {
  id: "real-book", slug: "real-book", title: "Book", author: "Author", description: "Description",
  language: "en", locale: "ru", price: { amount: 5700, currency: "AMD" }, categories: [], imageUrls: [],
  availability: "PRELIMINARY_AVAILABLE", observedAt: "2026-09-15T10:00:00Z",
};
const category = { id: "category", supplierCategoryId: "7481", name: "Books" };
const endpoints = [
  { name: "catalog", call: () => api.getServerCatalog({ locale: "ru", available: true, limit: 24 }), body: { items: [book], total: 1, offset: 0, limit: 24 }, path: "/api/v1/catalog/books" },
  { name: "categories", call: () => api.getServerCategories("hy"), body: [category], path: "/api/v1/catalog/categories" },
  { name: "book detail", call: () => api.getServerBookBySlug("book / with spaces", "en"), body: book, path: "/api/v1/catalog/books/by-slug/book%20%2F%20with%20spaces" },
];

function mockTimeout(t) {
  const controllers = [];
  t.mock.method(AbortSignal, "timeout", (duration) => {
    assert.equal(duration, 10_000);
    const controller = new AbortController();
    controllers.push(controller);
    return controller.signal;
  });
  return controllers;
}

function waitForAbort(signal) {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}

for (const endpoint of endpoints) {
  test(`${endpoint.name}: sends a 10-second abort signal without changing no-store or URL handling`, async (t) => {
    const controllers = mockTimeout(t);
    t.mock.method(globalThis, "fetch", async (url, options) => {
      assert.equal(new URL(url).pathname, endpoint.path);
      assert.equal(options.cache, "no-store");
      assert.equal(options.signal, controllers.at(-1).signal);
      assert.equal(options.signal.aborted, false);
      return Response.json(endpoint.body);
    });
    const result = await endpoint.call();
    assert.equal(controllers.length, 1);
    if (endpoint.name === "catalog") assert.equal(result.items[0].price, 5700);
    else if (endpoint.name === "book detail") assert.equal(result.price, 5700);
    else assert.deepEqual(result, [category]);
  });

  test(`${endpoint.name}: a stalled fetch rejects when its timeout signal aborts`, async (t) => {
    const controllers = mockTimeout(t);
    t.mock.method(globalThis, "fetch", (_, options) => waitForAbort(options.signal));
    const pending = endpoint.call();
    const rejection = assert.rejects(pending, { name: "TimeoutError" });
    controllers[0].abort(new DOMException("The catalog request timed out", "TimeoutError"));
    await rejection;
  });

  test(`${endpoint.name}: timeout also aborts a stalled JSON body after headers arrived`, async (t) => {
    const controllers = mockTimeout(t);
    let bodyStarted;
    const reading = new Promise((resolve) => { bodyStarted = resolve; });
    t.mock.method(globalThis, "fetch", async (_, options) => ({
      ok: true, status: 200,
      json() { bodyStarted(); return waitForAbort(options.signal); },
    }));
    const pending = endpoint.call();
    const rejection = assert.rejects(pending, { name: "TimeoutError" });
    await reading;
    controllers[0].abort(new DOMException("The catalog body timed out", "TimeoutError"));
    await rejection;
  });

  test(`${endpoint.name}: preserves HTTP and malformed JSON errors`, async (t) => {
    mockTimeout(t);
    const fetch = t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 503 }));
    await assert.rejects(endpoint.call(), /Catalog API returned 503/u);
    fetch.mock.mockImplementation(async () => new Response("not-json", { status: 200 }));
    await assert.rejects(endpoint.call(), SyntaxError);
    fetch.mock.mockImplementation(async () => Response.json({ invalid: true }));
    await assert.rejects(endpoint.call(), /Catalog API returned (?:an invalid response|invalid categories|an invalid book)/u);
  });
}

test("a book 404 still returns null without reading its body; catalog/category 404 remain errors", async (t) => {
  mockTimeout(t);
  t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 404, json() { throw new Error("A 404 body must not be read"); } }));
  assert.equal(await api.getServerBookBySlug("missing", "ru"), null);
  await assert.rejects(api.getServerCatalog({ locale: "ru" }), /Catalog API returned 404/u);
  await assert.rejects(api.getServerCategories("ru"), /Catalog API returned 404/u);
});

test("concurrent server requests have independent timeout signals", async (t) => {
  const controllers = mockTimeout(t);
  let finishCatalog;
  t.mock.method(globalThis, "fetch", (_, options) => {
    if (controllers.length === 1) return new Promise((resolve) => { finishCatalog = resolve; });
    return waitForAbort(options.signal);
  });
  const catalog = api.getServerCatalog({ locale: "ru" });
  const categories = api.getServerCategories("ru");
  const rejectedCategories = assert.rejects(categories, { name: "TimeoutError" });
  controllers[1].abort(new DOMException("Timeout", "TimeoutError"));
  assert.equal(controllers[0].signal.aborted, false);
  finishCatalog(Response.json({ items: [book], total: 1, offset: 0, limit: 24 }));
  assert.equal((await catalog).items[0].id, book.id);
  await rejectedCategories;
});
