import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { CatalogService } from './catalog.service';
import { SearchBooksQueryDto } from './dto/search-books-query.dto';
import type { BookLocalization, BookRecord, StoreLocale } from './book.model';
import type { CatalogRepository } from './repositories/catalog.repository';
import { InMemoryCatalogRepository } from './repositories/in-memory-catalog.repository';
import { PrismaCatalogRepository } from './repositories/prisma-catalog.repository';

const observedAt = '2026-09-24T10:00:00.000Z';
const cover = 'https://images.example.test/book.jpg';
const localized = (locale: StoreLocale, isNew: boolean | null, imageUrls: string[] = []): BookLocalization => ({
  parserVersion: 'contract-v1', locale, title: 'catalog-contract', author: 'Author', description: '',
  languageLabel: null, isbn: null, publisher: 'Զանգակ', productCode: 'CONTRACT', weight: null,
  barcode: null, isNew, pageCount: null, coverType: null, dimensions: null, publicationYear: null,
  series: 'Contract Series', imageUrls, attributes: [], detailSections: [], sourceUrl: '', observedAt,
});
const fixture = (id: string, sourcePriceAmd: number, overrides: Partial<BookRecord> = {}): BookRecord => ({
  id, supplierSku: id, slug: id, title: 'catalog-contract ' + id, author: 'Author', description: '',
  locale: 'hy', language: 'hy', isbn: null, publisher: 'Զանգակ', series: 'Contract Series',
  sourcePriceAmd, availability: 'PRELIMINARY_AVAILABLE', sourceUrl: '', coverImageUrl: null,
  imageUrls: [], isNew: null, observedAt, ...overrides,
});
const fixtures = [
  fixture('a', 1000, { isNew: false, localizations: { hy: localized('hy', false), ru: localized('ru', true, [cover]) } }),
  fixture('b', 2000, { locale: 'ru', language: 'ru', isNew: true, coverImageUrl: cover, localizations: { ru: localized('ru', null) } }),
  fixture('c', 3000, { locale: 'en', language: 'en', isNew: false, imageUrls: [cover] }),
  fixture('d', 4000, { isNew: true, availability: 'OUT_OF_STOCK', localizations: { hy: localized('hy', true), ru: localized('ru', false) } }),
  fixture('e', 5000),
];

// Exercise the actual Prisma query builder and hydration against a deterministic
// query interpreter. This is not a live PostgreSQL integration test.
type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([field, expected]) => {
    if (expected === undefined) return true;
    if (field === 'AND') return (Array.isArray(expected) ? expected : [expected]).every((item) => matches(row, item));
    if (field === 'OR') return (expected as Row[]).some((item) => matches(row, item));
    if (field === 'NOT') return !(Array.isArray(expected) ? expected : [expected]).some((item) => matches(row, item));
    const actual = row[field];
    if (expected === null || typeof expected !== 'object') return actual === expected;
    const filter = expected as Row;
    if ('some' in filter) return (actual as Row[]).some((item) => matches(item, filter.some as Row));
    if ('none' in filter) return !(actual as Row[]).some((item) => matches(item, filter.none as Row));
    if ('contains' in filter) return typeof actual === 'string' && actual.toLocaleLowerCase().includes(String(filter.contains).toLocaleLowerCase());
    if ('isEmpty' in filter) return Array.isArray(actual) && (actual.length === 0) === filter.isEmpty;
    if ('not' in filter && actual === filter.not) return false;
    if ('gte' in filter && !(Number(actual) >= Number(filter.gte))) return false;
    if ('lte' in filter && !(Number(actual) <= Number(filter.lte))) return false;
    return true;
  });
}
function prismaHarness(): CatalogRepository {
  const rows = fixtures.map((book) => ({
    ...book, observedAt: new Date(observedAt), categories: [], attributes: [], detailSections: [],
    translations: Object.values(book.localizations ?? {}).map((translation) => ({ ...translation, observedAt: new Date(observedAt) })),
  }));
  const findMany = jest.fn(async ({ where, orderBy, skip, take }) => rows.filter((row) => matches(row, where)).sort((left, right) => {
    for (const order of orderBy) {
      const [key, direction] = Object.entries(order)[0]!;
      const a = (left as Row)[key] as string | number;
      const b = (right as Row)[key] as string | number;
      if (a !== b) return (a < b ? -1 : 1) * (direction === 'asc' ? 1 : -1);
    }
    return 0;
  }).slice(skip, skip + take));
  const count = jest.fn(async ({ where }) => {
    expect(where).toEqual(findMany.mock.calls.at(-1)?.[0].where);
    return rows.filter((row) => matches(row, where)).length;
  });
  return new PrismaCatalogRepository({
    catalogBook: { findMany, count },
    $transaction: (operations: Promise<unknown>[]) => Promise.all(operations),
  } as unknown as PrismaService);
}
const pricing = (markup: number) => new PricingService(new ConfigService({ PRICE_MARKUP_PER_ITEM_AMD: markup }));

