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
const expected = {
  hy: {
    paperback: "Փափուկ կազմ", hardcover: "Կոշտ կազմ", jacket: "Կոշտ կազմ՝ սուպեր շապիկով", english: "Անգլերեն", russian: "Ռուսերեն", armenian: "Հայերեն", french: "Ֆրանսերեն",
    productCode: "Ապրանքի կոդ", weight: "Քաշ", barcode: "Շտրիխ կոդ", publisher: "Հրատարակիչ", language: "Լեզու",
    newness: "Նորույթ", no: "Ոչ", yes: "Այո", pages: "Էջերի քանակ", binding: "Կազմ", dimensions: "Չափս",
    year: "Հրատարակման տարի", series: "Շարք", details: "Բնութագրեր", description: "Նկարագրություն",
    kg: "կգ", cm: "սմ",
  },
  ru: {
    paperback: "Мягкая обложка", hardcover: "Твёрдый переплёт", jacket: "Твёрдый переплёт с суперобложкой", english: "Английский", russian: "Русский", armenian: "Армянский", french: "Французский",
    productCode: "Код товара", weight: "Вес", barcode: "Штрих-код", publisher: "Издательство", language: "Язык",
    newness: "Новинка", no: "Нет", yes: "Да", pages: "Страницы", binding: "Переплёт", dimensions: "Формат",
    year: "Год издания", series: "Серия", details: "Характеристики", description: "Описание",
    kg: "кг", cm: "см",
  },
  en: {
    paperback: "Paperback", hardcover: "Hardcover", jacket: "Hardcover with dust jacket", english: "English", russian: "Russian", armenian: "Armenian", french: "French",
    productCode: "Product code", weight: "Weight", barcode: "Barcode", publisher: "Publisher", language: "Language",
    newness: "New release", no: "No", yes: "Yes", pages: "Pages", binding: "Binding", dimensions: "Dimensions",
    year: "Publication year", series: "Series", details: "Book details", description: "Description",
    kg: "kg", cm: "cm",
  },
};

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// These are the null-code labels and values returned for a real catalog edition.
const rawAttributes = deepFreeze([
  { code: null, label: "Product code", value: "122337" },
  { code: null, label: "Weight", value: "0.260000" },
  { code: null, label: "Barcode", value: "9780753553465" },
  { code: null, label: "Publisher", value: "Ebury Digital" },
  { code: null, label: "language", value: "English" },
  { code: null, label: "Newness", value: "No" },
  { code: null, label: "Pages", value: "368" },
  { code: null, label: "Printing cover", value: "Paperback" },
  { code: null, label: "Printing format", value: "138x215" },
  { code: null, label: "Publication date", value: "2021" },
  { code: null, label: "ISBN", value: "9780753553465" },
  { code: null, label: "Series", value: "Extraordinary Voyages" },
  { code: null, label: "Edition note", value: "English Paperback, an original note." },
]);
const edition = deepFreeze({
  id: "books-am-122337", slug: "madhouse-at-the-end-of-the-earth", title: "Madhouse at the End of the Earth", author: "Julian Sancton",
  description: "An original description of the Belgica expedition.", category: "Books", language: "English", binding: "Paperback",
  price: 5700, productCode: "122337", weight: "0.260000", barcode: "9780753553465", isNew: false,
  dimensions: "138x215", series: "Extraordinary Voyages", isbn: "9780753553465", publisher: "Ebury Digital", pages: 368, year: 2021,
  availability: "observed", observedAt: "2026-09-24T10:00:00Z", accent: "violet", coverLabel: "Madhouse at the End of the Earth",
  categories: [], attributes: rawAttributes,
  detailSections: [
    { code: "additional", title: "Details", content: "Original metadata description.", attributes: rawAttributes },
    { code: "description", title: "Description", content: "English Paperback is part of this original prose.", attributes: [] },
    { code: "custom-section", title: "Edition notes", content: "Original publisher commentary.", attributes: [] },
  ],
});

