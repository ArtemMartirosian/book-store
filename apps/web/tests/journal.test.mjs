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
function modules() {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = new Module(filename);
    cache.set(filename, mod);
    mod.filename = filename;
    mod.paths = [path.join(root, "node_modules")];
    mod.require = (specifier) => {
      if (specifier === "next/navigation") return { notFound() { throw new Error("NOT_FOUND"); } };
      if (specifier === "next/link") return { __esModule: true, default: ({ children, ...props }) => React.createElement("a", props, children) };
      // eslint-disable-next-line react/prop-types -- Minimal test-only shell, not a production component.
      if (specifier.endsWith("/StorefrontShell")) return { StorefrontShell: ({ locale, children }) => React.createElement("div", { lang: locale }, children) };
      if (specifier.startsWith(".")) {
        const relative = path.resolve(path.dirname(filename), specifier);
        const resolved = [relative, relative + ".ts", relative + ".tsx"].find(existsSync);
        if (resolved && /\.tsx?$/u.test(resolved)) return load(resolved);
        if (resolved) return nativeRequire(resolved);
      }
      return nativeRequire(specifier);
    };
    const { outputText } = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
    mod._compile(outputText, filename);
    return mod.exports;
  }
  return (filename) => load(path.join(root, filename));
}

test("journal contains original complete guides in every storefront language", () => {
  const { journalArticle, journalSlugs } = modules()("app/lib/journal.ts");
  for (const slug of journalSlugs) for (const locale of ["hy", "ru", "en"]) {
    const article = journalArticle(slug, locale);
    assert.ok(article.title.length > 10);
    assert.ok(article.summary.length > 20);
    assert.equal(article.sections.length, 3);
    for (const section of article.sections) assert.ok(section.text.length > 100);
    assert.doesNotMatch(JSON.stringify(article), /LUMI|books\.am|lorem ipsum/iu);
  }
  assert.equal(journalArticle("__proto__", "ru"), undefined);
  assert.equal(journalArticle("not-an-article", "en"), undefined);
});

test("journal links lead to actual localized guides with matching canonical and sitemap entries", async () => {
  const load = modules();
  const list = load("app/[locale]/journal/page.tsx");
  const detail = load("app/[locale]/journal/[slug]/page.tsx");
  const { journalSlugs, journalArticles } = load("app/lib/journal.ts");
  const sitemap = load("app/lib/sitemap-data.ts").renderStaticSitemap();
  for (const locale of ["hy", "ru", "en"]) {
    const html = renderToStaticMarkup(await list.default({ params: Promise.resolve({ locale }) }));
    for (const slug of journalSlugs) {
      const url = "https://grqaser.am/" + locale + "/journal/" + slug;
      assert.ok(html.includes('href="/' + locale + '/journal/' + slug + '"'));
      const params = Promise.resolve({ locale, slug });
      const metadata = await detail.generateMetadata({ params });
      assert.equal(metadata.alternates.canonical, url);
      assert.equal(Object.keys(metadata.alternates.languages).length, 4);
      assert.ok(sitemap.includes("<loc>" + url + "</loc>"));
      const articleHtml = renderToStaticMarkup(await detail.default({ params }));
      assert.ok(articleHtml.includes(journalArticles[slug][locale].title));
      assert.ok(articleHtml.includes('"@type":"Article"'));
      assert.match(articleHtml, /href="\/(?:hy|ru|en)\/catalog"/u);
    }
  }
  await assert.rejects(detail.default({ params: Promise.resolve({ locale: "ru", slug: "missing" }) }), /NOT_FOUND/u);
});

test("information page supplies real about, ordering, delivery and FAQ anchors", () => {
  const { ShopInformation } = modules()("app/components/storefront/ShopInformation.tsx");
  for (const locale of ["hy", "ru", "en"]) {
    const html = renderToStaticMarkup(React.createElement(ShopInformation, { locale, section: "information" }));
    for (const id of ["about", "order", "confirmation", "delivery", "data", "faq"]) assert.ok(html.includes('id="' + id + '"'));
    assert.equal((html.match(/<details/g) || []).length, 3);
    assert.doesNotMatch(html, /href="#"/u);
  }
});
