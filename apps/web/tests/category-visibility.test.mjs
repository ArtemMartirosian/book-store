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
const labels = {
  hy: "Աքսեսուարներ գրքասերների համար",
  ru: "Аксессуары для книголюбов",
  en: "Accessories for booklovers",
};
const category = (id, parent = null, name = id, locale = "en") => ({
  id: "category-" + id, supplierCategoryId: id, parentSupplierCategoryId: parent, name, locale, productCount: 1,
});
const fixtures = (locale) => [
  category("7463", null, "Catalog root", locale),
  category("7480", "7463", labels[locale], locale),
  category("future-child", "7480", "Hidden future child", locale),
  category("7481", "7463", "Visible fiction", locale),
];
const apiBook = {
  id: "real-book", slug: "real-book", title: "A real edition", author: "Author", description: "Description",
  language: "en", locale: "en", price: { amount: 5700, currency: "AMD" }, imageUrls: [],
  availability: "PRELIMINARY_AVAILABLE", observedAt: "2026-10-21T10:00:00Z", isNew: true,
};

// Run the real modules and components. Only framework navigation/context and effects are deterministic.
function modules(locale = "en", statefulComponent = null) {
  const cache = new Map();
  const states = [];
  let stateIndex = 0;
  let effects = [];
  const context = { locale, cartCount: 0, favorites: [], isFavorite: () => false, toggleFavorite() {}, addToCart() {} };
  const statefulReact = {
    ...React,
    useContext: () => context,
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) {
        const value = typeof initial === "function" ? initial() : initial;
        // Header's first two states are its mobile and desktop catalog toggles.
        states[index] = statefulComponent === "StorefrontShell" && index < 2 ? true : value;
      }
      return [states[index], next => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useEffect(callback) { effects.push(callback); },
  };
  function load(relativePath) {
    const filename = path.join(root, relativePath);
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = specifier => {
      if (specifier === "server-only") return {};
      if (specifier === "react" && statefulComponent && filename.endsWith("/" + statefulComponent + ".tsx")) return statefulReact;
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
      if (specifier === "next/navigation") return {
        useRouter: () => ({ refresh() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => `/${locale}/catalog`,
      };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); } };
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(path.relative(root, resolved));
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const source = readFileSync(filename, "utf8") + (filename.endsWith("/StorefrontShell.tsx") ? "\nexport { Header as TestHeader };" : "");
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return {
    load,
    get effects() { return effects; },
    render(component, props = {}) {
      stateIndex = 0;
      effects = [];
      return renderToStaticMarkup(React.createElement(component, props));
    },
  };
}

function assertHidden(html, locale) {
  assert.ok(!html.includes(labels[locale]), locale + ": hidden category label is not rendered");
  assert.doesNotMatch(html, /(?:category=|value=")(?:7480|future-child)(?:["&]|$)/u);
  assert.ok(!html.includes("Hidden future child"));
}

test("category visibility uses stable supplier IDs in every locale, not translated label matching", () => {
  const { visibleStorefrontCategories } = modules().load("app/lib/storefront-categories.ts");
  for (const locale of ["hy", "ru", "en"]) {
    const renamedBlocked = category("7480", "7463", "Renamed category", locale);
    const sameNameSibling = category("unrelated", "7463", labels[locale], locale);
    assert.deepEqual(visibleStorefrontCategories([renamedBlocked, sameNameSibling]), [sameNameSibling]);
    assert.deepEqual(visibleStorefrontCategories(fixtures(locale)).map(item => item.supplierCategoryId), ["7463", "7481"]);
  }
});

test("unordered descendants are hidden recursively without mutating inputs or reordering visible siblings", () => {
  const { visibleStorefrontCategories } = modules().load("app/lib/storefront-categories.ts");
  const first = Object.freeze(category("visible-first", "7463"));
  const last = Object.freeze(category("visible-last", "7463"));
  const input = Object.freeze([
    first,
    Object.freeze(category("grandchild", "child")),
    Object.freeze(category("child", "7480")),
    Object.freeze(category("7480", "7463")),
    last,
  ]);
  const result = visibleStorefrontCategories(input);
  assert.deepEqual(result, [first, last]);
  assert.equal(result[0], first);
  assert.equal(result[1], last);
  assert.equal(input.length, 5);
  assert.notEqual(result, input);
  assert.deepEqual(visibleStorefrontCategories([]), []);
  assert.deepEqual(visibleStorefrontCategories([category("orphan", "unknown")]).map(item => item.supplierCategoryId), ["orphan"]);
});

