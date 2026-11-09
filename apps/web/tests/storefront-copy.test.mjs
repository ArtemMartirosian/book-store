import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const internalCopy = /books\.am|\bsupplier\b|\bprocure(?:ment)?\b|\b(?:scraping|crawler|markup|reseller)\b|поставщик|закуп|выкуп|нацен|перекуп|парсинг|мատակարար|վերավաճառ|փարս|ձեռք կբեր|\bAPI\b|SMS[- ]?(?:provider|провайдер)|книжный сервис|book service|գրքային ծառայություն|сервис LUMI|LUMI service|LUMI ծառայություն/iu;

async function importDataModule(relativePath) {
  let source = await readFile(path.join(root, relativePath), "utf8");
  if (relativePath === "app/lib/catalog-api.ts") {
    const categories = await readFile(path.join(root, "app/lib/storefront-categories.ts"), "utf8");
    const compiled = ts.transpileModule(categories, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    const categoriesUrl = "data:text/javascript;base64," + Buffer.from(compiled.outputText).toString("base64");
    source = source.replace('from "./storefront-categories"', 'from "' + categoriesUrl + '"');
  }
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));
}

function strings(value) {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

async function inlineCopy(relativePath, variableName) {
  const filename = path.join(root, relativePath);
  const source = ts.createSourceFile(filename, await readFile(filename, "utf8"), ts.ScriptTarget.Latest, true);
  const declarations = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === variableName) {
      declarations.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(declarations.length, 1, relativePath + ": expected copy object " + variableName);
  const values = [];
  function collect(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) values.push(node.text);
    ts.forEachChild(node, collect);
  }
  collect(declarations[0]);
  assert.ok(values.length > 0);
  return values;
}

const { dictionary, locales } = await importDataModule("app/components/storefront/i18n.ts");
const { localeMeta } = await importDataModule("app/components/storefront/locale-meta.ts");
const { mapCatalogBook } = await importDataModule("app/lib/catalog-api.ts");

test("all three storefront languages use bookstore copy without internal sourcing details", () => {
  const bookstoreWords = { ru: /книжный интернет-магазин/u, hy: /առցանց գրախանութ/u, en: /online bookstore/u };
  const brandNames = { ru: "Гркасер", hy: "Գրքասեր", en: "Grqaser" };
  for (const locale of locales) {
    for (const text of strings([dictionary[locale], localeMeta[locale]])) {
      assert.doesNotMatch(text, internalCopy, locale + ": " + text);
    }
    assert.match(dictionary[locale].footer.about, bookstoreWords[locale]);
    assert.ok(dictionary[locale].footer.about.includes(brandNames[locale]));
    assert.doesNotMatch(strings(dictionary[locale]).join("\n"), /\bLUMI\b/u);
  }
});

test("page-specific public copy does not reintroduce sourcing or technical messages", async () => {
  const copies = [
    ["HomePage.tsx", "marketCopy"],
    ["AdvancedSearchPage.tsx", "copy"],
    ["CatalogPage.tsx", "statusCopy"],
    ["BookDetailsPage.tsx", "detailLabels"],
    ["StorefrontShell.tsx", "serviceLabels"],
    ["FavoritesPage.tsx", "copy"],
  ];
  for (const [file, variableName] of copies) {
    for (const text of await inlineCopy("app/components/storefront/" + file, variableName)) {
      assert.doesNotMatch(text, internalCopy, file + ": " + text);
    }
  }
});

test("checkout retains cash payment and the delivery fee without obsolete stock-confirmation labels", () => {
  const expected = {
    ru: { submit: "Оформить заказ", cash: /наличн/iu },
    hy: { submit: "Ձևակերպել պատվերը", cash: /կանխիկ/iu },
    en: { submit: "Place order", cash: /cash/iu },
  };
  for (const locale of locales) {
    const { cart, product, header, card } = dictionary[locale];
    assert.equal(cart.submit, expected[locale].submit);
    assert.ok(cart.quoteChanged.includes(cart.submit), locale + ": repricing points to the real button");
    assert.match(cart.onDelivery, expected[locale].cash);
    assert.match(cart.successText, expected[locale].cash);
    assert.equal(Object.hasOwn(product, "checkStock"), false);
    assert.equal(Object.hasOwn(product, "lastCheck"), false);
    assert.equal(Object.hasOwn(card, "confirm"), false);
    assert.doesNotMatch(cart.submitHint, /առկայ|наличи|availability/iu);
    assert.match(header.announcement, /1[ ,]000 ֏/u);
    assert.match(product.delivery, /1[ ,]000 ֏/u);
  }
});

