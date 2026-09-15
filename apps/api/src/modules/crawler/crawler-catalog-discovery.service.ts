import { Injectable } from '@nestjs/common';
import { load } from 'cheerio';

const ALLOWED_HOSTS = new Set(['books.am', 'www.books.am']);
const CATEGORY_PATH =
  /^\/(am|ru|en)\/catalog\/category\/view\/(?:s\/[\p{L}\p{N}._~-]+\/)?id\/(\d+)\/?$/u;
const BOOKS_ROOT_CATEGORY_ID = '7463';

interface CatalogLocation {
  locale: string;
  categoryId: string;
}

export interface DiscoveredCatalogCategory {
  supplierCategoryId: string;
  parentSupplierCategoryId: string | null;
  locale: 'hy' | 'ru' | 'en';
  name: string;
  sourceUrl: string;
  position: number;
  observedAt: string;
}

@Injectable()
export class CrawlerCatalogDiscoveryService {
  normalizePageUrl(rawUrl: string): string {
    const url = new URL(rawUrl);
    const match = url.pathname.match(CATEGORY_PATH);
    const keys = [...url.searchParams.keys()];
    const language = url.searchParams.get('language');
    const page = url.searchParams.get('p');
    if (
      url.protocol !== 'https:' ||
      url.port ||
      !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
      !match ||
      url.hash ||
      keys.some((key) => key !== 'language' && key !== 'p') ||
      (language !== null && !/^\d+$/u.test(language)) ||
      (page !== null && !/^[1-9]\d*$/u.test(page))
    ) {
      throw new Error('CRAWLER_CATALOG_URL_NOT_ALLOWED');
    }
    url.hostname = 'www.books.am';
    url.pathname = `/${match[1]}/catalog/category/view/id/${match[2]}/`;
    url.search = '';
    if (language) url.searchParams.set('language', language);
    if (page && page !== '1') url.searchParams.set('p', page);
    return url.toString();
  }

  segmentUrl(rawUrl: string): string {
    const url = new URL(this.normalizePageUrl(rawUrl));
    url.searchParams.delete('p');
    return url.toString();
  }

  categoryLocation(rawUrl: string): CatalogLocation {
    return this.location(this.segmentUrl(rawUrl));
  }

  discoverCategories(html: string, sourceUrl: string): DiscoveredCatalogCategory[] {
    const $ = load(html);
    const current = this.location(this.segmentUrl(sourceUrl));
    if (current.categoryId !== BOOKS_ROOT_CATEGORY_ID) {
      throw new Error('CRAWLER_CATEGORY_TREE_REQUIRES_BOOKS_ROOT');
    }
    const booksBranch = this.booksBranch($, sourceUrl, current);
    if (!booksBranch?.length) throw new Error('CRAWLER_BOOKS_CATEGORY_TREE_NOT_FOUND');

    const observedAt = new Date().toISOString();
    const seen = new Set<string>();
    const categories: DiscoveredCatalogCategory[] = [];
    booksBranch.find('a[href*="/catalog/category/view/"]').each((_index, link) => {
      const href = $(link).attr('href');
      if (!href) return;
      try {
        const candidate = this.segmentUrl(new URL(href, sourceUrl).toString());
        const location = this.location(candidate);
        if (
          location.locale !== current.locale ||
          new URL(candidate).search ||
          seen.has(location.categoryId)
        ) {
          return;
        }
        const name = $(link).text().replace(/\s+/gu, ' ').trim();
        if (!name) return;
        seen.add(location.categoryId);

        let parentSupplierCategoryId: string | null = null;
        let ancestor = $(link).closest('li').parent().closest('li');
        while (ancestor.length && !parentSupplierCategoryId) {
          const parentLink = ancestor.children('a[href*="/catalog/category/view/"]').first();
          const parentHref = parentLink.attr('href');
          if (parentHref) {
            try {
              const parent = this.location(
                this.segmentUrl(new URL(parentHref, sourceUrl).toString()),
              );
              if (parent.locale === current.locale) {
                parentSupplierCategoryId = parent.categoryId;
              }
            } catch {
              // Keep walking until the nearest valid category ancestor.
            }
          }
          ancestor = ancestor.parent().closest('li');
        }
        if (location.categoryId === BOOKS_ROOT_CATEGORY_ID) {
          parentSupplierCategoryId = null;
        } else if (!parentSupplierCategoryId) {
          parentSupplierCategoryId = BOOKS_ROOT_CATEGORY_ID;
        }

        categories.push({
          supplierCategoryId: location.categoryId,
          parentSupplierCategoryId,
          locale: current.locale === 'am' ? 'hy' : (current.locale as 'ru' | 'en'),
          name: name.slice(0, 500),
          sourceUrl: candidate,
          position: categories.length,
          observedAt,
        });
      } catch {
        // Only strict public category URLs are accepted.
      }
    });
    return categories;
  }

