import { InMemoryCatalogRepository } from './in-memory-catalog.repository';

describe('InMemoryCatalogRepository fixtures', () => {
  it('keeps checkout IDs, source prices, locales and availability aligned with the storefront', async () => {
    const repository = new InMemoryCatalogRepository();
    const result = await repository.search({ offset: 0, limit: 100 });
    const projection = result.items.map(({ id, sourcePriceAmd, locale, availability }) => ({
      id,
      sourcePriceAmd,
      locale,
      availability,
    }));

    expect(result.total).toBe(8);
    expect(projection).toEqual([
      {
        id: 'd1e7c1be-74e2-4c7a-9e9d-4aee1bc12301',
        sourcePriceAmd: 5200,
        locale: 'hy',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: '29f69fbb-569c-45df-9293-a7f8a31c3331',
        sourcePriceAmd: 2700,
        locale: 'ru',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: 'a17da6f2-e994-48d1-a4c4-fbb402f78737',
        sourcePriceAmd: 6200,
        locale: 'ru',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: '720a3034-fd32-4d9e-a6a0-78a1bec13404',
        sourcePriceAmd: 4500,
        locale: 'ru',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: 'e6f5c76e-7c93-4c5a-8ca1-05964d913505',
        sourcePriceAmd: 6900,
        locale: 'ru',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: '51e3034d-eec6-4f3c-81c6-f91043a13606',
        sourcePriceAmd: 8800,
        locale: 'en',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: '99ce814c-53e2-4ced-9874-01d36a713707',
        sourcePriceAmd: 3100,
        locale: 'ru',
        availability: 'PRELIMINARY_AVAILABLE',
      },
      {
        id: '4ad0fc5d-3739-49b7-84fa-11d895a13808',
        sourcePriceAmd: 2800,
        locale: 'ru',
        availability: 'OUT_OF_STOCK',
      },
    ]);
  });

  it('returns defensive copies so callers cannot mutate fixture state', async () => {
    const repository = new InMemoryCatalogRepository();
    const id = 'd1e7c1be-74e2-4c7a-9e9d-4aee1bc12301';
    const first = await repository.findById(id);
    if (!first) throw new Error('Fixture is missing');
    first.sourcePriceAmd = 1;

    await expect(repository.findById(id)).resolves.toMatchObject({ sourcePriceAmd: 5200 });
  });

  it('uses locale for response localization without hiding books in other languages', async () => {
    const repository = new InMemoryCatalogRepository();

    const result = await repository.search({ locale: 'en', offset: 0, limit: 100 });

    expect(result.total).toBe(8);
    expect(new Set(result.items.map((book) => book.language))).toEqual(new Set(['hy', 'ru', 'en']));
  });

  it('filters by edition language and sorts by source price', async () => {
    const repository = new InMemoryCatalogRepository();

    const result = await repository.search({
      language: 'ru',
      sort: 'price-asc',
      offset: 0,
      limit: 100,
    });

    expect(result.total).toBe(6);
    expect(result.items.every((book) => book.language === 'ru')).toBe(true);
    expect(result.items.map((book) => book.sourcePriceAmd)).toEqual([2700, 2800, 3100, 4500, 6200, 6900]);
  });

  it('combines precise advanced-search fields', async () => {
    const repository = new InMemoryCatalogRepository();

    await expect(repository.search({
      title: 'Маленький',
      author: 'Сент-Экзюпери',
      offset: 0,
      limit: 10,
    })).resolves.toMatchObject({ total: 1, items: [{ slug: 'the-little-prince' }] });
    await expect(repository.search({
      title: 'Маленький',
      author: 'Джеймс Клир',
      offset: 0,
      limit: 10,
    })).resolves.toMatchObject({ total: 0, items: [] });
  });

  it('finds a defensive copy by public slug', async () => {
    const repository = new InMemoryCatalogRepository();

    const book = await repository.findBySlug('the-little-prince');
    expect(book).toMatchObject({ title: 'Маленький принц' });
    if (!book) throw new Error('Fixture is missing');
    book.title = 'changed';
    await expect(repository.findBySlug('the-little-prince')).resolves.toMatchObject({
      title: 'Маленький принц',
    });
  });

  it('stores localized categories and links one category to matching books', async () => {
    const repository = new InMemoryCatalogRepository();
    const observedAt = '2026-09-04T07:00:00.000Z';
    const id = '11111111-1111-5111-8111-111111111111';
    await repository.upsertCategories(
      ([
        ['hy', 'Դասական գրականություն'],
        ['ru', 'Классическая литература'],
        ['en', 'Classic literature'],
      ] as const).map(([locale, name]) => ({
        id,
        supplierCategoryId: '7476',
        parentId: null,
        parentSupplierCategoryId: null,
        position: 1,
        locale,
        name,
        sourceUrl: `https://www.books.am/${locale === 'hy' ? 'am' : locale}/catalog/category/view/id/7476/`,
        observedAt,
      })),
    );

    await expect(
      repository.linkBooksToCategory(['the-little-prince'], '7476', observedAt),
    ).resolves.toBe(1);
    await expect(
      repository.search({ category: '7476', offset: 0, limit: 10 }),
    ).resolves.toMatchObject({ total: 1, items: [{ slug: 'the-little-prince' }] });
    const categories = await repository.listCategories();
    expect(categories[0]?.localizations).toMatchObject({
      hy: { name: 'Դասական գրականություն' },
      ru: { name: 'Классическая литература' },
      en: { name: 'Classic literature' },
    });
  });
});
