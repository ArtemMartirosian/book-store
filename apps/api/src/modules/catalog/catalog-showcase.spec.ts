import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import type { BookLocalization, BookRecord, StoreLocale } from './book.model';
import { CatalogService } from './catalog.service';
import { CatalogShowcaseController } from './catalog-showcase.controller';
import { SHOWCASE_LIMITS } from './catalog-showcase';
import { InMemoryCatalogRepository } from './repositories/in-memory-catalog.repository';
import { PrismaCatalogRepository } from './repositories/prisma-catalog.repository';

const observedAt = '2026-11-09T12:00:00.000Z';
const placeholder = 'https://books.am/media/catalog/product/placeholder/default/Books_Default_image.jpg';
const cover = 'https://books.am/media/catalog/product/a/book.jpg';

const localization = (locale: StoreLocale, isNew: boolean | null, imageUrls: string[]): BookLocalization => ({
  parserVersion: 'books-html-v3',
  locale,
  title: 'Localized title ' + locale,
  author: 'Localized author ' + locale,
  description: 'A long source description, not a card field',
  languageLabel: null,
  isbn: null,
  publisher: 'Localized publisher ' + locale,
  productCode: 'private-source-key',
  weight: null,
  barcode: null,
  isNew,
  pageCount: null,
  coverType: null,
  dimensions: null,
  publicationYear: null,
  series: null,
  imageUrls,
  attributes: [],
  detailSections: [],
  sourceUrl: 'https://books.am/' + locale + '/edition',
  observedAt,
});

const edition = (id: number, overrides: Partial<BookRecord> = {}): BookRecord => ({
  id: 'book-' + id,
  slug: 'books-am-' + id,
  supplierSku: 'private-' + id,
  title: 'Edition ' + id,
  author: 'Author ' + id,
  description: 'A long source description, not a card field',
  isbn: null,
  publisher: 'Publisher',
  language: 'hy',
  locale: 'hy',
  isNew: true,
  availability: 'PRELIMINARY_AVAILABLE',
  coverImageUrl: cover,
  sourcePriceAmd: 2000 + id,
  sourceUrl: 'https://books.am/am/' + id,
  observedAt,
  ...overrides,
});

