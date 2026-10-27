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
const edition = Object.freeze({
  id: "existing-edition", slug: "existing-edition", title: "An existing edition", author: "An author",
  description: "A real catalog description.", category: "Books", language: "English", price: 5700,
  availability: "observed", observedAt: "2026-09-24T10:00:00Z", accent: "violet", coverLabel: "An existing edition",
  isbn: "9780140449136", pages: 250, publisher: "A publisher", categories: [],
});

// Real components and markup; effects never run and no browser or API is used.
function components(locale) {
  const loaded = new Map();
  const context = {
    locale, customer: null, customerLoaded: true,
    cart: [{ book: edition, quantity: 1 }], cartCount: 1, cartSubtotal: edition.price,
    favorites: [], notice: "", isFavorite: () => false,
    addToCart() {}, toggleFavorite() {}, setQuantity() {}, removeFromCart() {}, clearCart() {}, completeCheckout() {},
  };
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
      if (specifier === "react" && filename.endsWith("/CartPage.tsx")) return {
        ...React,
        // CartPage's pendingLoaded is its sole boolean state initializer. Show
        // the normal checkout without running local-storage or network effects.
        useState: (initial) => React.useState(initial === false ? true : initial),
      };
      if (specifier === "next/navigation") return {
        usePathname: () => `/${locale}/catalog`, useSearchParams: () => new URLSearchParams(),
      };
      if (specifier === "next/link") return {
        __esModule: true,
        default: ({ children, prefetch, ...props }) => { void prefetch; return React.createElement("a", props, children); },
      };
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
    component: (name) => load(path.join(root, "app/components/storefront", name + ".tsx"))[name],
    module: (relativePath) => load(path.join(root, relativePath)),
    dictionary: load(path.join(root, "app/components/storefront/i18n.ts")).dictionary[locale],
  };
}

const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props));
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/gu)].map(([, name, value]) => [name.toLowerCase(), value]));

test("desktop and mobile header search omit ISBN in every visible and accessible input hint", () => {
  for (const locale of locales) {
    const h = components(locale);
    for (const mobile of [false, true]) {
      const html = render(h.component("HeaderSearch"), { locale, mobile });
      const input = [...html.matchAll(/<input\b[^>]*>/gu)].map(([tag]) => attributes(tag)).find((item) => item.name === "q");
      assert.ok(input, `${locale}/${mobile}: search input is retained`);
      assert.doesNotMatch(input.placeholder, /isbn/iu);
      assert.doesNotMatch(input["aria-label"], /isbn/iu);
      assert.equal(input.placeholder, mobile ? h.dictionary.header.mobileSearch : h.dictionary.header.search);
      assert.equal(input["aria-label"], h.dictionary.header.search);
      assert.equal(input.role, "combobox");
      assert.equal(input["aria-autocomplete"], "list");
      assert.equal(input.maxlength, "120");
      assert.match(html, new RegExp(`action="/${locale}/catalog"`, "u"));
      assert.match(html, /method="get"/u);
    }
  }
});

test("book pages omit the cash-payment mini block but retain delivery, price, ISBN and purchase controls", () => {
  for (const locale of locales) {
    const h = components(locale);
    const t = h.dictionary.product;
    const formatAmd = h.module("app/lib/catalog-data.ts").formatAmd;
    for (const availability of ["observed", "unavailable"]) {
      const book = Object.freeze({ ...edition, availability });
      const html = render(h.component("BookDetailsPage"), { book, related: [] });
      assert.ok(!html.includes(t.pay), `${locale}/${availability}: removed payment title`);
      assert.ok(!html.includes(t.payHint), `${locale}/${availability}: removed payment hint`);
      const purchasePanel = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/u)?.[1];
      assert.ok(purchasePanel);
      assert.ok(purchasePanel.includes(t.delivery), `${locale}: delivery title remains`);
      assert.ok(purchasePanel.includes(t.deliveryHint), `${locale}: delivery hint remains`);
      assert.ok(purchasePanel.includes(formatAmd(edition.price)), `${locale}: price is unchanged`);
      assert.ok(purchasePanel.includes(availability === "unavailable" ? t.unavailableButton : t.add));
      assert.match(html, />ISBN<\/dt>/u, "ISBN remains an actual book specification");
      assert.ok(html.includes(edition.isbn));
      assert.equal(book.isbn, edition.isbn);
      assert.equal(book.price, edition.price);
    }
  }
});

test("ISBN remains available in advanced book search instead of being removed from catalog data", () => {
  for (const locale of locales) {
    const h = components(locale);
    const html = render(h.component("AdvancedSearchPage"));
    const isbnLabel = [...html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gu)].map(([label]) => label).find((label) => label.includes(">ISBN</span>"));
    assert.ok(isbnLabel, `${locale}: ISBN field remains available`);
    assert.equal(attributes(isbnLabel.match(/<input\b[^>]*>/u)[0]).maxlength, "128");
    assert.equal(edition.isbn, "9780140449136");
  }
});

test("checkout still explains cash on delivery while only the book-page promotion is removed", () => {
  for (const locale of locales) {
    const h = components(locale);
    const html = render(h.component("CartPage"));
    assert.ok(html.includes(h.dictionary.cart.payment), `${locale}: checkout payment section remains`);
    assert.ok(html.includes(h.dictionary.cart.onDelivery), `${locale}: actual cash payment option remains`);
    assert.ok(html.includes(h.dictionary.cart.onDeliveryHint), `${locale}: checkout guidance remains`);
    assert.ok(html.includes(h.module("app/lib/catalog-data.ts").formatAmd(1000)), `${locale}: delivery fee remains 1,000 AMD`);
  }
});