// Execute the real TS/TSX modules with only Next navigation and context stubbed.
// Rendering does not run effects, use a network connection, or mutate catalog data.
function components(locale) {
  const loaded = new Map();
  const context = { locale, cart: [], cartCount: 0, favorites: [], isFavorite: () => false, addToCart() {}, toggleFavorite() {} };
  function load(filename) {
    if (loaded.has(filename)) return loaded.get(filename).exports;
    const mod = new Module(filename);
    loaded.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "./StorefrontShell") return { useStorefront: () => context };
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
const textContent = (html) => html.replace(/<[^>]*>/gu, "").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("\u00a0", " ");
const pairs = (html) => [...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gu)].map(([, label, value]) => [textContent(label), textContent(value)]);
const includesPair = (html, label, value, message) => assert.ok(pairs(html).some(([actualLabel, actualValue]) => actualLabel === label && actualValue === value), message ?? `${label}: ${value}`);

test("binding and language aliases are localized in all three storefront languages", () => {
  for (const locale of locales) {
    const h = components(locale);
    const { localizeBookBinding, localizeBookLanguage } = h.module("app/components/storefront/i18n.ts");
    const t = expected[locale];
    for (const raw of ["Paperback", "PB", "softcover", "Мягкая обложка", "мягкая", "փափուկ"]) {
      assert.equal(localizeBookBinding(locale, raw), t.paperback, `${locale}: ${raw}`);
    }
    for (const raw of ["Hardcover", "Hardback", "Твёрдый переплёт", "твердая", "կոշտ"]) {
      assert.equal(localizeBookBinding(locale, raw), t.hardcover, `${locale}: ${raw}`);
    }
    for (const raw of ["Hardcover with dust jacket", "Hardback with dust jacket", "Hardcover + dust jacket", "Твердая с суперобложкой", "կոշտ կազմ + սուպեր շապիկ", "կոշտ+ սուպեր շապիկ"]) {
      assert.equal(localizeBookBinding(locale, raw), t.jacket, `${locale}: ${raw}`);
    }
    for (const [label, aliases] of [
      ["english", ["English", "english", "английский", "անգլերեն", "en"]],
      ["russian", ["Russian", "русский", "Русский", "Ռուսերեն", "ru"]],
      ["armenian", ["Armenian", "Армянский", "հայերեն", "hy"]],
      ["french", ["French", "Французский", "Ֆրանսերեն", "fr"]],
    ]) {
      for (const raw of aliases) assert.equal(localizeBookLanguage(locale, raw), t[label], `${locale}: ${raw}`);
    }
    for (const raw of ["English, Русский", "английский/русский", "English and Russian", "English & Русский", "Անգլերեն և Ռուսերեն"]) {
      assert.equal(localizeBookLanguage(locale, raw), `${t.english}, ${t.russian}`, `${locale}: mixed ${raw}`);
    }
    assert.equal(localizeBookLanguage(locale, "English, Esperanto"), `${t.english}, Esperanto`, `${locale}: unknown language in a mixed edition stays original`);
    for (const raw of ["O.ТВ. С", "П", "О", "An unknown binding"]) assert.equal(localizeBookBinding(locale, raw), raw);
    assert.equal(localizeBookLanguage(locale, "An unknown language"), "An unknown language");
  }
});

test("product language chips, specifications and book cards use the selected UI language", () => {
  for (const locale of locales) {
    const h = components(locale);
    const t = expected[locale];
    for (const [language, localized] of [["English", t.english], ["Русский", t.russian], ["Հայերեն", t.armenian], ["French", t.french], ["English, Русский", `${t.english}, ${t.russian}`]]) {
      for (const [binding, localizedBinding] of [["Paperback", t.paperback], ["Hardcover", t.hardcover], ["կոշտ+ սուպեր շապիկ", t.jacket]]) {
        const book = deepFreeze({ ...edition, language, binding, detailSections: [], attributes: [] });
        const html = render(h.component("BookDetailsPage"), { book, related: [] });
        includesPair(html, h.dictionary.product.language, localized, `${locale}/${language}: specification`);
        includesPair(html, h.dictionary.product.binding, localizedBinding, `${locale}/${binding}: specification`);
        const chip = [...html.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gu)].map(([, content]) => textContent(content));
        assert.ok(chip.includes(localized), `${locale}/${language}: language chip`);
        const card = render(h.component("BookCard"), { book });
        assert.ok([...card.matchAll(/<span\b[^>]*>([^<]*)<\/span>/gu)].some(([, value]) => value === localized), `${locale}/${language}: card language`);
        assert.ok(textContent(html).includes(edition.title));
        assert.ok(textContent(card).includes(edition.author));
      }
    }
  }
});