test("missing categories display localized Books without changing price or availability", () => {
  const labels = { hy: "Գրքեր", ru: "Книги", en: "Books" };
  for (const locale of locales) {
    for (const availability of ["PRELIMINARY_AVAILABLE", "OUT_OF_STOCK"]) {
      const book = mapCatalogBook({
        id: "test-book", slug: "test-book", title: "Test book", author: "Test author",
        locale, language: "ru", description: "", price: { amount: 5700, currency: "AMD" },
        availability, categories: [], imageUrls: [],
      });
      assert.equal(book.category, labels[locale]);
      assert.equal(book.price, 5700);
      assert.equal(book.availability, availability === "OUT_OF_STOCK" ? "unavailable" : "observed");
    }
  }
});

const coverFixture = {
  id: "cover-test", slug: "cover-test", title: "Actual book title", author: "Actual author",
  locale: "hy", language: "hy", description: "", price: { amount: 5700, currency: "AMD" },
  availability: "PRELIMINARY_AVAILABLE", categories: [],
};
const supplierPlaceholder = "https://books.am/media/catalog/product/placeholder/default/Books_Default_image.jpg";

test("known supplier placeholders do not become a primary cover or gallery image", () => {
  const placeholders = [
    supplierPlaceholder,
    supplierPlaceholder + "?v=social",
    "https://www.books.am/MEDIA/catalog/product/CACHE/placeholder/default/books_default_image.JPG",
    "https://www.books.am/media/catalog/product/cache/99e282b967047ca9248e166dde28a548/PLACEHOLDER/default/Books_Default_image.jpg?v=Social#preview",
  ];
  for (const coverImageUrl of placeholders) {
    const input = Object.freeze({ ...coverFixture, coverImageUrl, imageUrls: Object.freeze(placeholders) });
    const book = mapCatalogBook(input);
    assert.equal(book.coverImageUrl, null);
    assert.deepEqual(book.imageUrls, []);
    assert.equal(book.coverLabel, coverFixture.title);
    assert.equal(book.price, 5700);
    assert.equal(input.coverImageUrl, coverImageUrl);
    assert.equal(input.imageUrls.length, 4);
  }
});

test("a missing primary cover falls back to the first real gallery image and preserves valid media URLs", () => {
  const cached = "https://books.am/media/catalog/product/cache/99e282b967047ca9248e166dde28a548/0/0/00-00005738.jpg";
  const social = "https://www.books.am/media/catalog/product/cache/99e282b967047ca9248e166dde28a548/0/0/back.jpg?quality=80&v=SOCIAL";
  const original = "https://www.books.am/media/catalog/product/0/0/back.jpg?quality=80";
  const external = "https://books.am.example.org/media/catalog/product/placeholder/default/Books_Default_image.jpg?v=social";
  const book = mapCatalogBook({
    ...coverFixture, coverImageUrl: supplierPlaceholder,
    imageUrls: [supplierPlaceholder + "?v=social", cached, social, original, external],
  });
  assert.equal(book.coverImageUrl, cached);
  assert.deepEqual(book.imageUrls, [cached, original, external]);

  const withRealPrimary = mapCatalogBook({ ...coverFixture, coverImageUrl: cached, imageUrls: [supplierPlaceholder] });
  assert.equal(withRealPrimary.coverImageUrl, cached);
  assert.deepEqual(withRealPrimary.imageUrls, []);
});

test("customer copy does not promise an unavailable account or stock notifications", () => {
  const unavailable = { ru: /недоступен/u, hy: /հասանելի չէ/u, en: /not available/u };
  for (const locale of locales) {
    assert.match(dictionary[locale].account.prompt, unavailable[locale]);
    assert.match(dictionary[locale].account.authUnavailable, unavailable[locale]);
    assert.doesNotMatch(dictionary[locale].product.unavailableHint, /сообщим|կտեղեկացնենք|we.ll tell/iu);
  }
});
