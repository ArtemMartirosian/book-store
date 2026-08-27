import { Injectable } from '@nestjs/common';
import { BOOKS_SITEMAPS, type CrawlerLocale } from './crawler.types';

const ALLOWED_ROOT_SITEMAPS = new Set<string>(BOOKS_SITEMAPS.map(({ url }) => url));
const SITEMAP_PREFIX = '/pub/sitemap/';
const SAFE_XML_FILENAME = /^[a-z0-9][a-z0-9._~-]*\.xml$/u;

@Injectable()
export class CrawlerSitemapPolicyService {
  listAllowed() {
    return BOOKS_SITEMAPS.map((target) => ({ ...target }));
  }

  normalize(rawUrl: string): string | null {
    return this.classify(rawUrl)?.url ?? null;
  }

  classify(
    rawUrl: string,
  ): { url: string; locale: CrawlerLocale; root: boolean } | null {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return null;
    }

    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'www.books.am' ||
      parsed.port ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return null;
    }

    const normalized = parsed.toString();
    const root = BOOKS_SITEMAPS.find(({ url }) => url === normalized);
    if (root) return { url: normalized, locale: root.locale, root: true };

    if (!parsed.pathname.startsWith(SITEMAP_PREFIX)) return null;
    const filename = parsed.pathname.slice(SITEMAP_PREFIX.length);
    if (!SAFE_XML_FILENAME.test(filename) || filename.includes('/')) return null;
    const locale = BOOKS_SITEMAPS.find(({ locale: candidate }) =>
      new RegExp(`(?:^|[_-])${candidate}(?:[_-]|\\.)`, 'u').test(filename),
    )?.locale;
    if (!locale) return null;
    return { url: normalized, locale, root: ALLOWED_ROOT_SITEMAPS.has(normalized) };
  }

  normalizeChild(rawUrl: string, locale: CrawlerLocale): string | null {
    const classified = this.classify(rawUrl);
    if (!classified || classified.root || classified.locale !== locale) return null;
    return classified.url;
  }
}
