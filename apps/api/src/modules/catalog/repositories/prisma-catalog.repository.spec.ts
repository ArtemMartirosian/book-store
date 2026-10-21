import { PrismaService } from '../../../database/prisma.service';
import type { BookRecord, StoreLocale } from '../book.model';
import type { CatalogCategorySnapshot } from './catalog.repository';
import { PrismaCatalogRepository } from './prisma-catalog.repository';

const observedAt = '2026-09-15T12:00:00.000Z';
const parsedBook = (): BookRecord => ({
  id: '11111111-1111-4111-8111-111111111111',
  supplierSku: 'BOOK-100',
  slug: 'books-am-100',
  title: 'Supplier title',
  author: 'Supplier author',
  description: 'Supplier description',
  language: 'ru',
  locale: 'ru',
  isbn: null,
  publisher: null,
  sourcePriceAmd: 7500,
  availability: 'OUT_OF_STOCK',
  sourceUrl: 'https://www.books.am/ru/catalog/product/view/id/100/',
  coverImageUrl: 'https://www.books.am/new-cover.jpg',
  imageUrls: ['https://www.books.am/new-cover.jpg'],
  observedAt,
  localizations: {
    ru: {
      parserVersion: 'books-html-v3',
      locale: 'ru',
      title: 'Supplier title',
      author: 'Supplier author',
      description: 'Supplier description',
      languageLabel: 'Русский',
      isbn: null,
      publisher: null,
      productCode: 'BOOK-100',
      weight: null,
      barcode: null,
      isNew: null,
      pageCount: null,
      coverType: null,
      dimensions: null,
      publicationYear: null,
      series: null,
      imageUrls: ['https://www.books.am/new-cover.jpg'],
      attributes: [],
      detailSections: [],
      sourceUrl: 'https://www.books.am/ru/catalog/product/view/id/100/',
      observedAt,
    },
  },
});

const harness = (manualEdited: boolean, translationManualEdited = false) => {
  const bookUpsert = jest.fn().mockResolvedValue({ id: parsedBook().id, manualEdited });
  const translationUpsert = jest.fn().mockResolvedValue({});
  const transaction = {
    catalogBook: {
      findUnique: jest.fn().mockResolvedValue({
        imageUrls: ['https://www.books.am/manual-cover.jpg'],
        manualEdited,
        translations: [{ manualEdited: translationManualEdited }],
      }),
      upsert: bookUpsert,
    },
    catalogBookTranslation: { upsert: translationUpsert },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: (client: typeof transaction) => unknown) => operation(transaction)),
  } as unknown as PrismaService;
  return { repository: new PrismaCatalogRepository(prisma), bookUpsert, translationUpsert };
};

describe('PrismaCatalogRepository crawler updates', () => {
  it('refreshes supplier price, stock and observation time without touching a manually edited book or its translations', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(true, true);
    await repository.upsert(parsedBook());

    expect(bookUpsert.mock.calls[0][0].update).toEqual({
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
      observedAt: new Date(observedAt),
    });
    expect(translationUpsert).not.toHaveBeenCalled();
  });

  it('preserves an independently protected translation even when the parent manual flag is false', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(false, true);
    await repository.upsert(parsedBook());

    expect(bookUpsert.mock.calls[0][0].update).toEqual({
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
      observedAt: new Date(observedAt),
    });
    expect(translationUpsert).not.toHaveBeenCalled();
  });

  it('continues normal editorial and localized synchronization for an unprotected book', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(false);
    await repository.upsert(parsedBook());

    expect(bookUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      description: 'Supplier description',
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
    });
    expect(translationUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      description: 'Supplier description',
      parserVersion: 'books-html-v3',
    });
  });

  it('explicit force refresh replaces protected content and images and clears both manual flags', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(true, true);
    await repository.upsert(parsedBook(), { force: true });

    expect(bookUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      description: 'Supplier description',
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
      imageUrls: ['https://www.books.am/new-cover.jpg'],
      coverImageUrl: 'https://www.books.am/new-cover.jpg',
      manualEdited: false,
    });
    expect(translationUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      imageUrls: ['https://www.books.am/new-cover.jpg'],
      manualEdited: false,
    });
  });
});

