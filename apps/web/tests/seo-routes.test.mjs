import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import path from "node:path";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const nativeRequire = createRequire(import.meta.url);
// This test worker models the published production origin. Preview mode is tested below.
process.env.SITE_INDEXING_ENABLED = "true";
const book = {
  id: "book-1", slug: "book-1", title: "A real edition", author: "Author",
  description: "A real catalog description.", category: "Books", language: "English",
  price: 5700, sourcePrice: 5200, availability: "observed", observedAt: "2026-09-24T10:00:00Z",
  accent: "mint", coverLabel: "A real edition", isbn: "978-0-14-044913-6", publisher: "Publisher",
  pages: 250, year: 2024, productCode: "REAL-123", coverImageUrl: "https://images.example.com/book.jpg",
  availableLocales: ["hy", "en"], fallbackLocale: "hy",
};

function modules({ locale = "hy", search = "", api = {}, cacheFactory } = {}) {
  const cache = new Map();
  const context = { locale, favorites: [], isFavorite: () => false, addToCart() {}, toggleFavorite() {} };
  const serverApi = {
    getServerBookBySlug: async () => book,
    getServerCatalog: async () => ({ items: [book], total: 100, offset: 0, limit: 24 }),
    getServerCategories: async () => [],
    ...api,
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "react" && cacheFactory) return { ...React, cache: cacheFactory };
      if (specifier.endsWith("/server-catalog-api")) return serverApi;
      // eslint-disable-next-line react/prop-types -- Minimal server-render test double, not an application component.
      if (specifier.endsWith("/StorefrontShell")) return { StorefrontShell: ({ children }) => React.createElement("main", {}, children), useStorefront: () => context };
      if (specifier === "server-only") return {};
      if (specifier === "next/navigation") return {
        notFound() { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); },
        useSearchParams: () => new URLSearchParams(search), usePathname: () => `/${locale}/catalog`,
      };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } };
      if (specifier.startsWith(".")) {
        const target = path.resolve(path.dirname(filename), specifier);
        const resolved = [target, target + ".ts", target + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return (filename) => load(path.join(root, filename));
}

test("JSON-LD serialization cannot close the script element, even with hostile catalog text", () => {
  const { serializeJsonLd } = modules()("app/lib/structured-data.ts");
  const hostile = { title: '</script><script>alert("x")</script>&\u2028\u2029' };
  const serialized = serializeJsonLd(hostile);
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/u);
  assert.deepEqual(JSON.parse(serialized), hostile);
});

test("book structured data uses real AMD selling price and never invents stock or reviews", () => {
  const { bookSchema } = modules()("app/lib/structured-data.ts");
  for (const availability of ["observed", "reserved", "unavailable"]) {
    const schema = bookSchema({ ...book, availability, rating: 5, reviews: 500 }, "hy");
    assert.deepEqual(schema["@type"], ["Product", "Book"]);
    assert.equal(schema.offers.price, 5700);
    assert.equal(schema.offers.priceCurrency, "AMD");
    assert.equal(schema.offers.availability, availability === "unavailable" ? "https://schema.org/OutOfStock" : undefined);
    assert.equal(schema.aggregateRating, undefined);
    assert.equal(schema.review, undefined);
    assert.equal(schema.offers.priceValidUntil, undefined);
    assert.equal(schema.isbn, "9780140449136");
    assert.equal(schema.inLanguage, "en");
    assert.match(schema.url, /\/hy\/books\/book-1$/u);
  }
});

test("optional schema fields do not invent missing or invalid bibliographic data", () => {
  const { bookSchema, bookImageUrls } = modules()("app/lib/structured-data.ts");
  const schema = bookSchema({ ...book, isbn: "9780140449137", pages: -2, year: 0, price: NaN, author: "", publisher: "", coverImageUrl: null, imageUrls: [] }, "en");
  for (const key of ["isbn", "numberOfPages", "datePublished", "offers", "author", "publisher", "image"]) assert.equal(schema[key], undefined);
  assert.deepEqual(bookImageUrls({ ...book, coverImageUrl: "javascript:alert(1)", imageUrls: ["data:image/svg+xml,<svg />", "https://images.example.com/book.jpg", "https://images.example.com/book.jpg"] }), ["https://images.example.com/book.jpg"]);
});

