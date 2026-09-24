// Keep helpers away from reserved App Router metadata filenames such as sitemap.ts.
import type { CatalogLanguage } from "./catalog-api";
import { SITE_URL } from "./brand";

/** Keep each dynamic sitemap to one bounded API read, including out-of-stock books. */
export const BOOKS_PER_SITEMAP = 100;
export const MAX_SITEMAP_ENTRIES = 50_000;
export const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;
export const SITEMAP_LOCALES: readonly CatalogLanguage[] = ["hy", "ru", "en"];
const staticPaths = ["", "/catalog", "/information", "/contacts", "/journal", "/journal/book-gift", "/journal/reading-habit", "/journal/choose-edition"];
const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';

export type SitemapBook = {
  id: string;
  slug: string;
  availableLocales: CatalogLanguage[];
  fallbackLocale: CatalogLanguage;
};

export type SitemapCatalog = {
  items: SitemapBook[];
  total: number;
  offset: number;
  limit: number;
};

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

function isLocale(value: unknown): value is CatalogLanguage {
  return SITEMAP_LOCALES.includes(value as CatalogLanguage);
}

function isNonnegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Reject incomplete upstream pages instead of publishing a successful, partial sitemap. */
export function validateSitemapCatalog(value: unknown, offset: number, limit: number): SitemapCatalog {
  if (!value || typeof value !== "object") throw new Error("Invalid sitemap catalog response");
  const body = value as Partial<SitemapCatalog>;
  if (!isNonnegativeInteger(body.total) || body.offset !== offset || body.limit !== limit || !Array.isArray(body.items)) {
    throw new Error("Invalid sitemap catalog pagination");
  }
  const expected = Math.min(limit, Math.max(body.total - offset, 0));
  if (body.items.length !== expected) throw new Error("Incomplete sitemap catalog page");
  const ids = new Set<string>();
  const slugs = new Set<string>();
  for (const book of body.items) {
    if (!book || typeof book.id !== "string" || !book.id ||
        typeof book.slug !== "string" || !book.slug.trim() || book.slug.length > 512 ||
        !Array.isArray(book.availableLocales) || !book.availableLocales.every(isLocale) ||
        !isLocale(book.fallbackLocale) || ids.has(book.id) || slugs.has(book.slug)) {
      throw new Error("Invalid sitemap book");
    }
    ids.add(book.id);
    slugs.add(book.slug);
  }
  return body as SitemapCatalog;
}

export function sitemapShardCount(total: number): number {
  if (!isNonnegativeInteger(total)) throw new Error("Invalid sitemap catalog total");
  const count = Math.ceil(total / BOOKS_PER_SITEMAP);
  // One entry is reserved for the static sitemap. Do not silently drop later books.
  if (count + 1 > MAX_SITEMAP_ENTRIES) throw new Error("Sitemap index capacity exceeded; create separately submitted indexes");
  return count;
}

function checkedXml(xml: string, count: number): string {
  if (count > MAX_SITEMAP_ENTRIES || new TextEncoder().encode(xml).byteLength > MAX_SITEMAP_BYTES) {
    throw new Error("Sitemap protocol size limit exceeded");
  }
  return xml;
}

function urlset(entries: string[]): string {
  return checkedXml(`${xmlHeader}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join("")}</urlset>`, entries.length);
}

function pageEntry(path: string, locale: CatalogLanguage, locales: readonly CatalogLanguage[]): string {
  const pageUrl = (language: CatalogLanguage) => `${SITE_URL}/${language}${path}`;
  const alternates = locales.map((language) => `<xhtml:link rel="alternate" hreflang="${language}" href="${escapeXml(pageUrl(language))}"/>`);
  const defaultLocale = locales.includes("hy") ? "hy" : locales[0];
  if (defaultLocale) alternates.push(`<xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(pageUrl(defaultLocale))}"/>`);
  return `<url><loc>${escapeXml(pageUrl(locale))}</loc>${alternates.join("")}</url>`;
}

export function renderSitemapIndex(total: number): string {
  const count = sitemapShardCount(total);
  const urls = [`${SITE_URL}/sitemaps/static.xml`];
  for (let page = 0; page < count; page += 1) urls.push(`${SITE_URL}/sitemaps/books-${page}.xml`);
  return checkedXml(`${xmlHeader}\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join("")}</sitemapindex>`, urls.length);
}

export function renderStaticSitemap(): string {
  return urlset(staticPaths.flatMap((path) => SITEMAP_LOCALES.map((locale) => pageEntry(path, locale, SITEMAP_LOCALES))));
}

export function renderBooksSitemap(books: SitemapBook[]): string {
  if (books.length > BOOKS_PER_SITEMAP) throw new Error("Sitemap book shard is too large");
  return urlset(books.flatMap((book) => {
    // The fallback is an actual base translation, unlike the requested UI locale.
    const locales = SITEMAP_LOCALES.filter((locale) => book.availableLocales.includes(locale) || book.fallbackLocale === locale);
    const path = `/books/${encodeURIComponent(book.slug)}`;
    return locales.map((locale) => pageEntry(path, locale, locales));
  }));
}

export function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=300, s-maxage=300", "X-Content-Type-Options": "nosniff" },
  });
}

export function sitemapUnavailable(): Response {
  return new Response("Sitemap temporarily unavailable. Please retry later.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "300" },
  });
}

export function sitemapDisabled(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
