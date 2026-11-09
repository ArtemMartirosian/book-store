import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return "data:text/javascript;base64," + Buffer.from(outputText).toString("base64");
}

const [serverSource, apiSource, categoriesSource] = await Promise.all(
  ["server-home-showcase.ts", "catalog-api.ts", "storefront-categories.ts"].map(file =>
    readFile(new URL("../app/lib/" + file, import.meta.url), "utf8")),
);
const categoriesUrl = moduleUrl(categoriesSource);
const apiUrl = moduleUrl(apiSource.replace('from "./storefront-categories"', 'from "' + categoriesUrl + '"'));
const { createHomeShowcaseReader } = await import(moduleUrl(serverSource.replace('import "server-only";', "")
  .replace('from "./catalog-api"', 'from "' + apiUrl + '"')
  .replace('from "./storefront-categories"', 'from "' + categoriesUrl + '"')));

const category = (id, parentSupplierCategoryId = null) => ({ id, supplierCategoryId: id, parentSupplierCategoryId, name: id, locale: "en" });
const edition = (id, extra = {}) => ({
  id, slug: id, title: `Edition ${id}`, author: "Author", publisher: "Publisher", locale: "en", language: "en",
  isNew: false, availability: "PRELIMINARY_AVAILABLE", coverImageUrl: "https://example.com/cover.jpg",
  categoryIds: ["7464", "hidden-child"], price: { amount: 5700, currency: "AMD" }, observedAt: "2026-09-15T10:00:00Z", ...extra,
});
const raw = {
  books: [edition("recent")], newBooks: [edition("new", { isNew: true })],
  affordableBooks: [edition("offer", { coverImageUrl: null })],
  categories: [category("7463"), category("7464", "7463"), category("7480", "7463"), category("hidden-child", "7480")],
  categoryPreviews: [
    { categoryId: "7464", books: [edition("department")] },
    { categoryId: "7480", books: [edition("hidden")] },
  ],
};
const empty = { books: [], categories: [], newBooks: [], affordableBooks: [], categoryPreviews: [] };

test("a cold homepage makes one public request and maps its compact localized shelves without leaking hidden categories", async (t) => {
  t.mock.method(AbortSignal, "timeout", milliseconds => {
    assert.equal(milliseconds, 5_000);
    return new AbortController().signal;
  });
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/v1/catalog/showcase");
    assert.equal(new URL(url).searchParams.get("locale"), "en");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers, undefined);
    return Response.json(raw);
  });
  const result = await createHomeShowcaseReader()("en");
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal(result.stale, false);
  assert.equal(result.books[0].price, 5700);
  assert.equal(result.books[0].coverImageUrl, "https://example.com/cover.jpg");
  assert.deepEqual(result.books[0].categories.map(({ supplierCategoryId }) => supplierCategoryId), ["7464"]);
  assert.deepEqual(result.categories.map(({ supplierCategoryId }) => supplierCategoryId), ["7463", "7464"]);
  assert.deepEqual(result.categoryPreviews.map(({ categoryId }) => categoryId), ["7464"]);
  assert.equal(result.newBooks[0].isNew, true);
  assert.equal(result.affordableBooks[0].coverImageUrl, null);
});

test("same-language requests share one pending read and reuse it for at most 60 seconds", async () => {
  let now = 0;
  const pending = new Map();
  const requests = [];
  const read = createHomeShowcaseReader(locale => new Promise(resolve => {
    requests.push(locale);
    pending.set(locale, resolve);
  }), () => now);

  const first = read("en");
  assert.equal(read("en"), first);
  const armenian = read("hy");
  await Promise.resolve();
  assert.deepEqual(requests, ["en", "hy"]);
  pending.get("en")({ ...empty, categories: [category("en-data")] });
  pending.get("hy")({ ...empty, categories: [category("hy-data")] });
  assert.equal((await first).categories[0].id, "en-data");
  assert.equal((await armenian).categories[0].id, "hy-data");

  now = 59_999;
  assert.equal((await read("en")).categories[0].id, "en-data");
  assert.deepEqual(requests, ["en", "hy"]);
  now = 60_000;
  const refreshed = read("en");
  await Promise.resolve();
  assert.deepEqual(requests, ["en", "hy", "en"]);
  pending.get("en")({ ...empty, categories: [category("new-en-data")] });
  assert.equal((await refreshed).categories[0].id, "new-en-data");
});

test("a failed refresh retains only a bounded last-good snapshot and backs off briefly", async () => {
  let now = 0;
  let calls = 0;
  let fail = false;
  const read = createHomeShowcaseReader(async () => {
    calls++;
    if (fail) throw new Error("Catalog is down");
    return empty;
  }, () => now);

  assert.deepEqual(await read("ru"), { ...empty, stale: false });
  fail = true;
  now = 60_000;
  assert.deepEqual(await read("ru"), { ...empty, stale: true });
  now += 9_999;
  assert.equal((await read("ru")).stale, true);
  assert.equal(calls, 2);
  now = 299_999;
  assert.equal((await read("ru")).stale, true);
  now = 300_000;
  await assert.rejects(read("ru"), /Catalog is down/u);
  await assert.rejects(read("hy"), /Catalog is down/u);
  fail = false;
  assert.equal((await read("ru")).stale, false);
});

test("a slow failed refresh cannot serve data whose stale limit passed while waiting", async () => {
  let now = 0;
  let rejectRefresh;
  const read = createHomeShowcaseReader(() => {
    if (now === 0) return Promise.resolve(empty);
    return new Promise((_, reject) => { rejectRefresh = reject; });
  }, () => now);
  await read("hy");
  now = 299_000;
  const error = assert.rejects(read("hy"), /Timeout/u);
  await Promise.resolve();
  now = 301_000;
  rejectRefresh(new Error("Timeout"));
  await error;
});

test("HTTP, malformed and oversized responses are errors rather than cached empty shelves", async (t) => {
  const read = createHomeShowcaseReader();
  const replies = [
    new Response(null, { status: 503 }),
    Response.json({ ...empty, newBooks: undefined }),
    Response.json({ ...empty, books: [edition("broken", { price: { amount: "5700", currency: "AMD" } })] }),
    Response.json({ ...empty, books: Array.from({ length: 25 }, (_, index) => edition(String(index))) }),
    Response.json(empty),
  ];
  const fetch = t.mock.method(globalThis, "fetch", async () => replies.shift());
  await assert.rejects(read("en"), /returned 503/u);
  for (let index = 0; index < 3; index++) await assert.rejects(read("en"), /invalid showcase/u);
  assert.deepEqual(await read("en"), { ...empty, stale: false });
  assert.deepEqual(await read("en"), { ...empty, stale: false });
  assert.equal(fetch.mock.callCount(), 5);
});