test("home schema describes the online brand without fabricated contact, address or social proof", () => {
  const load = modules();
  const { homeSchema } = load("app/lib/structured-data.ts");
  const { SITE_URL } = load("app/lib/brand.ts");
  for (const locale of ["hy", "ru", "en"]) {
    const [store, website] = homeSchema(locale)["@graph"];
    assert.equal(store["@type"], "OnlineStore");
    assert.equal(store.name, "Գրքասեր");
    assert.equal(store.url, SITE_URL);
    for (const key of ["address", "telephone", "sameAs", "aggregateRating", "openingHours"]) assert.equal(store[key], undefined);
    assert.equal(website["@type"], "WebSite");
    assert.deepEqual(website.inLanguage, ["hy", "ru", "en"]);
  }
});

test("private and search routes consistently emit noindex metadata in all three languages", async () => {
  const load = modules();
  for (const locale of ["hy", "ru", "en"]) {
    for (const name of ["account", "cart", "favorites", "search"]) {
      const route = load(`app/[locale]/${name}/page.tsx`);
      const metadata = await route.generateMetadata({ params: Promise.resolve({ locale }) });
      assert.equal(metadata.robots.index, false, `${locale}/${name}`);
      assert.equal(metadata.openGraph.description, metadata.description);
      assert.equal(metadata.twitter.description, metadata.description);
      assert.doesNotMatch(JSON.stringify(metadata), /LUMI/u);
    }
  }
});

test("catalog pagination is self-canonical; faceted and search variants are noindex", async () => {
  const route = modules()("app/[locale]/catalog/page.tsx");
  const get = (query) => route.generateMetadata({ params: Promise.resolve({ locale: "ru" }), searchParams: Promise.resolve(query) });
  const base = await get({});
  assert.match(String(base.alternates.canonical), /\/ru\/catalog$/u);
  assert.notEqual(base.robots?.index, false);
  const page2 = await get({ page: "2", utm_source: "campaign" });
  assert.match(String(page2.alternates.canonical), /\/ru\/catalog\?page=2$/u);
  assert.match(JSON.stringify(page2.title), /Страница 2/u);
  assert.notEqual(page2.robots?.index, false);
  for (const query of [{ q: "test" }, { author: "Author" }, { publisher: "Publisher" }, { series: "Series" }, { minPrice: "0" }, { maxPrice: "5000" }, { hasCover: "true" }, { hasCover: "false" }, { isNew: "false" }, { isNew: "true" }, { language: "hy" }, { category: "123" }, { sort: "price-asc" }, { available: "all" }]) {
    assert.equal((await get(query)).robots.index, false, JSON.stringify(query));
  }
  assert.match(String((await get({ page: "garbage" })).alternates.canonical), /\/ru\/catalog$/u);
});

test("public route metadata remains noindex when production indexing is not enabled", async () => {
  const previous = process.env.SITE_INDEXING_ENABLED;
  process.env.SITE_INDEXING_ENABLED = "false";
  try {
    const load = modules();
    for (const name of ["", "catalog/", "contacts/", "information/", "books/[slug]/"]) {
      const route = load(`app/[locale]/${name}page.tsx`);
      const metadata = await route.generateMetadata({ params: Promise.resolve({ locale: "hy", slug: book.slug }), searchParams: Promise.resolve({}) });
      assert.equal(metadata.robots.index, false, name);
    }
  } finally { process.env.SITE_INDEXING_ENABLED = previous; }
});

test("product metadata uses its own book cover and links only available translations", async () => {
  const route = modules()("app/[locale]/books/[slug]/page.tsx");
  const metadata = await route.generateMetadata({ params: Promise.resolve({ locale: "hy", slug: book.slug }) });
  assert.match(JSON.stringify(metadata.title), /A real edition/u);
  assert.match(JSON.stringify(metadata.openGraph.images), /images\.example\.com\/book\.jpg/u);
  assert.match(String(metadata.alternates.canonical), /\/hy\/books\/book-1$/u);
  assert.equal(metadata.alternates.languages.ru, undefined);
  assert.ok(metadata.alternates.languages.hy);
  assert.ok(metadata.alternates.languages.en);
  assert.match(String(metadata.alternates.languages["x-default"]), /\/hy\/books\/book-1$/u);
});

