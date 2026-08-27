import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import { BOOKS_SITEMAPS } from './crawler.types';

describe('CrawlerSitemapPolicyService', () => {
  const policy = new CrawlerSitemapPolicyService();

  it('exposes only the three contractual locale root sitemaps', () => {
    expect(policy.listAllowed()).toEqual([
      { locale: 'hy', url: 'https://www.books.am/pub/sitemap/sitemap_hy.xml' },
      { locale: 'ru', url: 'https://www.books.am/pub/sitemap/sitemap_ru.xml' },
      { locale: 'en', url: 'https://www.books.am/pub/sitemap/sitemap_en.xml' },
    ]);
    expect(policy.listAllowed()).toHaveLength(BOOKS_SITEMAPS.length);
  });

  it('allows one-level child XML only inside the contractual prefix and locale', () => {
    expect(
      policy.normalizeChild(
        'https://www.books.am/pub/sitemap/catalog_hy_books.xml',
        'hy',
      ),
    ).toBe('https://www.books.am/pub/sitemap/catalog_hy_books.xml');
    expect(
      policy.normalizeChild(
        'https://www.books.am/pub/sitemap/catalog_ru_books.xml',
        'hy',
      ),
    ).toBeNull();
  });

  it.each([
    'http://www.books.am/pub/sitemap/sitemap_hy.xml',
    'https://books.am/pub/sitemap/sitemap_hy.xml',
    'https://www.books.am/pub/sitemap/sitemap_hy.xml?cache=1',
    'https://www.books.am/pub/sitemap/nested/catalog_hy.xml',
    'https://www.books.am/pub/sitemap/catalog.xml',
    'https://www.books.am/am/sitemap.xml',
  ])('rejects non-contractual sitemap URL %s', (url) => {
    expect(policy.normalize(url)).toBeNull();
  });
});
