import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return "data:text/javascript;base64," + Buffer.from(outputText).toString("base64");
}

const source = (path) => readFile(new URL(path, import.meta.url), "utf8");
const brandUrl = moduleUrl(await source("../app/lib/brand.ts"));
const sitemapUrl = moduleUrl((await source("../app/lib/sitemap-data.ts")).replace('from "./brand"', `from "${brandUrl}"`));
const serverUrl = moduleUrl((await source("../app/lib/server-sitemap.ts")).replace('import "server-only";', "").replace('from "./sitemap-data"', `from "${sitemapUrl}"`));
const sitemap = await import(sitemapUrl);
const server = await import(serverUrl);
const index = await import(moduleUrl((await source("../app/sitemap.xml/route.ts"))
  .replace('from "../lib/brand"', `from "${brandUrl}"`)
  .replace('from "../lib/server-sitemap"', `from "${serverUrl}"`)
  .replace('from "../lib/sitemap-data"', `from "${sitemapUrl}"`)));
const shards = await import(moduleUrl((await source("../app/sitemaps/[file]/route.ts"))
  .replace('from "../../lib/brand"', `from "${brandUrl}"`)
  .replace('from "../../lib/server-sitemap"', `from "${serverUrl}"`)
  .replace('from "../../lib/sitemap-data"', `from "${sitemapUrl}"`)));
const robots = await import(moduleUrl((await source("../app/robots.ts")).replace('from "./lib/brand"', `from "${brandUrl}"`)));

const book = { id: "real-1", slug: "Գիրք & книга / one", availableLocales: ["hy", "ru"], fallbackLocale: "hy", availability: "OUT_OF_STOCK", observedAt: "2026-01-02" };

test("library helpers never use Next.js reserved metadata route filenames", async () => {
  const files = await readdir(new URL("../app/lib/", import.meta.url), { recursive: true });
  const reserved = /(?:^|\/)(?:sitemap|robots|manifest|icon|apple-icon|opengraph-image|twitter-image)\.(?:[cm]?[jt]sx?|xml|txt|webmanifest)$/u;
  assert.deepEqual(files.filter((file) => reserved.test(file)), []);
});
const callShard = (file) => shards.GET(new Request("https://grqaser.am/sitemaps/" + file), { params: Promise.resolve({ file }) });
function enableIndexing(t, enabled = true) {
  const previous = process.env.SITE_INDEXING_ENABLED;
  process.env.SITE_INDEXING_ENABLED = String(enabled);
  t.after(() => {
    if (previous === undefined) delete process.env.SITE_INDEXING_ENABLED;
    else process.env.SITE_INDEXING_ENABLED = previous;
  });
}

test("sitemap index covers a catalog beyond 50,000 URLs without walking its pages", () => {
  const xml = sitemap.renderSitemapIndex(100_001);
  assert.equal((xml.match(/<sitemap>/gu) || []).length, 1002);
  assert.ok(xml.includes("https://grqaser.am/sitemaps/books-1000.xml"));
  assert.ok(xml.includes("https://grqaser.am/sitemaps/static.xml"));
  assert.ok(!xml.includes("<lastmod>"));
  assert.equal(sitemap.sitemapShardCount(4_999_900), 49_999);
  assert.throws(() => sitemap.renderSitemapIndex(4_999_901), /capacity exceeded/u);
  assert.throws(() => sitemap.renderSitemapIndex(-1), /Invalid/u);
  assert.throws(() => sitemap.renderSitemapIndex(Number.MAX_VALUE), /Invalid/u);
});

test("empty catalog still has a static sitemap but does not invent products", () => {
  const xml = sitemap.renderSitemapIndex(0);
  assert.equal((xml.match(/<sitemap>/gu) || []).length, 1);
  assert.ok(!xml.includes("books-0"));
});

test("static sitemap includes only translated public landing pages", () => {
  const xml = sitemap.renderStaticSitemap();
  assert.equal((xml.match(/<url>/gu) || []).length, 24);
  for (const locale of ["hy", "ru", "en"]) {
    for (const path of ["", "/catalog", "/contacts", "/information", "/journal", "/journal/book-gift", "/journal/reading-habit", "/journal/choose-edition"]) assert.ok(xml.includes(`<loc>https://grqaser.am/${locale}${path}</loc>`));
  }
  for (const path of ["admin", "account", "cart", "favorites", "search", "?category="]) assert.ok(!xml.includes(path));
  assert.ok(xml.includes('hreflang="x-default" href="https://grqaser.am/hy"'));
});

test("book sitemap uses real translations, escapes Unicode slugs, retains out-of-stock pages, omits observation timestamps", () => {
  const xml = sitemap.renderBooksSitemap([book]);
  assert.equal((xml.match(/<url>/gu) || []).length, 2);
  assert.ok(xml.includes(`<loc>https://grqaser.am/hy/books/${encodeURIComponent(book.slug)}</loc>`));
  assert.ok(xml.includes('hreflang="ru"'));
  assert.ok(!xml.includes('hreflang="en"'));
  assert.ok(!xml.includes("/en/books/"));
  assert.ok(!xml.includes("<lastmod>"));
  assert.ok(!xml.includes("2026-01-02"));
  assert.equal(sitemap.escapeXml('<>&"\''), "&lt;&gt;&amp;&quot;&apos;");
});

