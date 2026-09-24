import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

function moduleUrl(source) {
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return "data:text/javascript;base64," + Buffer.from(outputText).toString("base64");
}

const brand = await import(moduleUrl(await readFile(new URL("../app/lib/brand.ts", import.meta.url), "utf8")));
const documentSource = await readFile(new URL("../app/lib/document-locale.ts", import.meta.url), "utf8");
const documentLocale = await import(moduleUrl(documentSource));

test("site origin rejects credentials, paths, query, fragment and non-HTTP protocols", () => {
  assert.equal(brand.siteOrigin("https://grqaser.am"), "https://grqaser.am");
  assert.equal(brand.siteOrigin(" https://grqaser.am/ "), "https://grqaser.am");
  for (const value of ["https://user:secret@grqaser.am", "https://grqaser.am/shop", "https://grqaser.am?host=evil.example", "https://grqaser.am#section", "ftp://grqaser.am", "javascript:alert(1)"]) {
    assert.throws(() => brand.siteOrigin(value), undefined, value);
  }
});

test("site-relative URLs cannot escape the configured origin through protocol, slash, backslash or control injection", () => {
  for (const value of ["https://evil.example", "//evil.example", "\\evil.example", "/\\evil.example", "/\n/evil.example", "/\r/evil.example", "/\t/evil.example"]) {
    assert.throws(() => brand.absoluteUrl(value), undefined, JSON.stringify(value));
  }
  for (const value of ["", "catalog", "/hy/books/abc.def", "/ru/catalog?page=2", "/en/books/a%2Fb"]) {
    assert.equal(new URL(brand.absoluteUrl(value)).origin, brand.SITE_URL);
  }
});

test("document language defaults to Armenian and remains localized for dotted book slugs", async () => {
  assert.equal(documentLocale.documentLocaleFromPath("/"), "hy");
  assert.equal(documentLocale.documentLocaleFromPath("/unknown"), "hy");
  assert.equal(documentLocale.documentLocaleFromHeader(null), "hy");
  assert.equal(documentLocale.documentLocaleFromHeader("invalid"), "hy");
  let proxySource = await readFile(new URL("../proxy.ts", import.meta.url), "utf8");
  assert.match(proxySource, /\/:locale\(hy\|ru\|en\)\/:path\*/u);
  proxySource = proxySource.replace('import { NextResponse } from "next/server";', "const NextResponse = { next(options: unknown) { return options; } };")
    .replace('from "./app/lib/document-locale"', `from "${moduleUrl(documentSource)}"`);
  const { proxy } = await import(moduleUrl(proxySource));
  for (const locale of ["hy", "ru", "en"]) {
    const result = proxy({ headers: new Headers({ [documentLocale.DOCUMENT_LOCALE_HEADER]: "fake" }), nextUrl: { pathname: `/${locale}/books/real.edition` } });
    assert.equal(result.request.headers.get(documentLocale.DOCUMENT_LOCALE_HEADER), locale);
  }
});

test("generated social and app icons have the dimensions promised by metadata", async () => {
  const sizes = {
    "logo-hy.png": [1800, 500], "logo-ru.png": [1800, 500], "logo-en.png": [1800, 500],
    "grqaser-mark.png": [192, 192], "icon-48.png": [48, 48], "icon-192.png": [192, 192], "icon-512.png": [512, 512], "apple-touch-icon.png": [180, 180],
    "og-hy.png": [1200, 630], "og-ru.png": [1200, 630], "og-en.png": [1200, 630],
  };
  for (const [filename, expected] of Object.entries(sizes)) {
    const png = await readFile(new URL(`../public/brand/${filename}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), "PNG", filename);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], expected, filename);
  }
});