const categorySnapshot = (
  supplierCategoryId: string,
  locale: StoreLocale,
  overrides: Partial<CatalogCategorySnapshot> = {},
): CatalogCategorySnapshot => ({
  id: 'category-' + supplierCategoryId,
  supplierCategoryId,
  parentId: null,
  parentSupplierCategoryId: null,
  position: 0,
  locale,
  name: supplierCategoryId + ' ' + locale,
  sourceUrl: 'https://www.books.am/' + locale + '/category-' + supplierCategoryId,
  observedAt,
  ...overrides,
});

const categoryHarness = (existing: Array<{
  id: string;
  supplierCategoryId: string;
  manualEdited: boolean;
  translations: Array<{ locale: StoreLocale; manualEdited: boolean }>;
}> = []) => {
  const categoryFind = jest.fn().mockResolvedValue(existing);
  const categoryUpsert = jest.fn().mockImplementation(async (input: {
    where: { supplierCategoryId: string }; create: { id: string };
  }) => ({
    id: existing.find((category) => category.supplierCategoryId === input.where.supplierCategoryId)?.id
      ?? input.create.id,
  }));
  const translationUpsert = jest.fn().mockResolvedValue({});
  const transaction = {
    catalogCategory: { findMany: categoryFind, upsert: categoryUpsert },
    catalogCategoryTranslation: { upsert: translationUpsert },
  };
  const transact = jest.fn(async (
    operation: (client: typeof transaction) => unknown,
    _options?: { maxWait: number; timeout: number },
  ) => operation(transaction));
  const prisma = { $transaction: transact } as unknown as PrismaService;
  return {
    repository: new PrismaCatalogRepository(prisma),
    categoryFind, categoryUpsert, translationUpsert, transact,
  };
};