test("legacy books with no translation map use only their genuine base locale", () => {
  const xml = sitemap.renderBooksSitemap([{ ...book, availableLocales: [], fallbackLocale: "ru" }]);
  assert.equal((xml.match(/<url>/gu) || []).length, 1);
  assert.ok(xml.includes("/ru/books/"));
  assert.ok(!xml.includes("/hy/books/"));
  assert.ok(xml.includes('hreflang="x-default" href="https://grqaser.am/ru/books/'));
  assert.throws(() => sitemap.renderBooksSitemap(Array.from({ length: 101 }, () => book)), /too large/u);
});

test("catalog validation rejects partial, duplicate and malformed upstream pages", () => {
  const body = { items: [book], total: 1, offset: 0, limit: 100 };
  assert.deepEqual(sitemap.validateSitemapCatalog(body, 0, 100), body);
  for (const invalid of [null, {}, { ...body, total: -1 }, { ...body, offset: 1 }, { ...body, limit: 24 }, { ...body, total: 2 }, { ...body, items: [] }, { ...body, total: 2, items: [book, book] }, { ...body, items: [{ ...book, fallbackLocale: "fr" }] }, { ...body, items: [{ ...book, availableLocales: ["xx"] }] }, { ...body, items: [{ ...book, slug: " " }] }]) {
    assert.throws(() => sitemap.validateSitemapCatalog(invalid, 0, 100));
  }
});

test("index route fetches only the total probe and returns 503 instead of an empty successful sitemap on failure", async (t) => {
  enableIndexing(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    const query = new URL(url).searchParams;
    assert.equal(query.get("offset"), "0");
    assert.equal(query.get("limit"), "1");
    assert.equal(query.get("sort"), "title");
    assert.equal(query.has("available"), false);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json({ items: [book], total: 100_001, offset: 0, limit: 1 });
  });
  const response = await index.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.ok((await response.text()).includes("books-1000.xml"));
  assert.equal(fetch.mock.callCount(), 1);
  fetch.mock.mockImplementation(async () => new Response(null, { status: 502 }));
  const failed = await index.GET();
  assert.equal(failed.status, 503);
  assert.equal(failed.headers.get("retry-after"), "300");
  assert.equal(failed.headers.get("cache-control"), "no-store");
  assert.ok(!(await failed.text()).includes("sitemapindex"));
});

test("shards perform one bounded read, reject invalid names and missing pages, and do not hide partial errors", async (t) => {
  enableIndexing(t);
  const fetch = t.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(new URL(url).searchParams.get("offset"), "100");
    assert.equal(new URL(url).searchParams.get("limit"), "100");
    return Response.json({ items: [book], total: 101, offset: 100, limit: 100 });
  });
  const response = await callShard("books-1.xml");
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("<url>"));
  assert.equal(fetch.mock.callCount(), 1);
  for (const invalid of ["books-01.xml", "books--1.xml", "books-1.5.xml", "books-49999.xml", "books-9999999999999999.xml", "anything.xml"]) assert.equal((await callShard(invalid)).status, 404);
  assert.equal(fetch.mock.callCount(), 1);
  assert.equal((await callShard("static.xml")).status, 200);
  assert.equal(fetch.mock.callCount(), 1);
  fetch.mock.mockImplementation(async () => Response.json({ items: [], total: 100, offset: 100, limit: 100 }));
  assert.equal((await callShard("books-1.xml")).status, 404);
  fetch.mock.mockImplementation(async () => Response.json({ items: [], total: 101, offset: 100, limit: 100 }));
  assert.equal((await callShard("books-1.xml")).status, 503);
  fetch.mock.mockImplementation(async () => { throw new DOMException("Timeout", "TimeoutError"); });
  assert.equal((await callShard("books-1.xml")).status, 503);
});

test("disabled indexing returns 404 without API reads and blocks crawl during prelaunch", async (t) => {
  enableIndexing(t, false);
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("Should not fetch"); });
  for (const response of [await index.GET(), await callShard("static.xml"), await callShard("books-0.xml")]) {
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("x-robots-tag"), "noindex");
  }
  assert.equal(fetch.mock.callCount(), 0);
  assert.deepEqual(robots.default(), { rules: [{ userAgent: "*", disallow: "/" }] });
});

test("production robots exposes sitemap without blocking HTML noindex directives on private/search pages", (t) => {
  enableIndexing(t);
  const config = robots.default();
  assert.equal(config.sitemap, "https://grqaser.am/sitemap.xml");
  assert.deepEqual(config.rules, [{ userAgent: "*", allow: "/", disallow: "/api/" }]);
});

test("server sitemap applies a 10-second timeout and surfaces malformed bodies", async (t) => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, "timeout", (duration) => { assert.equal(duration, 10_000); return controller.signal; });
  const fetch = t.mock.method(globalThis, "fetch", async (_, options) => {
    assert.equal(options.signal, controller.signal);
    return Response.json({ items: [], total: 0, offset: 0, limit: 1 });
  });
  assert.deepEqual(await server.getSitemapCatalog(0, 1), { items: [], total: 0, offset: 0, limit: 1 });
  fetch.mock.mockImplementation(async () => new Response("not-json"));
  await assert.rejects(server.getSitemapCatalog(0, 1), SyntaxError);
});
