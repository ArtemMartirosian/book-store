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
const locales = ["hy", "ru", "en"];
const edition = {
  id: "verified-edition", slug: "verified-edition", title: "An actual edition", author: "An actual author",
  description: "An actual catalog description.", category: "Books", language: "English", price: 5700,
  availability: "observed", observedAt: "2026-09-24T10:00:00Z", accent: "violet", coverLabel: "An actual edition",
  isbn: "9780140449136", pages: 250, publisher: "An actual publisher", categories: [],
};

// Render the real TSX; only Next routing and the context used by leaf components are test doubles.
function components(locale) {
  const cache = new Map();
  const context = { locale, cartCount: 0, favorites: [], isFavorite: () => false, addToCart() {}, toggleFavorite() {} };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
      if (specifier === "next/navigation") return { useSearchParams: () => new URLSearchParams(), usePathname: () => `/${locale}/catalog` };
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
  return {
    component: (name, exportName = name) => load(path.join(root, "app/components/storefront", name + ".tsx"))[exportName],
    module: (relativePath) => load(path.join(root, relativePath)),
    dictionary: load(path.join(root, "app/components/storefront/i18n.ts")).dictionary[locale],
  };
}

function render(Component, props) {
  return renderToStaticMarkup(React.createElement(Component, props));
}

function tagWith(html, tag, attribute, value) {
  const candidate = [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "gu"))].map(([tagText]) => tagText).find((tagText) => tagText.includes(`${attribute}="${value}"`));
  assert.ok(candidate, `${tag}[${attribute}="${value}"] must exist`);
  return candidate;
}

test("localized logo uses a compact modern sans wordmark without hiding its real text", () => {
  const names = { hy: "Գրքասեր", ru: "Гркасер", en: "Grqaser" };
  const labels = { hy: "Գրախանութ", ru: "Книжный магазин", en: "Bookstore" };
  for (const locale of locales) {
    const Logo = components(locale).component("StorefrontShell", "Logo");
    for (const inverse of [false, true]) {
      const html = render(Logo, { locale, inverse });
      const wordmark = [...html.matchAll(/<span\b[^>]*>[^<]*<\/span>/gu)].map(([span]) => span).find((span) => span.includes(`>${names[locale]}</span>`));
      assert.ok(wordmark, "The brand name remains accessible localized HTML text");
      for (const className of ["font-sans", "font-bold", "text-[20px]", "sm:text-[30px]", "whitespace-nowrap"]) assert.ok(wordmark.includes(className));
      assert.doesNotMatch(wordmark, /font-serif|font-display|sr-only|hidden|truncate/u);
      assert.ok(html.includes(`>${labels[locale]}</span>`));
      const mark = tagWith(html, "img", "aria-hidden", "true");
      assert.ok(mark.includes('alt=""'));
      assert.ok(mark.includes('width="44"') && mark.includes('height="44"'));
      assert.ok(mark.includes("size-7") && mark.includes("sm:size-11"));
    }
  }
});

test("installable app palette matches the purple storefront without changing its identity or start route", () => {
  const manifest = components("hy").module("app/manifest.ts").default();
  assert.equal(manifest.theme_color, "#6258ff");
  assert.equal(manifest.background_color, "#f7f8fc");
  assert.equal(manifest.name, "Գրքասեր · Grqaser");
  assert.equal(manifest.short_name, "Գրքասեր");
  assert.equal(manifest.lang, "hy");
  assert.equal(manifest.start_url, "/hy");
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
});