describe('PrismaCatalogRepository category tree import', () => {
  it('deduplicates shared category writes while retaining the final snapshot and final text per locale', async () => {
    const { repository, categoryFind, categoryUpsert, translationUpsert } = categoryHarness();
    await repository.upsertCategories([
      categorySnapshot('10', 'hy', { id: 'first-id', position: 1 }),
      categorySnapshot('10', 'ru', { position: 2 }),
      categorySnapshot('10', 'hy', { name: 'Updated Armenian name' }),
      categorySnapshot('10', 'en', { id: 'later-id', parentId: 'last-parent', position: 3 }),
    ]);
    expect(categoryFind).toHaveBeenCalledTimes(1);
    expect(categoryUpsert).toHaveBeenCalledTimes(1);
    expect(categoryUpsert.mock.calls[0][0]).toMatchObject({
      create: { id: 'first-id', parentId: 'last-parent', position: 3 },
      update: { parentId: 'last-parent', position: 3, observedAt: new Date(observedAt) },
    });
    expect(translationUpsert).toHaveBeenCalledTimes(3);
    expect(translationUpsert.mock.calls.map(([input]) => input.create.locale)).toEqual(['hy', 'ru', 'en']);
    expect(translationUpsert.mock.calls[0][0].update.name).toBe('Updated Armenian name');
    expect(translationUpsert.mock.calls.every(([input]) => input.create.categoryId === 'first-id')).toBe(true);
  });

  it('protects manually edited hierarchy separately from each locale and uses the persisted category identity', async () => {
    const { repository, categoryUpsert, translationUpsert } = categoryHarness([{
      id: 'persisted-id', supplierCategoryId: '10', manualEdited: true,
      translations: [{ locale: 'hy', manualEdited: false }, { locale: 'ru', manualEdited: true }],
    }]);
    await repository.upsertCategories([
      categorySnapshot('10', 'hy', { parentId: 'supplier-parent', position: 9 }),
      categorySnapshot('10', 'ru', { parentId: 'supplier-parent', position: 9 }),
      categorySnapshot('10', 'en', { parentId: 'supplier-parent', position: 9 }),
    ]);
    expect(categoryUpsert.mock.calls[0][0].update).toEqual({ observedAt: new Date(observedAt) });
    const translations = new Map(translationUpsert.mock.calls.map(([input]) => [input.create.locale, input]));
    expect(translations.get('ru').update).toEqual({ observedAt: new Date(observedAt) });
    expect(translations.get('hy').update).toMatchObject({ name: '10 hy' });
    expect(translations.get('en').update).toMatchObject({ name: '10 en' });
    expect(translationUpsert.mock.calls.every(([input]) => input.create.categoryId === 'persisted-id')).toBe(true);
  });

  it('keeps an independently protected translation when the hierarchy remains automatic', async () => {
    const { repository, categoryUpsert, translationUpsert } = categoryHarness([{
      id: 'persisted-id', supplierCategoryId: '10', manualEdited: false,
      translations: [{ locale: 'en', manualEdited: true }],
    }]);
    await repository.upsertCategories([categorySnapshot('10', 'en', { parentId: 'new-parent', position: 8 })]);
    expect(categoryUpsert.mock.calls[0][0].update).toEqual({
      parentId: 'new-parent', position: 8, observedAt: new Date(observedAt),
    });
    expect(translationUpsert.mock.calls[0][0].update).toEqual({ observedAt: new Date(observedAt) });
  });

  it('retains parent-before-child write order across the three language trees', async () => {
    const { repository, categoryUpsert } = categoryHarness();
    await repository.upsertCategories((['hy', 'ru', 'en'] as const).flatMap((locale) => [
      categorySnapshot('root', locale),
      categorySnapshot('child', locale, { parentId: 'category-root', parentSupplierCategoryId: 'root' }),
    ]));
    expect(categoryUpsert.mock.calls.map(([input]) => input.where.supplierCategoryId)).toEqual(['root', 'child']);
    expect(categoryUpsert.mock.calls[1][0].create.parentId).toBe('category-root');
  });

  it('imports a large three-language tree in one bounded transaction with one lookup and one write per category', async () => {
    const { repository, categoryFind, categoryUpsert, translationUpsert, transact } = categoryHarness();
    const categories = (['hy', 'ru', 'en'] as const).flatMap((locale) =>
      Array.from({ length: 300 }, (_, index) => categorySnapshot(String(index), locale, {
        parentId: index === 0 ? null : 'category-0',
        parentSupplierCategoryId: index === 0 ? null : '0',
        position: index,
      })),
    );
    await repository.upsertCategories(categories);
    expect(transact).toHaveBeenCalledTimes(1);
    expect(transact.mock.calls[0]?.[1]).toEqual({ maxWait: 5_000, timeout: 60_000 });
    expect(categoryFind).toHaveBeenCalledTimes(1);
    expect(categoryFind.mock.calls[0][0].where.supplierCategoryId.in).toHaveLength(300);
    expect(categoryUpsert).toHaveBeenCalledTimes(300);
    expect(translationUpsert).toHaveBeenCalledTimes(900);
  });

  it('does not begin a transaction for empty input or invalid observation times', async () => {
    const { repository, transact } = categoryHarness();
    await repository.upsertCategories([]);
    expect(transact).not.toHaveBeenCalled();
    await expect(repository.upsertCategories([
      categorySnapshot('root', 'hy'),
      categorySnapshot('invalid', 'hy', { observedAt: 'invalid' }),
    ])).rejects.toThrow('Invalid book observedAt timestamp');
    expect(transact).not.toHaveBeenCalled();
  });

  it('propagates a write failure out of the transaction instead of continuing the tree import', async () => {
    const { repository, categoryUpsert, translationUpsert, transact } = categoryHarness();
    const failure = new Error('category translation conflict');
    translationUpsert.mockRejectedValueOnce(failure);
    await expect(repository.upsertCategories([
      categorySnapshot('root', 'hy'), categorySnapshot('child', 'hy'),
    ])).rejects.toBe(failure);
    expect(transact).toHaveBeenCalledTimes(1);
    expect(categoryUpsert).toHaveBeenCalledTimes(1);
  });
});
