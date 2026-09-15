import { CrawlerCatalogDiscoveryService } from './crawler-catalog-discovery.service';

describe('CrawlerCatalogDiscoveryService', () => {
  const service = new CrawlerCatalogDiscoveryService();
  const root = 'https://www.books.am/ru/catalog/category/view/id/7463/';

  it('normalizes only public book-category pages and language partitions', () => {
    expect(
      service.normalizePageUrl(
        'https://books.am/ru/catalog/category/view/s/knigi/id/7463/?p=7&language=5672',
      ),
    ).toBe(`${root}?language=5672&p=7`);
    expect(service.segmentUrl(`${root}?language=5672&p=7`)).toBe(
      `${root}?language=5672`,
    );
    expect(() => service.normalizePageUrl(`${root}?cat=7481`)).toThrow(
      'CRAWLER_CATALOG_URL_NOT_ALLOWED',
    );
    expect(
      service.normalizePageUrl(
        'https://www.books.am/ru/catalog/category/view/s/it/id/7569/?p=2',
      ),
    ).toBe('https://www.books.am/ru/catalog/category/view/id/7569/?p=2');
    expect(() =>
      service.normalizePageUrl(
        'https://example.com/ru/catalog/category/view/s/knigi/id/7463/',
      ),
    ).toThrow('CRAWLER_CATALOG_URL_NOT_ALLOWED');
  });

  it('discovers root languages and only the Books navigation branch', () => {
    const html = `
      <ul>
        <li><a href="/ru/catalog/category/view/id/7000/">Souvenirs</a></li>
        <li>
          <a href="/ru/catalog/category/view/s/knigi/id/7463/">Books</a>
          <ul>
            <li><a href="/ru/catalog/category/view/id/7464/">Fiction</a></li>
            <li><a href="/ru/catalog/category/view/s/it/id/7569/">IT</a></li>
          </ul>
        </li>
        <li><a href="/ru/catalog/category/view/id/8000/">Stationery</a></li>
      </ul>
      <a href="${root}?p=2">2</a>
      <a href="${root}?language=5672">русский</a>
      <a href="${root}?language=5671">հայերեն</a>
      <a href="https://www.books.am/am/catalog/category/view/s/knigi/id/7463/?p=8">Հայ</a>
      <a href="https://www.books.am/en/catalog/category/view/s/knigi/id/7463/?p=8">Eng</a>
      <a href="${root}?cat=7481">Non-fiction</a>
      <a href="https://evil.example/ru/catalog/category/view/s/knigi/id/7463/">bad</a>
    `;
    expect(service.discoverSegments(html, root)).toEqual([
      root,
      `${root}?language=5672`,
      `${root}?language=5671`,
      'https://www.books.am/ru/catalog/category/view/id/7464/',
      'https://www.books.am/ru/catalog/category/view/id/7569/',
    ]);
  });

  it('does not multiply every child category by its language filters', () => {
    const child = 'https://www.books.am/ru/catalog/category/view/id/7569/';
    expect(
      service.discoverSegments(
        `<a href="${child}?language=5672">русский</a>`,
        child,
      ),
    ).toEqual([child]);
  });

  it('parses the localized Books category tree with parent relationships', () => {
    const categories = service.discoverCategories(
      `<ul><li>
        <a class="submenu_btn" href="/ru/catalog/category/view/s/knigi/id/7463/">Книги</a>
        <ul><li>
          <a href="/ru/catalog/category/view/id/7464/">Художественная литература</a>
          <ul><li><a href="/ru/catalog/category/view/id/7465/">Детская литература</a></li></ul>
        </li></ul>
      </li></ul>`,
      root,
    );

    expect(categories.map(({ supplierCategoryId, parentSupplierCategoryId, name }) => ({
      supplierCategoryId,
      parentSupplierCategoryId,
      name,
    }))).toEqual([
      { supplierCategoryId: '7463', parentSupplierCategoryId: null, name: 'Книги' },
      {
        supplierCategoryId: '7464',
        parentSupplierCategoryId: '7463',
        name: 'Художественная литература',
      },
      {
        supplierCategoryId: '7465',
        parentSupplierCategoryId: '7464',
        name: 'Детская литература',
      },
    ]);
    expect(categories.every(({ locale }) => locale === 'ru')).toBe(true);
  });
});