test("book mapping removes hidden category metadata without dropping the book, price or stock status", () => {
  const { mapCatalogBook } = modules().load("app/lib/catalog-api.ts");
  for (const locale of ["hy", "ru", "en"]) {
    const input = { ...apiBook, locale, categories: fixtures(locale).slice(1, 3) };
    const original = structuredClone(input);
    const mapped = mapCatalogBook(input);
    assert.equal(mapped.id, input.id);
    assert.equal(mapped.price, 5700);
    assert.equal(mapped.availability, "observed");
    assert.equal(mapped.category, { hy: "Գրքեր", ru: "Книги", en: "Books" }[locale]);
    assert.deepEqual(mapped.categories, []);
    assert.deepEqual(input, original);
    const visible = fixtures(locale).at(-1);
    const mixed = mapCatalogBook({ ...input, categories: [...input.categories, visible] });
    assert.equal(mixed.category, visible.name);
    assert.deepEqual(mixed.categories, [visible]);
    assert.equal(mapCatalogBook({ ...input, availability: "OUT_OF_STOCK" }).availability, "unavailable");
  }
});

test("server category, catalog and book-detail reads filter public metadata while retaining actual products", async (t) => {
  for (const locale of ["hy", "ru", "en"]) {
    const api = modules(locale).load("app/lib/server-catalog-api.ts");
    const categories = fixtures(locale);
    const item = { ...apiBook, locale, categories };
    const mock = t.mock.method(globalThis, "fetch", async url => {
      const pathname = new URL(url).pathname;
      if (pathname.endsWith("/categories")) return Response.json(categories);
      if (pathname.includes("/by-slug/")) return Response.json(item);
      return Response.json({ items: [item], total: 1, offset: 0, limit: 24 });
    });
    try {
      assert.deepEqual((await api.getServerCategories(locale)).map(value => value.supplierCategoryId), ["7463", "7481"]);
      const catalog = await api.getServerCatalog({ locale });
      assert.equal(catalog.total, 1);
      assert.equal(catalog.items[0].id, item.id);
      assert.equal(catalog.items[0].price, item.price.amount);
      assert.deepEqual(catalog.items[0].categories.map(value => value.supplierCategoryId), ["7463", "7481"]);
      assert.equal((await api.getServerBookBySlug(item.slug, locale)).category, "Visible fiction");
    } finally { mock.mock.restore(); }
  }
});

test("homepage featured sections and catalog's initial dropdown do not revive categories from product metadata", () => {
  for (const locale of ["hy", "ru", "en"]) {
    const h = modules(locale);
    const { mapCatalogBook } = h.load("app/lib/catalog-api.ts");
    const categories = fixtures(locale);
    const book = mapCatalogBook({ ...apiBook, locale, categories });
    const HomePage = h.load("app/components/storefront/HomePage.tsx").HomePage;
    // The raw category metadata deliberately models a saved/legacy product, not only freshly mapped data.
    const home = h.render(HomePage, { books: [{ ...book, categories }], categories });
    assertHidden(home, locale);
    assert.ok(home.includes(`href="/${locale}/catalog?category=7481`));
    assert.ok(home.includes(`href="/${locale}/books/${book.slug}"`));
    const CatalogPage = h.load("app/components/storefront/CatalogPage.tsx").CatalogPage;
    const catalog = h.render(CatalogPage, { initialData: { items: [book], total: 1 }, initialCategories: categories });
    assertHidden(catalog, locale);
    assert.match(catalog, /<option value="7481">Visible fiction<\/option>/u);
    assert.ok(catalog.includes(`href="/${locale}/books/${book.slug}"`));
  }
});

test("refreshed categories remain hidden in desktop catalog, mobile tree, header search and catalog filters", async (t) => {
  for (const locale of ["hy", "ru", "en"]) {
    for (const name of ["StorefrontShell", "CatalogPage"]) {
      const h = modules(locale, name);
      const exports = h.load("app/components/storefront/" + name + ".tsx");
      const Component = name === "StorefrontShell" ? exports.TestHeader : exports.CatalogPage;
      const props = name === "StorefrontShell" ? {} : { initialData: { items: [], total: 0 }, initialCategories: [] };
      h.render(Component, props);
      const categoryEffect = h.effects[0];
      assert.equal(typeof categoryEffect, "function");
      const mock = t.mock.method(globalThis, "fetch", async url => {
        assert.ok(String(url).includes("/catalog/categories?locale=" + locale));
        return Response.json(fixtures(locale));
      });
      let cleanup;
      try {
        cleanup = categoryEffect();
        await new Promise(resolve => setImmediate(resolve));
        const html = h.render(Component, props);
        assertHidden(html, locale);
        if (name === "StorefrontShell") {
          assert.ok(html.includes('id="desktop-catalog-menu"'));
          assert.ok(html.includes('id="mobile-navigation-menu"'));
          assert.ok(html.includes(`href="/${locale}/catalog?category=7481"`));
          assert.match(html, /<option value="7481">Visible fiction<\/option>/u);
        } else assert.match(html, /<option value="7481">Visible fiction<\/option>/u);
      } finally { cleanup?.(); mock.mock.restore(); }
    }
  }
});
