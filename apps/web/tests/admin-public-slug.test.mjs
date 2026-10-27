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
const book = {
  id: "11111111-1111-4111-8111-111111111111", supplierSku: "SUPPLIER-122337",
  slug: "books-am-122337", publicSlug: "madhouse-at-the-end-of-the-earth",
  language: "en", locale: "en", sourcePriceAmd: 7500, availability: "PRELIMINARY_AVAILABLE",
  sourceUrl: "https://www.books.am/en/catalog/product/view/id/122337/", manualEdited: false,
  categoryIds: [], categoryOptions: [],
  localizations: [{
    id: "translation-en", locale: "en", parserVersion: "books-html-v3", manualEdited: false,
    title: "Madhouse at the End of the Earth", author: "Julian Sancton", description: "Description",
    languageLabel: "English", isbn: "9780753553463", publisher: "Publisher", productCode: "SUPPLIER-122337",
    weight: null, barcode: null, isNew: null, pageCount: 368, coverType: null, dimensions: null,
    publicationYear: null, series: null, imageUrls: [], attributes: [], detailSections: [],
    sourceUrl: "https://www.books.am/en/catalog/product/view/id/122337/",
  }],
};

function editorModule(deterministicState = false) {
  const cache = new Map();
  const react = deterministicState ? {
    ...React,
    useState: initial => [typeof initial === "function" ? initial() : initial, () => {}],
  } : React;
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = specifier => {
      if (specifier === "react") return react;
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const source = readFileSync(filename, "utf8") + (filename.endsWith("/AdminDashboard.tsx") ? "\nexport { BookEditorModal as TestBookEditor };" : "");
    const { outputText } = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
    } });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return load(path.join(root, "app/admin/AdminDashboard.tsx")).TestBookEditor;
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/gu)].map(([, key, value]) => [key.toLowerCase(), value]));
}

test("admin editor separates a read-only public address from the protected supplier key in all three languages", () => {
  const Editor = editorModule();
  const labels = {
    RU: { privateKey: "Внутренний ключ", page: "Адрес страницы" },
    HY: { privateKey: "Ներքին բանալի", page: "Էջի հասցե" },
    EN: { privateKey: "Internal key", page: "Page address" },
  };
  for (const locale of ["HY", "RU", "EN"]) {
    const html = renderToStaticMarkup(React.createElement(Editor, { book, locale, onClose() {}, async onSave() {} }));
    const inputs = [...html.matchAll(/<input\b[^>]*>/gu)].map(([tag]) => attributes(tag));
    for (const value of [book.slug, book.publicSlug, book.supplierSku, book.sourceUrl]) {
      const control = inputs.find(input => input.value === value);
      assert.ok(control, `${locale}: ${value} remains visible to the operator`);
      assert.ok(Object.hasOwn(control, "readonly"), `${locale}: ${value} cannot be accidentally edited`);
    }
    assert.ok(html.includes(labels[locale].privateKey));
    assert.ok(html.includes(labels[locale].page));
  }
});

test("admin editor safely shows the legacy address while a nullable public slug awaits backfill", () => {
  const Editor = editorModule();
  const html = renderToStaticMarkup(React.createElement(Editor, { book: { ...book, publicSlug: null }, locale: "RU", onClose() {}, async onSave() {} }));
  assert.ok(!html.includes('value="undefined"'));
  const controls = [...html.matchAll(/<input\b[^>]*>/gu)].map(([tag]) => attributes(tag)).filter(input => input.value === book.slug);
  assert.equal(controls.length, 2, "private key and public-address fallback remain explicit separate controls");
  assert.ok(controls.every(control => Object.hasOwn(control, "readonly")));
});

test("saving ordinary admin edits preserves the internal slug and does not submit the generated public address", async () => {
  const Editor = editorModule(true);
  const saved = [];
  const tree = Editor({ book, locale: "RU", onClose() {}, async onSave(payload) { saved.push(payload); } });
  function form(node) {
    if (Array.isArray(node)) return node.map(form).find(Boolean);
    if (!React.isValidElement(node)) return null;
    if (node.type === "form") return node;
    return form(node.props.children);
  }
  const control = form(tree);
  assert.ok(control);
  let prevented = false;
  await control.props.onSubmit({ preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].slug, book.slug);
  assert.ok(!Object.hasOwn(saved[0], "publicSlug"));
  assert.ok(!Object.hasOwn(saved[0], "supplierSku"));
  assert.ok(!Object.hasOwn(saved[0], "sourceUrl"));
  assert.equal(book.publicSlug, "madhouse-at-the-end-of-the-earth");
});
