import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "..");
const internalCopy = /books\.am|\bsupplier\b|\bprocure(?:ment)?\b|\b(?:scraping|crawler|markup|reseller)\b|поставщик|закуп|выкуп|нацен|перекуп|парсинг|мատակարար|վերավաճառ|փարս|ձեռք կբեր|\bAPI\b|SMS[- ]?(?:provider|провайдер)|книжный сервис|book service|գրքային ծառայություն|сервис LUMI|LUMI service|LUMI ծառայություն/iu;

async function importDataModule(relativePath) {
  const source = await readFile(path.join(root, relativePath), "utf8");
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
  for (const locale of locales) {
    for (const text of strings([dictionary[locale], localeMeta[locale]])) {
      assert.doesNotMatch(text, internalCopy, locale + ": " + text);
    }
    assert.match(dictionary[locale].footer.about, bookstoreWords[locale]);
    assert.match(dictionary[locale].footer.about, /LUMI Books/u);
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

test("checkout still states cash payment, delivery fee and availability confirmation", () => {
  const expected = {
    ru: { submit: "Оформить заказ", cash: /наличн/iu, availability: /налич/iu },
    hy: { submit: "Ձևակերպել պատվերը", cash: /կանխիկ/iu, availability: /առկայ/iu },
    en: { submit: "Place order", cash: /cash/iu, availability: /availability/iu },
  };
  for (const locale of locales) {
    const { cart, product, header } = dictionary[locale];
    assert.equal(cart.submit, expected[locale].submit);
    assert.ok(cart.quoteChanged.includes(cart.submit), locale + ": repricing points to the real button");
    assert.match(cart.onDelivery, expected[locale].cash);
    assert.match(cart.successText, expected[locale].cash);
    assert.match(cart.submitHint, expected[locale].availability);
    assert.match(product.checkStock, expected[locale].availability);
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

test("customer copy does not promise an unavailable account or stock notifications", () => {
  const unavailable = { ru: /недоступен/u, hy: /հասանելի չէ/u, en: /not available/u };
  for (const locale of locales) {
    assert.match(dictionary[locale].account.prompt, unavailable[locale]);
    assert.match(dictionary[locale].account.authUnavailable, unavailable[locale]);
    assert.doesNotMatch(dictionary[locale].product.unavailableHint, /сообщим|կտեղեկացնենք|we.ll tell/iu);
  }
});
