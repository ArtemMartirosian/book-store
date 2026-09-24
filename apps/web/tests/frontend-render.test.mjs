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

// Render the real components; replace only the app context and Next navigation.
function components(locale, search = "", reactOverride) {
  const cache = new Map();
  const context = { locale, cartCount: 2, favorites: [{ id: "saved" }], isFavorite: () => false, toggleFavorite() {}, addToCart() {} };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "react" && reactOverride) return reactOverride;
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
      if (specifier === "next/navigation") return { useRouter: () => ({ refresh() {} }), useSearchParams: () => new URLSearchParams(search), usePathname: () => `/${locale}/catalog` };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const source = readFileSync(filename, "utf8");
    const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return (name, exportName = name) => load(path.join(root, "app/components/storefront", name + ".tsx"))[exportName];
}

const book = { id: "real-book", slug: "real-edition", title: "A real catalog edition", author: "Test author", category: "Books", language: "English", price: 5700, availability: "observed", observedAt: "2026-09-15T10:00:00Z", accent: "violet", coverLabel: "Real edition", description: "Description", categories: [] };

test("Grqaser logo keeps localized names as real text next to a decorative generated mark", () => {
  const names = { hy: "Գրքասեր", ru: "Гркасер", en: "Grqaser" };
  const labels = { hy: "Գրախանութ", ru: "Книжный магазин", en: "Bookstore" };
  for (const locale of ["hy", "ru", "en"]) {
    const Logo = components(locale)("StorefrontShell", "Logo");
    for (const inverse of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(Logo, { locale, inverse }));
      assert.ok(html.includes(">" + names[locale] + "</span>"));
      assert.ok(html.includes(">" + labels[locale] + "</span>"));
      assert.match(html, /<img[^>]+src="\/brand\/grqaser-mark\.png"[^>]+alt=""[^>]+aria-hidden="true"/u);
      assert.doesNotMatch(html, /LUMI|logo-(hy|ru|en)\.png/u);
      if (inverse) assert.match(html, /brightness-0 invert/u);
    }
  }
});