test("book card and related-product links encode every slug as one route segment", () => {
  for (const locale of locales) {
    const { component } = components(locale);
    const Card = component("BookCard");
    const Product = component("BookDetailsPage");
    for (const slug of ["Գիրք / special?edition#1&author", "already%2Fencoded", "two words"]) {
      const book = { ...edition, slug };
      const expected = `/${locale}/books/${encodeURIComponent(slug)}`;
      const card = render(Card, { book });
      assert.deepEqual([...card.matchAll(/href="([^"]+)"/gu)].map(([, href]) => href), [expected, expected]);
      const product = render(Product, { book: edition, related: [book] });
      assert.ok(product.includes(`href="${expected}"`));
    }
  }
});

test("new-release badges require the real boolean flag on both cards and product pages", () => {
  for (const locale of locales) {
    const { component, dictionary } = components(locale);
    for (const name of ["BookCard", "BookDetailsPage"]) {
      const Component = component(name);
      for (const isNew of [undefined, null, false, true]) {
        const html = render(Component, { book: { ...edition, isNew, badge: "Bestseller" }, related: [] });
        const badge = [...html.matchAll(/<span\b[^>]*>([^<]*)<\/span>/gu)].some(([, text]) => text === dictionary.header.new);
        assert.equal(badge, isNew === true, `${locale}/${name}/${String(isNew)}`);
        assert.ok(!html.includes("Bestseller"), "legacy display badges cannot invent a ranking");
      }
    }
  }
});

test("unverified rating and review fields never become storefront social proof", () => {
  for (const locale of locales) {
    const { component } = components(locale);
    for (const name of ["BookCard", "BookDetailsPage"]) {
      const html = render(component(name), { book: { ...edition, rating: 4.98765, reviews: 987654 }, related: [] });
      assert.doesNotMatch(html, /4\.98765|987654|★|aggregateRating/u);
    }
  }
});

test("product tabs have linked accessible panels and a single initial keyboard tab stop", () => {
  for (const locale of locales) {
    const { component } = components(locale);
    const html = render(component("BookDetailsPage"), { book: edition, related: [] });
    assert.equal([...html.matchAll(/role="tablist"/gu)].length, 1);
    assert.equal([...html.matchAll(/role="tab"/gu)].length, 2);
    for (const tab of ["description", "specifications"]) {
      const selected = tab === "description";
      const button = tagWith(html, "button", "id", `book-tab-${tab}`);
      assert.ok(button.includes('role="tab"'));
      assert.ok(button.includes(`aria-controls="book-panel-${tab}"`));
      assert.ok(button.includes(`aria-selected="${selected}"`));
      assert.ok(button.includes(`tabindex="${selected ? 0 : -1}"`));
      const panel = tagWith(html, "div", "id", `book-panel-${tab}`);
      assert.ok(panel.includes('role="tabpanel"'));
      assert.ok(panel.includes(`aria-labelledby="book-tab-${tab}"`));
      assert.equal(panel.includes('hidden=""'), !selected);
    }
    assert.ok(html.includes(edition.description));
    assert.ok(html.includes(edition.publisher));
    assert.ok(html.includes(edition.isbn));
  }
});

test("quantity starts at one with descriptive localized controls and unavailable purchase stays disabled", () => {
  const labels = {
    hy: { decrease: "Նվազեցնել քանակը", increase: "Ավելացնել քանակը", quantity: "Քանակ" },
    ru: { decrease: "Уменьшить количество", increase: "Увеличить количество", quantity: "Количество" },
    en: { decrease: "Decrease quantity", increase: "Increase quantity", quantity: "Quantity" },
  };
  for (const locale of locales) {
    const { component, dictionary } = components(locale);
    const Product = component("BookDetailsPage");
    const html = render(Product, { book: edition, related: [] });
    assert.ok(tagWith(html, "button", "aria-label", labels[locale].decrease).includes('disabled=""'));
    assert.ok(!tagWith(html, "button", "aria-label", labels[locale].increase).includes('disabled=""'));
    assert.ok(html.includes(`aria-label="${labels[locale].quantity}">1</output>`));
    assert.doesNotMatch(html, /aria-label="[+-]"/u);
    const unavailable = render(Product, { book: { ...edition, availability: "unavailable" }, related: [] });
    const purchaseButtons = [...unavailable.matchAll(/(<button\b[^>]*>)([\s\S]*?)<\/button>/gu)].filter(([, , content]) => content.includes(dictionary.product.unavailableButton));
    assert.equal(purchaseButtons.length, 2, "desktop and mobile purchase controls remain present");
    for (const [, button] of purchaseButtons) assert.ok(button.includes('disabled=""'));
  }
});

test("shell navigation uses actual localized routes and bounded search inputs", () => {
  for (const locale of locales) {
    const { component } = components(locale);
    const html = render(component("StorefrontShell"), { locale, children: React.createElement("p", {}, "Page content") });
    for (const route of ["/catalog", "/catalog?isNew=true", "/catalog?sort=price-asc", "/catalog?language=hy", "/catalog?language=ru", "/catalog?language=en", "/information#about", "/information#delivery", "/information#faq", "/journal", "/contacts", "/search", "/account", "/favorites", "/cart"]) {
      assert.ok(html.includes(`href="/${locale}${route}"`), `${locale}${route}`);
    }
    assert.ok(html.includes(`href="/${locale}#publishers"`));
    assert.doesNotMatch(html, /href="#(?:news|about)"|sort=popular|\?new=true|LUMI/u);
    const searches = [...html.matchAll(/<input\b[^>]*name="q"[^>]*>/gu)];
    assert.equal(searches.length, 2);
    for (const [input] of searches) assert.ok(input.includes('maxLength="120"'));
    assert.ok(html.includes('aria-controls="desktop-catalog-menu"'));
    assert.ok(html.includes('aria-controls="mobile-navigation-menu"'));
  }
});

test("author links encode filters, invalid check dates stay hidden, and empty related sections stay absent", () => {
  for (const locale of locales) {
    const { component, dictionary } = components(locale);
    const author = "Writer / անուն & Имя?";
    const html = render(component("BookDetailsPage"), { book: { ...edition, author, observedAt: "invalid-observation-date" }, related: [] });
    assert.ok(html.includes(`href="/${locale}/catalog?author=${encodeURIComponent(author)}"`));
    assert.ok(!html.includes("invalid-observation-date"));
    assert.ok(!html.includes(dictionary.product.lastCheck + ":"));
    assert.ok(!html.includes(dictionary.product.continue));
  }
});

test("real covers keep their title, native proportions and intentional loading priority", () => {
  const { component } = components("en");
  const Cover = component("BookCover");
  for (const size of ["mini", "card", "hero", "detail"]) {
    const html = render(Cover, { book: { ...edition, coverImageUrl: "https://images.example.com/edition.jpg" }, size });
    const image = tagWith(html, "img", "alt", edition.title);
    assert.ok(image.includes("object-contain"));
    assert.ok(image.includes('decoding="async"'));
    assert.ok(image.includes(`loading="${["mini", "card"].includes(size) ? "lazy" : "eager"}"`));
    assert.equal(image.includes('fetchPriority="high"'), size === "detail");
  }
  const fallback = render(Cover, { book: edition });
  assert.ok(fallback.includes(edition.title));
  assert.doesNotMatch(fallback, /<img\b/u);
});