test("catalog language facets and advanced-search options translate labels without changing filter codes", () => {
  for (const locale of locales) {
    const h = components(locale);
    const t = expected[locale];
    const labels = [t.armenian, t.russian, t.english];
    const catalog = render(h.component("CatalogPage"), { initialData: { items: [edition], total: 1 }, initialCategories: [] });
    const buttons = [...catalog.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gu)].map(([, content]) => textContent(content));
    for (const label of labels) assert.ok(buttons.includes(label), `${locale}: catalog language button ${label}`);
    const radioLabels = [...catalog.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gu)]
      .map(([label]) => label).filter((label) => /<input\b[^>]*name="language"/u.test(label)).map(textContent);
    assert.deepEqual(new Set(radioLabels), new Set([h.dictionary.catalog.allLanguages, ...labels]), `${locale}: sidebar language labels`);
    const advanced = render(h.component("AdvancedSearchPage"));
    const options = Object.fromEntries([...advanced.matchAll(/<option\b[^>]*value="(hy|ru|en)"[^>]*>([\s\S]*?)<\/option>/gu)].map(([, code, label]) => [code, textContent(label)]));
    assert.deepEqual(options, { hy: t.armenian, ru: t.russian, en: t.english }, `${locale}: translated option labels preserve API language codes`);
  }
});

test("null-code live metadata labels, section headings and standard values are localized without changing names or prose", () => {
  for (const locale of locales) {
    const h = components(locale);
    const t = expected[locale];
    const html = render(h.component("BookDetailsPage"), { book: edition, related: [] });
    for (const [label, value] of [
      [t.productCode, edition.productCode], [t.weight, edition.weight], [t.barcode, edition.barcode], [t.publisher, edition.publisher],
      [t.language, t.english], [t.newness, t.no], [t.pages, String(edition.pages)], [t.binding, t.paperback],
      [t.dimensions, "138 × 215"], [t.year, String(edition.year)], ["ISBN", edition.isbn], [t.series, edition.series],
      ["Edition note", "English Paperback, an original note."],
    ]) includesPair(html, label, value, `${locale}: ${label} = ${value}`);
    const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gu)].map(([, content]) => textContent(content));
    assert.ok(headings.includes(t.details), `${locale}: additional/Details section`);
    assert.ok(headings.includes(t.description), `${locale}: description section`);
    assert.ok(headings.includes("Edition notes"), `${locale}: unknown section title stays original`);
    for (const text of [edition.title, edition.author, edition.description, edition.publisher, edition.series,
      "English Paperback is part of this original prose.", "Original publisher commentary."]) {
      assert.ok(textContent(html).includes(text), `${locale}: original content ${text}`);
    }
  }
});