test("an untranslated product UI URL is noindex and canonicalizes the actual API fallback", async () => {
  for (const data of [
    { ...book, availableLocales: ["hy", "en"], fallbackLocale: "en" },
    { ...book, availableLocales: [], fallbackLocale: "en" },
  ]) {
    const load = modules({ api: { getServerBookBySlug: async () => data } });
    const metadata = await load("app/[locale]/books/[slug]/page.tsx").generateMetadata({ params: Promise.resolve({ locale: "ru", slug: data.slug }) });
    assert.equal(metadata.robots.index, false);
    assert.match(String(metadata.alternates.canonical), /\/en\/books\/book-1$/u);
    assert.match(String(metadata.openGraph.url), /\/en\/books\/book-1$/u);
    assert.equal(metadata.alternates.languages.ru, undefined);
    assert.ok(metadata.alternates.languages.en);
    const actualLocales = [...new Set([...data.availableLocales, data.fallbackLocale])];
    assert.deepEqual(Object.keys(metadata.alternates.languages).sort(), [...actualLocales, "x-default"].sort());
    // The sitemap and HTML expose the same genuine translations.
    const xml = load("app/lib/sitemap-data.ts").renderBooksSitemap([data]);
    for (const locale of ["hy", "ru", "en"]) {
      assert.equal(xml.includes(`hreflang="${locale}"`), Boolean(metadata.alternates.languages[locale]));
    }
  }
});

test("legacy base-language books are indexable only in the actual fallback locale", async () => {
  const route = modules({ api: { getServerBookBySlug: async () => ({ ...book, availableLocales: [], fallbackLocale: "ru" }) } })("app/[locale]/books/[slug]/page.tsx");
  const metadata = await route.generateMetadata({ params: Promise.resolve({ locale: "ru", slug: book.slug }) });
  assert.equal(metadata.robots.index, true);
  assert.deepEqual(Object.keys(metadata.alternates.languages).sort(), ["ru", "x-default"]);
});

test("catalog mapping preserves the API fallback locale separately from the requested UI language", () => {
  const { mapCatalogBook } = modules()("app/lib/catalog-api.ts");
  const response = { ...book, language: "en", locale: "hy", fallbackLocale: "en", price: { amount: 5700, currency: "AMD" } };
  assert.equal(mapCatalogBook(response).fallbackLocale, "en");
  assert.equal(mapCatalogBook({ ...response, fallbackLocale: undefined }).fallbackLocale, "hy");
});

test("general pages retain all three hreflangs while explicit translation lists never grow fake entries", () => {
  const { localeAlternates } = modules()("app/components/storefront/locale-seo.ts");
  assert.deepEqual(Object.keys(localeAlternates("ru", "/catalog").languages).sort(), ["en", "hy", "ru", "x-default"]);
  const limited = localeAlternates("ru", "/books/real", ["en"]);
  assert.deepEqual(Object.keys(limited.languages).sort(), ["en", "x-default"]);
  assert.match(String(limited.canonical), /\/en\/books\/real$/u);
  assert.deepEqual(localeAlternates("ru", "/books/unknown", []).languages, {});
});

test("book metadata and HTML share one request-scoped cache wrapper, without storing prices across requests", async () => {
  let reads = 0;
  const api = { getServerBookBySlug: async () => ({ ...book, price: 5700 + ++reads }) };
  for (let request = 1; request <= 2; request += 1) {
    // Model React's per-server-request cache dispatcher; do not install a process-global cache.
    const cacheFactory = (fn) => {
      const entries = new Map();
      return (...args) => {
        const key = JSON.stringify(args);
        if (!entries.has(key)) entries.set(key, fn(...args));
        return entries.get(key);
      };
    };
    const route = modules({ api, cacheFactory })("app/[locale]/books/[slug]/page.tsx");
    const args = { params: Promise.resolve({ locale: "hy", slug: book.slug }) };
    await route.generateMetadata(args);
    const page = await route.default(args);
    const [product] = JSON.parse(page.props.children[0].props.dangerouslySetInnerHTML.__html);
    assert.equal(reads, request);
    assert.equal(product.offers.price, 5700 + request);
  }
});

