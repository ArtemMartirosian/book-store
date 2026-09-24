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
const navItems = ["home", "catalog", "favorites", "cart", "account"];
const navLabels = {
  hy: { home: "Գլխավոր", catalog: "Գրքեր", favorites: "Սիրված", cart: "Զամբյուղ", account: "Իմ էջը" },
  ru: { home: "Главная", catalog: "Каталог", favorites: "Избранное", cart: "Корзина", account: "Кабинет" },
  en: { home: "Home", catalog: "Catalog", favorites: "Favorites", cart: "Cart", account: "Account" },
};
const book = {
  id: "real-edition", slug: "real-edition", title: "A real edition", author: "An author", description: "An actual description.",
  category: "Books", language: "English", price: 5700, availability: "observed", observedAt: "2026-09-24T10:00:00Z", accent: "violet", coverLabel: "A real edition",
};

// Real TSX and SSR. Context/navigation are deterministic; effects and requests never run.
function harness(locale) {
  const cache = new Map();
  const runtime = { pathname: `/${locale}`, hydrateCart: false };
  const context = {
    locale, cartCount: 0, cartSubtotal: 0, cart: [], favorites: [], notice: "",
    addToCart() {}, setQuantity() {}, removeFromCart() {}, clearCart() {}, completeCheckout() {}, toggleFavorite() {}, isFavorite: () => false,
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      // The exported nav calls useStorefront inside this module, so a direct module mock would miss it.
      if (specifier === "react" && filename.endsWith("/StorefrontShell.tsx")) return { ...React, useContext: () => context };
      if (specifier === "react" && filename.endsWith("/CartPage.tsx")) return {
        ...React,
        // CartPage's sole boolean initializer is pendingLoaded. Model the completed local-storage check,
        // without installing window/localStorage, running effects or creating an order.
        useState: (initial) => React.useState(runtime.hydrateCart && initial === false ? true : initial),
      };
      if (specifier === "next/navigation") return { usePathname: () => runtime.pathname, useSearchParams: () => new URLSearchParams() };
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
  const shell = load(path.join(root, "app/components/storefront/StorefrontShell.tsx"));
  return {
    context, runtime, shell,
    component: (name) => load(path.join(root, "app/components/storefront", name + ".tsx"))[name],
    module: (relativePath) => load(path.join(root, relativePath)),
    nav: () => renderToStaticMarkup(React.createElement(shell.MobileBottomNavigation)),
  };
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/gu)].map(([, name, value]) => [name.toLowerCase(), value]));
}

function links(html) {
  return [...html.matchAll(/(<a\b[^>]*>)([\s\S]*?)<\/a>/gu)]
    .map(([, tag, body]) => ({ ...attributes(tag), body }))
    .filter((link) => link["data-nav-item"]);
}

function visualBadges(link) {
  return [...link.body.matchAll(/(<(?:span|b)\b[^>]*>)(\d+\+?)<\/(?:span|b)>/gu)]
    .map(([, tag, text]) => ({ ...attributes(tag), text })).filter((badge) => badge["data-nav-badge"]);
}

function badgeIsHiddenFromAssistiveTechnology(link) {
  const ancestors = [];
  for (const [tag] of link.body.matchAll(/<\/?span\b[^>]*>/gu)) {
    if (tag.startsWith("</")) { ancestors.pop(); continue; }
    const attrs = attributes(tag);
    const hidden = attrs["aria-hidden"] === "true" || ancestors.includes(true);
    if (attrs["data-nav-badge"]) return hidden;
    ancestors.push(hidden);
  }
  return false;
}

test("mobile navigation renders five actual localized links and is hidden from tablet/desktop layout", () => {
  for (const locale of locales) {
    const h = harness(locale);
    const html = h.nav();
    const nav = [...html.matchAll(/<nav\b[^>]*>/gu)].map(([tag]) => attributes(tag)).find((tag) => tag["data-testid"] === "mobile-bottom-navigation");
    assert.ok(nav, "A semantic navigation landmark must identify the mobile tabs");
    assert.ok(nav["aria-label"]?.trim());
    assert.ok(nav.class?.split(/\s/u).includes("md:hidden"));
    const items = links(html);
    assert.deepEqual(items.map((item) => item["data-nav-item"]), navItems);
    const labels = navLabels[locale];
    for (const item of items) {
      const key = item["data-nav-item"];
      assert.equal(item.href, `/${locale}${key === "home" ? "" : "/" + key}`);
      assert.ok(item.body.includes(`>${labels[key]}</span>`), `${locale}/${key} needs visible localized text`);
      assert.ok(item["aria-label"]?.includes(labels[key]), `${locale}/${key} needs a localized accessible name`);
    }
  }
});