test("metadata localization returns copies, preserves unknown values and never invents measurement units", () => {
  const snapshot = structuredClone(edition);
  for (const locale of locales) {
    const h = components(locale);
    const { localizeBookAttribute, localizeBookDetailSection, localizeBookWeight, localizeBookDimensions } = h.module("app/lib/book-localization.ts");
    const t = expected[locale];
    const section = localizeBookDetailSection(locale, edition.detailSections[0]);
    assert.notEqual(section, edition.detailSections[0]);
    assert.notEqual(section.attributes, rawAttributes);
    assert.equal(section.title, t.details);
    assert.equal(section.content, edition.detailSections[0].content);
    section.attributes.forEach((attribute, index) => assert.notEqual(attribute, rawAttributes[index]));
    for (const [labels, raw, label, value] of [
      [["Լեզու", "Язык", "language"], "English", t.language, t.english],
      [["Կազմ", "Обложка", "Printing cover"], "Paperback", t.binding, t.paperback],
      [["Բարկոդ", "Штрих код", "Barcode"], edition.barcode, t.barcode, edition.barcode],
      [["Հրատ. տարեթիվ", "Год издания", "Publication date"], "2021", t.year, "2021"],
      [["Շարք", "Серии", "Series"], edition.series, t.series, edition.series],
    ]) {
      for (const sourceLabel of labels) {
        const result = localizeBookAttribute(locale, deepFreeze({ code: null, label: sourceLabel, value: raw }));
        assert.equal(result.label, label, `${locale}: null-code ${sourceLabel}`);
        assert.equal(result.value, value, `${locale}: null-code value ${sourceLabel}`);
      }
    }
    const coded = localizeBookAttribute(locale, deepFreeze({ code: "printing_cover", label: "Language", value: "Paperback" }));
    assert.equal(coded.label, t.binding, `${locale}: known code outranks conflicting label`);
    assert.equal(coded.value, t.paperback);
    const fallback = localizeBookAttribute(locale, deepFreeze({ code: "unknown", label: "language", value: "English" }));
    assert.equal(fallback.label, t.language, `${locale}: unknown code permits known label fallback`);
    assert.equal(fallback.value, t.english);
    const byTitle = localizeBookDetailSection(locale, deepFreeze({ code: null, title: "More Information", content: "Original section prose.", attributes: [] }));
    assert.equal(byTitle.title, t.details);
    assert.equal(byTitle.content, "Original section prose.");
    for (const [raw, localized] of [["No", t.no], ["ոչ", t.no], ["Нет", t.no], ["Yes", t.yes], ["Այո", t.yes], ["Да", t.yes]]) {
      const result = localizeBookAttribute(locale, deepFreeze({ code: null, label: "Newness", value: raw }));
      assert.equal(result.value, localized, `${locale}: boolean ${raw}`);
    }
    const custom = deepFreeze({ code: "unknown", label: "Edition note", value: "English Paperback, 5 kg, Yes" });
    assert.deepEqual(localizeBookAttribute(locale, custom), custom);
    assert.equal(localizeBookWeight(locale, "0.260000"), "0.260000");
    assert.equal(localizeBookDimensions(locale, "130x200"), "130 × 200");
    assert.equal(localizeBookDimensions(locale, "162х235"), "162 × 235");
    assert.equal(localizeBookWeight(locale, "A publisher-specific size"), "A publisher-specific size");
    assert.equal(localizeBookDimensions(locale, "Pocket edition"), "Pocket edition");
    assert.match(localizeBookWeight(locale, "0.26 kg"), new RegExp(`^0\\.26\\s*${t.kg}$`, "u"));
    assert.match(localizeBookDimensions(locale, "13 x 20 cm"), new RegExp(`^13\\s*×\\s*20\\s*${t.cm}$`, "u"));
    render(h.component("BookDetailsPage"), { book: edition, related: [edition] });
  }
  assert.deepEqual(edition, snapshot, "localized helpers and rendering leave raw parser data unchanged");
});

test("removing price-per-copy text preserves price, ISBN, delivery and available/unavailable purchase controls", () => {
  for (const locale of locales) {
    const h = components(locale);
    const t = h.dictionary.product;
    const { formatAmd } = h.module("app/lib/catalog-data.ts");
    for (const availability of ["observed", "unavailable"]) {
      const book = deepFreeze({ ...edition, availability });
      const html = render(h.component("BookDetailsPage"), { book, related: [] });
      const aside = html.match(/<aside\b[^>]*>([\s\S]*?)<\/aside>/u)?.[1];
      assert.ok(aside);
      assert.ok(!textContent(html).includes(t.servicePrice), `${locale}/${availability}: no per-copy caption`);
      assert.ok(textContent(aside).includes(textContent(formatAmd(edition.price))), `${locale}/${availability}: exact price remains`);
      assert.ok(textContent(aside).includes(t.delivery), `${locale}/${availability}: delivery remains`);
      includesPair(html, "ISBN", edition.isbn);
      const cta = [...aside.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gu)].find(([, , content]) => textContent(content) === (availability === "unavailable" ? t.unavailableButton : t.add));
      assert.ok(cta, `${locale}/${availability}: purchase button remains`);
      assert.equal(/\sdisabled(?:="[^"]*")?(?:\s|$)/u.test(cta[1]), availability === "unavailable");
      assert.equal(book.price, 5700);
    }
  }
});