describe('homepage showcase', () => {
  it('retains genuine localization, pricing, actual cover and categories without leaking detail or supplier fields', async () => {
    const repository = new InMemoryCatalogRepository();
    const category = (supplierCategoryId: string, parentSupplierCategoryId: string | null) => ({
      supplierCategoryId, parentSupplierCategoryId,
      id: 'category-' + supplierCategoryId,
      parentId: parentSupplierCategoryId ? 'category-' + parentSupplierCategoryId : null,
      name: 'Category ' + supplierCategoryId, position: 0,
      locale: 'hy' as const, sourceUrl: 'https://books.am/am/category/' + supplierCategoryId, observedAt,
    });
    await repository.upsertCategories([category('7463', null), category('7464', '7463'), category('10', '7464'), category('7480', '7463')]);
    await repository.upsert(edition(1, {
      coverImageUrl: placeholder,
      imageUrls: [placeholder, cover],
      localizations: { hy: localization('hy', true, [cover]), ru: localization('ru', null, [placeholder]) },
    }));
    await repository.linkBooksToCategory(['books-am-1'], '10', observedAt);
    await repository.upsert(edition(2, { availability: 'OUT_OF_STOCK' }));
    const controller = new CatalogShowcaseController(new CatalogService(repository, new PricingService(new ConfigService({
      PRICE_MARKUP_PER_ITEM_AMD: 700,
    }))));
    const result = await controller.get('ru');
    const book = result.books.find(({ id }) => id === 'book-1');
    expect(book).toEqual({
      id: 'book-1', slug: 'edition-1', title: 'Localized title ru', author: 'Localized author ru',
      language: 'hy', locale: 'ru', publisher: 'Localized publisher ru', availability: 'PRELIMINARY_AVAILABLE',
      isNew: null, coverImageUrl: cover, observedAt, categoryIds: ['10'], price: { amount: 2701, currency: 'AMD' },
    });
    expect(result.books.some(({ id }) => id === 'book-2')).toBe(false);
    expect(result.newBooks).toEqual([]);
    expect(result.categoryPreviews).toEqual([{ categoryId: '7464', books: [book] }]);
    expect((await controller.get('hy')).newBooks.map(({ id }) => id)).toEqual(['book-1']);
    expect(() => controller.get('fr')).toThrow(BadRequestException);
  });

  it('caps all shelves and prefers covered real books over placeholders and unavailable books', async () => {
    const repository = new InMemoryCatalogRepository();
    for (let id = 1; id <= 40; id++) {
      await repository.upsert(edition(id, id === 40 ? { coverImageUrl: placeholder } : {}));
    }
    const result = await repository.showcase('en');
    expect(result.books).toHaveLength(SHOWCASE_LIMITS.recent);
    expect(result.newBooks).toHaveLength(SHOWCASE_LIMITS.new);
    expect(result.affordableBooks).toHaveLength(SHOWCASE_LIMITS.affordable);
    expect(result.books.every(({ coverImageUrl }) => coverImageUrl === cover)).toBe(true);
    expect(result.affordableBooks.map(({ sourcePriceAmd }) => sourcePriceAmd)).toEqual(
      Array.from({ length: SHOWCASE_LIMITS.affordable }, (_, index) => 2001 + index),
    );
  });

  it('selects bounded ID shelves and hydrates their union without catalog counts or heavy detail reads', async () => {
    const category = (id: string, parent?: { id: string; supplierCategoryId: string }) => ({
      id: 'category-' + id, supplierCategoryId: id, position: 0, parentId: parent?.id ?? null,
      parent: parent ?? null, observedAt: new Date(observedAt),
      translations: [{ locale: 'hy', name: id, sourceUrl: 'https://books.am/am/' + id, observedAt: new Date(observedAt) }],
    });
    const root = category('7463');
    const department = category('7464', root);
    const categories = [root, department, category('10', department), category('7480', root)];
    const row = {
      ...edition(1),
      publicSlug: 'edition-1',
      imageUrls: [cover],
      observedAt: new Date(observedAt),
      translations: [{ locale: 'hy', title: 'Original title', author: 'Original author', publisher: null, isNew: true, imageUrls: [cover] }],
      categories: [{ category: { supplierCategoryId: '10' } }],
    };
    const findMany = jest.fn(async (query: { take?: number }) => query.take ? [{ id: row.id }] : [row]);
    const count = jest.fn();
    const raw = jest.fn(async (_query: unknown) => [{ id: row.id }]);
    const prisma = {
      catalogCategory: { findMany: jest.fn(async () => categories) },
      catalogBook: { findMany, count },
      $queryRaw: raw,
    } as unknown as PrismaService;
    const result = await new PrismaCatalogRepository(prisma).showcase('ru');
    expect(count).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledTimes(4);
    expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ select: { id: true }, take: 24 }));
    expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ select: { id: true }, take: 8 }));
    expect(findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
      take: 4, where: { availability: 'PRELIMINARY_AVAILABLE', categories: { some: { categoryId: { in: ['category-7464', 'category-10'] } } } },
    }));
    const hydration = findMany.mock.calls[3]?.[0];
    expect(hydration).toMatchObject({ where: { id: { in: ['book-1'] } } });
    expect(hydration).not.toHaveProperty('select.description');
    expect(hydration).not.toHaveProperty('select.translations.select.detailSections');
    expect(raw).toHaveBeenCalledWith(expect.objectContaining({ values: ['ru', 12] }));
    expect(result.newBooks).toMatchObject([{ id: row.id, title: 'Original title', locale: 'hy', isNew: true }]);
    expect(result.categoryPreviews).toEqual([{ categoryId: '7464', books: result.books }]);
  });
});