test("active navigation follows exact routes and includes books and advanced search under catalog", () => {
  for (const locale of locales) {
    const h = harness(locale);
    const cases = [
      ["", "home"], ["/", "home"], ["/catalog", "catalog"], ["/catalog/", "catalog"],
      ["/catalog/fiction", "catalog"], ["/books/actual-edition", "catalog"], ["/search", "catalog"],
      ["/favorites", "favorites"], ["/cart", "cart"], ["/account", "account"],
      ["/account/orders", "account"],
      ["/information", null], ["/contacts", null], ["/journal/book-gift", null],
      ["/catalogue", null], ["/bookshelf", null], ["/searchable", null],
      ["/favorites-old", null], ["/cartoon", null], ["/accounting", null],
    ];
    for (const [suffix, expected] of cases) {
      h.runtime.pathname = `/${locale}${suffix}`;
      const active = links(h.nav()).filter((link) => link["aria-current"] === "page");
      assert.deepEqual(active.map((link) => link["data-nav-item"]), expected ? [expected] : [], h.runtime.pathname);
    }
    for (const pathname of ["/admin", "/admin/catalog", "/" + locale + "-other/catalog", `/${locale === "en" ? "ru" : "en"}/cart`]) {
      h.runtime.pathname = pathname;
      assert.deepEqual(links(h.nav()).filter((link) => link["aria-current"] === "page"), [], pathname);
    }
  }
});

test("cart shows item quantity rather than distinct lines and favorites have an independent count", () => {
  for (const locale of locales) {
    const h = harness(locale);
    h.context.cart = [{ book, quantity: 4 }, { book: { ...book, id: "second" }, quantity: 3 }];
    h.context.cartCount = 7;
    h.context.favorites = [{ id: "saved-1" }, { id: "saved-2" }];
    const items = links(h.nav());
    for (const [key, count] of [["cart", 7], ["favorites", 2]]) {
      const item = items.find((entry) => entry["data-nav-item"] === key);
      assert.ok(item["aria-label"].includes(String(count)));
      assert.deepEqual(visualBadges(item).map((badge) => badge.text), [String(count)]);
      assert.equal(visualBadges(item)[0]["data-nav-badge"], key);
      assert.ok(badgeIsHiddenFromAssistiveTechnology(item), "Visual badges must not duplicate the accessible count");
    }
    for (const item of items.filter((entry) => !["cart", "favorites"].includes(entry["data-nav-item"]))) assert.deepEqual(visualBadges(item), []);
  }
});

test("visual badges cap at 99+ while accessible names keep exact counts, and zero badges stay absent", () => {
  for (const locale of locales) {
    const h = harness(locale);
    for (const count of [0, 1, 99, 100, 137]) {
      h.context.cartCount = count;
      h.context.favorites = Array.from({ length: count }, (_, index) => ({ id: `saved-${index}` }));
      for (const item of links(h.nav()).filter((entry) => ["cart", "favorites"].includes(entry["data-nav-item"]))) {
        const label = navLabels[locale][item["data-nav-item"]];
        assert.equal(item["aria-label"], count ? `${label}: ${count}` : label, "Accessible labels preserve actual positive counts; empty lists keep their plain label");
        assert.ok(!item["aria-label"].includes("99+"), "Accessible labels must not announce the visual cap");
        assert.deepEqual(visualBadges(item).map((badge) => badge.text), count ? [count > 99 ? "99+" : String(count)] : []);
      }
    }
  }
});

test("storefront shell includes one mobile navigation but the real admin page does not", () => {
  for (const locale of locales) {
    const h = harness(locale);
    for (const pathname of [`/${locale}`, `/${locale}/favorites`, `/${locale}/cart`, `/${locale}/account`]) {
      h.runtime.pathname = pathname;
      const html = renderToStaticMarkup(React.createElement(h.shell.StorefrontShell, { locale }, React.createElement("p", {}, "Storefront content")));
      assert.equal([...html.matchAll(/data-testid="mobile-bottom-navigation"/gu)].length, 1, pathname);
    }
  }
  const h = harness("ru");
  h.runtime.pathname = "/admin";
  const AdminPage = h.module("app/admin/page.tsx").default;
  const admin = renderToStaticMarkup(React.createElement(AdminPage));
  assert.doesNotMatch(admin, /data-testid="mobile-bottom-navigation"|data-nav-item=/u);
});

test("real product and hydrated cart renders opt their fixed action bars into the mobile-nav offset", () => {
  for (const locale of locales) {
    const h = harness(locale);
    h.context.cart = [{ book, quantity: 2 }];
    h.context.cartCount = 2;
    h.runtime.hydrateCart = true;
    const renders = [
      ["product", renderToStaticMarkup(React.createElement(h.component("BookDetailsPage"), { book, related: [] }))],
      ["cart", renderToStaticMarkup(React.createElement(h.component("CartPage")))],
    ];
    for (const [name, html] of renders) {
      const bars = [...html.matchAll(/<div\b[^>]*>/gu)].map(([tag]) => attributes(tag)).filter((tag) => tag.class?.split(/\s/u).includes("storefront-bottom-action"));
      assert.equal(bars.length, 1, `${locale}/${name} needs exactly one offset action bar`);
      assert.ok(bars[0].class.split(/\s/u).includes("fixed"));
      assert.equal(bars[0]["data-sticky-action"], name === "product" ? "book" : "cart");
      assert.ok(!bars[0].class.split(/\s/u).includes("bottom-0"), "The shared offset must control action-bar placement");
    }
  }
});