  discoverSegments(html: string, sourceUrl: string): string[] {
    const $ = load(html);
    const currentSegment = this.segmentUrl(sourceUrl);
    const current = this.location(currentSegment);
    const segments = new Set<string>([currentSegment]);

    // Language filters partition the oversized root result set into public,
    // independently pageable result sets. Other filter parameters stay blocked.
    $('a[href*="/catalog/category/view/"]').each((_index, link) => {
      const href = $(link).attr('href');
      if (!href) return;
      try {
        const absolute = new URL(href, sourceUrl);
        const candidate = this.segmentUrl(absolute.toString());
        const candidateLocation = this.location(candidate);
        const hasLanguage = new URL(candidate).searchParams.has('language');
        const isLocaleRoot =
          candidateLocation.categoryId === BOOKS_ROOT_CATEGORY_ID &&
          candidateLocation.locale === current.locale &&
          !hasLanguage;
        const isRootLanguagePartition =
          current.categoryId === BOOKS_ROOT_CATEGORY_ID &&
          candidateLocation.categoryId === BOOKS_ROOT_CATEGORY_ID &&
          candidateLocation.locale === current.locale &&
          hasLanguage;
        if (isLocaleRoot || isRootLanguagePartition) segments.add(candidate);
      } catch {
        // Non-catalog and layered filter URLs are intentionally excluded.
      }
    });

    // The public navigation contains the complete category tree. Restrict the
    // traversal to descendants of the Books root <li>, so unrelated store
    // departments are never added to the crawl queue.
    const booksBranch = this.booksBranch($, sourceUrl, current);

    booksBranch?.find('a[href*="/catalog/category/view/"]').each((_index, link) => {
      const href = $(link).attr('href');
      if (!href) return;
      try {
        const candidate = this.segmentUrl(new URL(href, sourceUrl).toString());
        const location = this.location(candidate);
        if (
          location.locale === current.locale &&
          !new URL(candidate).searchParams.has('language')
        ) {
          segments.add(candidate);
        }
      } catch {
        // Only strict public category URLs can enter the queue.
      }
    });
    return [...segments];
  }

  private booksBranch(
    $: ReturnType<typeof load>,
    sourceUrl: string,
    current: CatalogLocation,
  ) {
    const booksBranches = $('a[href*="/catalog/category/view/"]')
      .toArray()
      .flatMap((link) => {
        const href = $(link).attr('href');
        if (!href) return [];
        try {
          const candidate = this.segmentUrl(new URL(href, sourceUrl).toString());
          const location = this.location(candidate);
          if (
            location.categoryId !== BOOKS_ROOT_CATEGORY_ID ||
            location.locale !== current.locale ||
            new URL(candidate).search
          ) {
            return [];
          }
          const branch = $(link).closest('li');
          return branch.length ? [branch] : [];
        } catch {
          return [];
        }
      })
      .sort(
        (left, right) =>
          right.find('a[href*="/catalog/category/view/"]').length -
          left.find('a[href*="/catalog/category/view/"]').length,
      );
    return booksBranches[0];
  }

  private location(rawUrl: string): CatalogLocation {
    const url = new URL(rawUrl);
    const match = url.pathname.match(CATEGORY_PATH);
    if (!match) throw new Error('CRAWLER_CATALOG_URL_NOT_ALLOWED');
    return { locale: match[1]!, categoryId: match[2]! };
  }
}