for (const adapter of ['InMemory', 'Prisma query contract'] as const) {
  describe(adapter + ' customer catalog filter contract', () => {
    let service: CatalogService;
    beforeEach(async () => {
      const repository = adapter === 'InMemory' ? new InMemoryCatalogRepository() : prismaHarness();
      if (adapter === 'InMemory') for (const book of fixtures) await repository.upsert(book);
      service = new CatalogService(repository, pricing(500));
    });
    const base = { query: 'catalog-contract', locale: 'hy' as const, offset: 0, limit: 24, sort: 'price-asc' as const };
    it('uses inclusive customer prices, returns matched totals before paging, and preserves publisher/author/series', async () => {
      const result = await service.search({ ...base, minPrice: 1500, maxPrice: 3500, publisher: 'ԶԱՆԳԱԿ', author: 'author', series: 'contract', offset: 1, limit: 1 });
      expect(result.total).toBe(3);
      expect(result.items.map(({ id }) => id)).toEqual(['b']);
      expect(result.items[0]?.price).toEqual({ amount: 2500, currency: 'AMD' });
    });
    it('does not confuse free/low maximum prices with missing bounds', async () => {
      for (const maxPrice of [0, 499, 500, 1499]) expect((await service.search({ ...base, minPrice: 0, maxPrice })).total).toBe(0);
      expect((await service.search({ ...base, maxPrice: 1500 })).items.map(({ id }) => id)).toEqual(['a']);
    });
    it('matches actual newness in the displayed locale, not observation time or unknown flags', async () => {
      expect((await service.search({ ...base, isNew: true })).items.map(({ id }) => id)).toEqual(['d']);
      expect((await service.search({ ...base, locale: 'ru', isNew: true })).items.map(({ id }) => id)).toEqual(['a']);
      expect((await service.search({ ...base, locale: 'en', isNew: false })).items.map(({ id }) => id)).toEqual(['a', 'c']);
    });
    it('matches the displayed cover or shared cover without leaking other-language images', async () => {
      expect((await service.search({ ...base, hasCover: true })).items.map(({ id }) => id)).toEqual(['b', 'c']);
      expect((await service.search({ ...base, locale: 'ru', hasCover: true })).items.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
      expect((await service.search({ ...base, hasCover: false })).items.map(({ id }) => id)).toEqual(['a', 'd', 'e']);
    });
    it('combines stock/language with new facets and never silently includes unavailable books', async () => {
      expect((await service.search({ ...base, isNew: true, available: true })).total).toBe(0);
      expect((await service.search({ ...base, isNew: true, available: false })).items.map(({ id }) => id)).toEqual(['d']);
      expect((await service.search({ ...base, hasCover: true, language: 'en', available: true })).items.map(({ id }) => id)).toEqual(['c']);
    });
  });
}

describe('Catalog price and boolean validation', () => {
  it.each([0, 500, 1000])('derives bounds from the actual configured markup %i', async (markup) => {
    const repository = { search: jest.fn().mockResolvedValue({ items: [], total: 0, offset: 0, limit: 24 }) } as unknown as CatalogRepository;
    await new CatalogService(repository, pricing(markup)).search({ minPrice: 1500, maxPrice: 3500, offset: 0, limit: 24 });
    expect(repository.search).toHaveBeenCalledWith({ minSourcePriceAmd: 1500 - markup, maxSourcePriceAmd: 3500 - markup, offset: 0, limit: 24 });
  });
  it('rejects inverted, fractional, unsafe or negative customer-price bounds before repository access', async () => {
    const repository = { search: jest.fn() } as unknown as CatalogRepository;
    const service = new CatalogService(repository, pricing(500));
    for (const bounds of [{ minPrice: 3000, maxPrice: 2000 }, { minPrice: -1 }, { maxPrice: 0.5 }, { maxPrice: Number.MAX_SAFE_INTEGER }, { minPrice: NaN }]) {
      await expect(service.search({ ...bounds, offset: 0, limit: 24 })).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(repository.search).not.toHaveBeenCalled();
  });
  it('accepts zero and explicit false query values without truthy string coercion', async () => {
    const dto = plainToInstance(SearchBooksQueryDto, { minPrice: '0', maxPrice: '0', hasCover: 'false', isNew: 'true', available: 'false' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ minPrice: 0, maxPrice: 0, hasCover: false, isNew: true, available: false });
  });
  it('rejects malformed HTTP facets and search strings longer than the agreed 120 characters', async () => {
    for (const query of [{ minPrice: '-1' }, { maxPrice: '1.5' }, { maxPrice: '2147483648' }, { minPrice: '500', maxPrice: '499' }, { isNew: 'yes' }, { hasCover: '0' }, { q: 'a'.repeat(121) }]) {
      expect((await validate(plainToInstance(SearchBooksQueryDto, query))).length).toBeGreaterThan(0);
    }
  });
});