test("home empty and error states render without any purchasable demo book in all languages", () => {
  const expected = { ru: ["Книги скоро появятся", "Не удалось загрузить книги"], hy: ["Գրքերը շուտով կհայտնվեն", "Չհաջողվեց բեռնել գրքերը"], en: ["Books will be here soon", "We could not load the books"] };
  for (const locale of ["ru", "hy", "en"]) {
    const HomePage = components(locale)("HomePage");
    for (const catalogLoadFailed of [false, true]) {
      const html = renderToStaticMarkup(React.createElement(HomePage, { books: [], catalogLoadFailed }));
      assert.ok(html.includes(expected[locale][Number(catalogLoadFailed)]));
      assert.doesNotMatch(html, /href="\/(?:ru|hy|en)\/books\//u);
      assert.match(html, /<button[^>]+type="button"/u);
    }
  }
});

test("a category outage does not hide real catalog books on the home page", () => {
  const HomePage = components("ru")("HomePage");
  const html = renderToStaticMarkup(React.createElement(HomePage, { books: [book], categoryLoadFailed: true }));
  assert.match(html, /href="\/ru\/books\/real-edition"/u);
  assert.ok(html.includes("Не удалось загрузить все разделы каталога."));
  assert.ok(!html.includes("Не удалось загрузить книги"));
});

test("home keeps the complete reference section order even when the catalog is empty", () => {
  const expected = ["hero", "new-arrivals", "new-by-category", "top-categories", "promotions", "publishers", "publisher-books", "other-products", "discounts", "special-selection", "delivery-promotion"];
  for (const locale of ["hy", "ru", "en"]) {
    const HomePage = components(locale)("HomePage");
    const html = renderToStaticMarkup(React.createElement(HomePage, { books: [] }));
    assert.deepEqual([...html.matchAll(/data-home-section="([^"]+)"/gu)].map(match => match[1]), expected);
    assert.match(html, /id="publishers" data-home-section="publishers"/u);
    assert.equal([...html.matchAll(/aria-controls="home-promotion-content"/gu)].length, 3);
    assert.match(html, /aria-pressed="true"/u);
    assert.match(html, /href="\/(?:hy|ru|en)\/catalog\?language=ru"/u);
    assert.match(html, /href="\/(?:hy|ru|en)\/catalog\?language=en"/u);
    assert.match(html, /href="\/(?:hy|ru|en)\/information"/u);
  }
});

test("new arrivals require a real new flag and use the separate server selection", () => {
  const HomePage = components("en")("HomePage");
  const html = renderToStaticMarkup(React.createElement(HomePage, {
    books: [{ ...book, id: "old", slug: "old", isNew: false }],
    newBooks: [{ ...book, id: "new", slug: "verified-new", isNew: true }, { ...book, id: "wrong", slug: "not-new", isNew: false }],
  }));
  const section = html.match(/<section id="new-arrivals"[\s\S]*?<\/section>/u)?.[0];
  assert.ok(section);
  assert.match(section, /\/books\/verified-new/u);
  assert.doesNotMatch(section, /\/books\/(old|not-new)/u);
  assert.match(section, /catalog\?isNew=true/u);
});

test("publisher and accessory selections use real metadata without inventing discounts", () => {
  const HomePage = components("en")("HomePage");
  const html = renderToStaticMarkup(React.createElement(HomePage, {
    books: [{ ...book, publisher: "Verified publisher", sourcePrice: 9000 }, { ...book, id: "accessory", slug: "real-bookmark", category: "Bookmarks", price: 400 }],
  }));
  const publishers = html.match(/data-home-section="publishers"[\s\S]*?<\/section>/u)?.[0];
  assert.match(publishers, /publisher=Verified%20publisher/u);
  const accessories = html.match(/<section id="other-products"[\s\S]*?<\/section>/u)?.[0];
  assert.match(accessories, /\/books\/real-bookmark/u);
  assert.doesNotMatch(accessories, /\/books\/real-edition/u);
  const discounts = html.match(/data-home-section="discounts"[\s\S]*?<\/section>/u)?.[0];
  assert.ok(discounts.includes("There are no confirmed discounts right now."));
  assert.doesNotMatch(discounts, /<del|<s>|9000/u);
});

test("account is useful in every locale without collecting a phone number or presenting an inert form", () => {
  for (const locale of ["ru", "hy", "en"]) {
    const AccountPage = components(locale)("AccountPage");
    const html = renderToStaticMarkup(React.createElement(AccountPage));
    for (const route of ["favorites", "cart", "catalog"]) assert.ok(html.includes(`href="/${locale}/${route}"`));
    assert.doesNotMatch(html, /<(?:form|input|button)\b/u);
    assert.match(html, />2<\/span>/u);
  }
});

test("catalog controls render the current URL filters instead of resetting to defaults", () => {
  const CatalogPage = components("ru", "?q=Test&language=en&sort=price-desc")("CatalogPage");
  const html = renderToStaticMarkup(React.createElement(CatalogPage));
  assert.match(html, /value="Test"/u);
  assert.match(html, /<option value="price-desc" selected="">/u);
  assert.match(html, /name="language" checked=""/u);
});

test("catalog Reset remounts unapplied drafts even when the URL is already at defaults", () => {
  const state = [];
  let hook = 0;
  const reactOverride = {
    ...React,
    useEffect() {},
    useMemo: (calculate) => calculate(),
    useState(initial) {
      const index = hook++;
      if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
      return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
    },
  };
  const CatalogPage = components("en", "", reactOverride)("CatalogPage");
  const render = () => { hook = 0; return CatalogPage({ initialData: { items: [], total: 0 } }); };
  const elements = (node) => {
    if (Array.isArray(node)) return node.flatMap(elements);
    if (!React.isValidElement(node)) return [];
    return [node, ...elements(node.props.children)];
  };
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let historyWrites = 0;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { pathname: "/en/catalog", search: "" },
    history: { pushState() { historyWrites++; }, replaceState() { historyWrites++; } },
  } });
  try {
    const before = elements(render());
    const formBefore = before.find((element) => element.type === "form" && element.key !== null);
    const reset = before.find((element) => element.type === "button" && element.props.children === "Reset");
    assert.ok(formBefore);
    assert.ok(reset);
    reset.props.onClick();
    const formAfter = elements(render()).find((element) => element.type === "form" && element.key !== null);
    assert.notEqual(formAfter.key, formBefore.key, "a new form identity clears uncontrolled drafts and custom validity");
    assert.equal(historyWrites, 0, "no redundant navigation is required to clear local drafts");
    for (const input of elements(formAfter).filter((element) => element.type === "input")) assert.equal(input.props.defaultValue, "");
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
  }
});

test("larger product controls still disable purchasing unavailable books", () => {
  const BookCard = components("en")("BookCard");
  const html = renderToStaticMarkup(React.createElement(BookCard, { book: { ...book, availability: "unavailable" } }));
  assert.match(html, /<button[^>]+disabled=""/u);
  assert.match(html, /<button[^>]+class="[^"]*size-11[^"]*"/u);
  assert.match(html, /href="\/en\/books\/real-edition"/u);
});