test("product 404 stays a 404 but backend outages are propagated, never disguised as missing books", async () => {
  for (const method of ["generateMetadata", "default"]) {
    const missing = modules({ api: { getServerBookBySlug: async () => null } })("app/[locale]/books/[slug]/page.tsx");
    await assert.rejects(missing[method]({ params: Promise.resolve({ locale: "hy", slug: "missing" }) }), /NEXT_HTTP_ERROR_FALLBACK;404/u);
    const outage = modules({ api: { getServerBookBySlug: async () => { throw new Error("Catalog API returned 503"); } } })("app/[locale]/books/[slug]/page.tsx");
    await assert.rejects(outage[method]({ params: Promise.resolve({ locale: "hy", slug: "existing" }) }), /Catalog API returned 503/u);
  }
});

test("catalog HTML includes books and crawlable pagination links before client JavaScript runs", async () => {
  const requests = [];
  const load = modules({ locale: "en", search: "page=2", api: { getServerCatalog: async (query) => { requests.push(query); return { items: [book], total: 100, offset: 24, limit: 24 }; } } });
  const page = await load("app/[locale]/catalog/page.tsx").default({ params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve({ page: "2" }) });
  const html = renderToStaticMarkup(page);
  assert.equal(requests[0].offset, 24);
  assert.equal(requests[0].limit, 24);
  assert.match(html, /href="\/en\/books\/book-1"/u);
  assert.match(html, /href="\/en\/catalog\?page=3"/u);
  assert.match(html, /href="\/en\/catalog"/u);
  assert.match(html, /aria-current="page"/u);
  assert.doesNotMatch(html, /Loading books/u);
});

test("out-of-range catalog pages return 404 and API outages stay errors", async () => {
  const args = { params: Promise.resolve({ locale: "hy" }), searchParams: Promise.resolve({ page: "9" }) };
  const missing = modules({ api: { getServerCatalog: async () => ({ items: [], total: 1, offset: 192, limit: 24 }) } })("app/[locale]/catalog/page.tsx");
  await assert.rejects(missing.default(args), /NEXT_HTTP_ERROR_FALLBACK;404/u);
  const outage = modules({ api: { getServerCatalog: async () => { throw new Error("Timeout"); } } })("app/[locale]/catalog/page.tsx");
  await assert.rejects(outage.default(args), /Timeout/u);
});

test("catalog facets reach SSR, accessible controls and page links without losing zero or false", async () => {
  const filters = { publisher: "Զանգակ", author: "Author", series: "Classics", minPrice: "0", maxPrice: "6500", hasCover: "true", isNew: "false", page: "2" };
  const requests = [];
  const load = modules({ locale: "en", search: new URLSearchParams(filters).toString(), api: { getServerCatalog: async (query) => { requests.push(query); return { items: [book], total: 100, offset: 24, limit: 24 }; } } });
  const route = load("app/[locale]/catalog/page.tsx");
  const args = { params: Promise.resolve({ locale: "en" }), searchParams: Promise.resolve(filters) };
  const html = renderToStaticMarkup(await route.default(args));
  assert.equal(requests[0].publisher, "Զանգակ");
  assert.equal(requests[0].author, "Author");
  assert.equal(requests[0].series, "Classics");
  assert.equal(requests[0].minPrice, 0);
  assert.equal(requests[0].maxPrice, 6500);
  assert.equal(requests[0].hasCover, true);
  assert.equal(requests[0].isNew, false);
  assert.match(html, /name="minPrice"[^>]*value="0"/u);
  assert.match(html, /name="publisher"[^>]*value="Զանգակ"/u);
  assert.match(html, /hasCover=true&amp;isNew=false&amp;page=3/u);
  assert.match(html, /With cover image/u);
  assert.match(html, /New arrivals only/u);
  const metadata = await route.generateMetadata(args);
  assert.equal(metadata.robots.index, false);
  assert.match(metadata.alternates.canonical, /hasCover=true&isNew=false&page=2$/u);
  const { catalogQueryString } = load("app/lib/catalog-api.ts");
  const apiQuery = new URLSearchParams(catalogQueryString(requests[0]));
  for (const key of Object.keys(filters).filter((key) => key !== "page")) assert.equal(apiQuery.get(key), filters[key]);
});
