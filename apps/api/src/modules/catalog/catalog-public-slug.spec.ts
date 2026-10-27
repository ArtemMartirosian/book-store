import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import type { BookLocalization, BookRecord, StoreLocale } from './book.model';
import { CatalogService } from './catalog.service';
import { allocatePublicBookSlug, MAX_PUBLIC_SLUG_ATTEMPTS, retryableCatalogSlugError } from './public-book-slug-allocation';
import { publicBookSlugCandidate } from './public-book-slug';
import type { CatalogRepository } from './repositories/catalog.repository';
import { InMemoryCatalogRepository } from './repositories/in-memory-catalog.repository';
import { PrismaCatalogRepository } from './repositories/prisma-catalog.repository';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const observedAt = '2026-10-27T08:00:00.000Z';
const canonical = 'madhouse-at-the-end-of-the-earth';
const supplierUrl = 'https://www.books.am/am/catalog/product/view/id/122337/';
const localization = (locale: StoreLocale, title: string): BookLocalization => ({
  locale, title, author: 'Julian Sancton', description: 'A translated book description.',
  parserVersion: 'slug-contract-v1', languageLabel: null, isbn: null, publisher: null,
  productCode: 'PUBLIC-122337', weight: null, barcode: null, isNew: false,
  pageCount: null, coverType: null, dimensions: null, publicationYear: null, series: null,
  imageUrls: [], attributes: [], detailSections: [], sourceUrl: supplierUrl, observedAt,
});
const fixture = (overrides: Partial<BookRecord> = {}): BookRecord => ({
  id, supplierSku: 'SUPPLIER-122337', slug: 'books-am-122337',
  title: 'Madhouse at the End of the Earth', author: 'Julian Sancton', description: 'A book description.',
  locale: 'en', language: 'en', isbn: null, publisher: null, productCode: 'PUBLIC-122337',
  sourcePriceAmd: 6000, availability: 'PRELIMINARY_AVAILABLE', sourceUrl: supplierUrl,
  coverImageUrl: null, imageUrls: [], attributes: [], detailSections: [], observedAt,
  ...overrides,
});

type Occupant = { id: string; slug: string; publicSlug?: string | null };
type AllocationQuery = {
  where: { id: { not: string }; OR: Array<{ slug?: string; publicSlug?: string }> };
  select: { id: true };
};
const occupiedBy = (rows: Occupant[], input: AllocationQuery) => rows.find((row) =>
  row.id !== input.where.id.not && input.where.OR.some((candidate) =>
    candidate.slug !== undefined ? row.slug === candidate.slug : row.publicSlug === candidate.publicSlug,
  ),
);
const allocationHarness = (rows: Occupant[] = []) => {
  const findFirst = jest.fn(async (input: AllocationQuery) => {
    const occupied = occupiedBy(rows, input);
    return occupied ? { id: occupied.id } : null;
  });
  return { client: { catalogBook: { findFirst } } as unknown as Prisma.TransactionClient, findFirst };
};

type Existing = {
  id: string; publicSlug: string | null; slug: string; title: string;
  imageUrls: string[]; manualEdited: boolean; translations: Array<{ manualEdited: boolean }>;
};
type BookWrite = {
  where: { supplierSku: string };
  create: Record<string, unknown> & { id: string; publicSlug: string; slug: string; title: string; imageUrls: string[] };
  update: Record<string, unknown>;
};
function upsertHarness(initial: Existing | null = null, occupants: Occupant[] = []) {
  let existing = initial ? structuredClone(initial) : null;
  let persisted: Record<string, unknown> | null = initial ? { ...initial, sourceUrl: supplierUrl, supplierSku: fixture().supplierSku } : null;
  const findUnique = jest.fn(async () => existing);
  const findFirst = jest.fn(async (input: AllocationQuery) => {
    const rows = [...occupants, ...(existing ? [existing] : [])];
    const occupied = occupiedBy(rows, input);
    return occupied ? { id: occupied.id } : null;
  });
  const bookUpsert = jest.fn(async (input: BookWrite) => {
    persisted = existing ? { ...persisted, ...input.update } : { ...input.create };
    existing = {
      id: String(persisted.id), publicSlug: String(persisted.publicSlug),
      slug: String(persisted.slug), title: String(persisted.title),
      imageUrls: persisted.imageUrls as string[], manualEdited: persisted.manualEdited === true,
      translations: [],
    };
    return { id: existing.id, manualEdited: existing.manualEdited };
  });
  const translationUpsert = jest.fn().mockResolvedValue({});
  const transaction = { catalogBook: { findUnique, findFirst, upsert: bookUpsert }, catalogBookTranslation: { upsert: translationUpsert } };
  const transact = jest.fn(async (operation: (client: typeof transaction) => unknown, _options?: unknown) => operation(transaction));
  const repository = new PrismaCatalogRepository({ $transaction: transact } as unknown as PrismaService);
  return { repository, findUnique, findFirst, bookUpsert, translationUpsert, transact,
    get persisted() { return persisted; },
  };
}

describe('Public book slug allocation namespace', () => {
  it('uses the readable title when it is free without changing supplier data', async () => {
    const h = allocationHarness();
    await expect(allocatePublicBookSlug(h.client, fixture().title, id)).resolves.toBe(canonical);
    expect(h.findFirst).toHaveBeenCalledWith({
      where: { id: { not: id }, OR: [{ publicSlug: canonical }, { slug: canonical }] },
      select: { id: true },
    });
  });

  it('reserves other books\' public slugs and historical manual aliases before adding a stable collision suffix', async () => {
    const firstSuffix = publicBookSlugCandidate(fixture().title, id, 1);
    const h = allocationHarness([
      { id: otherId, slug: canonical, publicSlug: 'a-different-public-address' },
      { id: 'third-book', slug: 'books-am-999', publicSlug: firstSuffix },
    ]);
    const allocated = await allocatePublicBookSlug(h.client, fixture().title, id);
    expect(allocated).toBe(publicBookSlugCandidate(fixture().title, id, 2));
    expect(allocated).toMatch(/^madhouse-at-the-end-of-the-earth-[a-f0-9]{8}-2$/u);
    expect(h.findFirst).toHaveBeenCalledTimes(3);
  });

  it('allows a book to retain its own hand-authored legacy alias', async () => {
    const h = allocationHarness([{ id, slug: canonical, publicSlug: null }]);
    await expect(allocatePublicBookSlug(h.client, fixture().title, id)).resolves.toBe(canonical);
    expect(h.findFirst).toHaveBeenCalledTimes(1);
  });

  it('fails with a bounded error when every candidate is occupied', async () => {
    const h = allocationHarness();
    h.findFirst.mockResolvedValue({ id: otherId });
    await expect(allocatePublicBookSlug(h.client, fixture().title, id)).rejects.toThrow('PUBLIC_BOOK_SLUG_ALLOCATION_EXHAUSTED');
    expect(h.findFirst).toHaveBeenCalledTimes(MAX_PUBLIC_SLUG_ATTEMPTS);
  });
});

describe('Public and legacy slug resolution', () => {
  const row = () => ({
    ...fixture({ publicSlug: canonical }), publicSlug: canonical, observedAt: new Date(observedAt),
    translations: [], categories: [],
  });

  it('Prisma resolves a canonical public slug before consulting legacy aliases', async () => {
    const findUnique = jest.fn().mockResolvedValue(row());
    const repository = new PrismaCatalogRepository({ catalogBook: { findUnique } } as unknown as PrismaService);
    await expect(repository.findBySlug(canonical)).resolves.toMatchObject({
      id, slug: 'books-am-122337', publicSlug: canonical, supplierSku: fixture().supplierSku, sourceUrl: supplierUrl,
    });
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(findUnique.mock.calls[0]![0]).toMatchObject({ where: { publicSlug: canonical } });
  });

  it('Prisma still resolves the old supplier slug and returns null for an unknown address', async () => {
    const findUnique = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(row());
    const repository = new PrismaCatalogRepository({ catalogBook: { findUnique } } as unknown as PrismaService);
    await expect(repository.findBySlug('books-am-122337')).resolves.toMatchObject({ id, publicSlug: canonical });
    expect(findUnique.mock.calls.map(([query]) => query.where)).toEqual([
      { publicSlug: 'books-am-122337' }, { slug: 'books-am-122337' },
    ]);
    findUnique.mockReset().mockResolvedValue(null);
    await expect(repository.findBySlug('does-not-exist')).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('in-memory imports allocate one canonical address, preserve it after renamed locale data, and keep both lookups defensive', async () => {
    const repository = new InMemoryCatalogRepository();
    const source = fixture({ publicSlug: 'incoming-value-must-not-be-trusted' });
    await repository.upsert(source);
    const first = await repository.findById(id);
    expect(first).toMatchObject({ publicSlug: canonical, slug: source.slug, supplierSku: source.supplierSku, sourceUrl: source.sourceUrl });
    await repository.upsert({ ...source, title: 'A renamed title', locale: 'hy', publicSlug: 'do-not-replace-the-published-url' });
    const byCanonical = await repository.findBySlug(canonical);
    expect(byCanonical).toMatchObject({ id, publicSlug: canonical, title: 'A renamed title', slug: source.slug });
    byCanonical!.slug = 'mutated-return-copy';
    await expect(repository.findBySlug(source.slug)).resolves.toMatchObject({ slug: source.slug, publicSlug: canonical, sourceUrl: source.sourceUrl, supplierSku: source.supplierSku });
    await expect(repository.findBySlug('does-not-exist')).resolves.toBeNull();
  });

  it('in-memory collision allocation reserves another book\'s existing manual alias', async () => {
    const repository = new InMemoryCatalogRepository();
    await repository.upsert(fixture({ id: otherId, supplierSku: 'MANUAL', slug: canonical, title: 'Manual title', sourceUrl: 'https://www.books.am/am/catalog/product/view/id/999/' }));
    await repository.upsert(fixture());
    await expect(repository.findById(id)).resolves.toMatchObject({ publicSlug: publicBookSlugCandidate(fixture().title, id, 1) });
    await expect(repository.findBySlug(canonical)).resolves.toMatchObject({ id: otherId });
  });
});

describe('Public catalog projection privacy', () => {
  it('returns one public address across translations without exposing private aliases or supplier lookup fields', async () => {
    const source = fixture({ publicSlug: canonical, localizations: {
      hy: localization('hy', 'Հայերեն վերնագիր'), ru: localization('ru', 'Русское название'), en: localization('en', fixture().title),
    } });
    const before = structuredClone(source);
    const repository = {
      findById: jest.fn().mockResolvedValue(source), findBySlug: jest.fn().mockResolvedValue(source),
      search: jest.fn().mockResolvedValue({ items: [source], total: 1, offset: 0, limit: 5 }),
    } as unknown as CatalogRepository;
    const service = new CatalogService(repository, new PricingService(new ConfigService({ PRICE_MARKUP_PER_ITEM_AMD: 500 })));
    for (const locale of ['hy', 'ru', 'en'] as const) {
      const byId = await service.getPublicBook(id, locale);
      const byLegacyAlias = await service.getPublicBookBySlug(source.slug, locale);
      const search = await service.search({ locale, offset: 0, limit: 5 });
      for (const book of [byId, byLegacyAlias, search.items[0]!]) {
        expect(book.slug).toBe(canonical);
        expect(book.title).toBe(source.localizations![locale]!.title);
        expect(book.price).toEqual({ amount: 6500, currency: 'AMD' });
        for (const key of ['publicSlug', 'supplierSku', 'sourceUrl', 'sourcePriceAmd', 'localizations']) expect(book).not.toHaveProperty(key);
      }
      await expect(service.getBookRecord(id)).resolves.toMatchObject({ slug: source.slug, publicSlug: canonical, sourceUrl: source.sourceUrl, supplierSku: source.supplierSku });
    }
    expect(source).toEqual(before);
  });

  it.each([undefined, null])('keeps an unbackfilled legacy address usable while publicSlug is %s', async (publicSlug) => {
    const source = fixture({ publicSlug });
    const repository = { findById: jest.fn().mockResolvedValue(source) } as unknown as CatalogRepository;
    const service = new CatalogService(repository, new PricingService(new ConfigService()));
    const result = await service.getPublicBook(id);
    expect(result.slug).toBe(source.slug);
    expect(result).not.toHaveProperty('publicSlug');
    expect(result).not.toHaveProperty('sourceUrl');
  });
});

describe('Prisma crawler upserts preserve published URLs and supplier identity', () => {
  it('assigns a title slug on creation inside a serializable transaction and never accepts an incoming canonical override', async () => {
    const h = upsertHarness();
    const source = fixture({ publicSlug: 'incoming-canonical-override' });
    await h.repository.upsert(source);
    expect(h.bookUpsert.mock.calls[0]![0]).toMatchObject({
      where: { supplierSku: source.supplierSku },
      create: { id, slug: source.slug, publicSlug: canonical, supplierSku: source.supplierSku, sourceUrl: source.sourceUrl },
    });
    expect(h.transact.mock.calls[0]![1]).toEqual({ isolationLevel: 'Serializable' });
    expect(h.persisted).toMatchObject({ slug: source.slug, publicSlug: canonical, supplierSku: source.supplierSku, sourceUrl: source.sourceUrl });
  });

  it('keeps the first canonical address across later title/locale updates and explicit force refreshes', async () => {
    const h = upsertHarness();
    const source = fixture();
    await h.repository.upsert(source);
    h.findFirst.mockClear();
    for (const force of [false, true]) {
      await h.repository.upsert({ ...source, locale: 'ru', title: 'Совершенно другое название', publicSlug: 'not-this-address', localizations: { ru: localization('ru', 'Локализованное название') } }, { force });
      const write = h.bookUpsert.mock.calls.at(-1)![0];
      expect(write.update).not.toHaveProperty('publicSlug');
      expect(write.create.publicSlug).toBe(canonical);
      expect(h.persisted).toMatchObject({ slug: source.slug, publicSlug: canonical, sourceUrl: source.sourceUrl, supplierSku: source.supplierSku });
      if (force) expect(write.update.manualEdited).toBe(false);
    }
    expect(h.findFirst).not.toHaveBeenCalled();
    expect(h.translationUpsert).toHaveBeenCalledTimes(2);
  });

  it('backfills an existing record using its persisted canonical title rather than a later translation title', async () => {
    const h = upsertHarness({ id, publicSlug: null, slug: fixture().slug, title: fixture().title, imageUrls: [], manualEdited: true, translations: [{ manualEdited: true }] });
    await h.repository.upsert(fixture({ title: 'Последующее локализованное название' }));
    expect(h.bookUpsert.mock.calls[0]![0].update).toMatchObject({ publicSlug: canonical });
    expect(h.bookUpsert.mock.calls[0]![0].update).not.toHaveProperty('title');
    expect(h.persisted).toMatchObject({ slug: fixture().slug, publicSlug: canonical, title: fixture().title, supplierSku: fixture().supplierSku, sourceUrl: supplierUrl });
  });

  it('preserves a record\'s existing human-written alias while assigning its matching public address', async () => {
    const h = upsertHarness({ id, publicSlug: null, slug: 'my-editorial-book', title: 'Different displayed title', imageUrls: [], manualEdited: false, translations: [] });
    await h.repository.upsert(fixture({ slug: 'my-editorial-book' }));
    expect(h.persisted).toMatchObject({ slug: 'my-editorial-book', publicSlug: 'my-editorial-book' });
  });

  it('retries a public-slug unique conflict and allocates a fresh suffix without rewriting the supplier identity', async () => {
    const occupants: Occupant[] = [];
    const h = upsertHarness(null, occupants);
    h.bookUpsert.mockImplementationOnce(async () => {
      occupants.push({ id: otherId, slug: 'books-am-999', publicSlug: canonical });
      throw { code: 'P2002', meta: { target: ['public_slug'] } };
    });
    await h.repository.upsert(fixture());
    expect(h.transact).toHaveBeenCalledTimes(2);
    expect(h.persisted).toMatchObject({ publicSlug: publicBookSlugCandidate(fixture().title, id, 1), slug: fixture().slug, supplierSku: fixture().supplierSku, sourceUrl: supplierUrl });
  });

  it.each([
    { code: 'P2034' },
    { code: 'P2002', meta: { target: ['supplier_sku'] } },
  ])('retries only transient serializable/supplier-identity conflicts: %j', async (error) => {
    const h = upsertHarness();
    h.transact.mockRejectedValueOnce(error);
    await h.repository.upsert(fixture());
    expect(h.transact).toHaveBeenCalledTimes(2);
    expect(h.bookUpsert).toHaveBeenCalledTimes(1);
    expect(h.persisted).toMatchObject({ publicSlug: canonical, slug: fixture().slug, sourceUrl: supplierUrl });
  });

  it('bounds serializable retries and propagates the final conflict unchanged', async () => {
    const h = upsertHarness();
    const error = { code: 'P2034' };
    h.transact.mockRejectedValue(error);
    await expect(h.repository.upsert(fixture())).rejects.toBe(error);
    expect(h.transact).toHaveBeenCalledTimes(5);
  });

  it.each([
    new Error('DATABASE_UNAVAILABLE'),
    { code: 'P2002', meta: { target: ['source_url'] } },
    { code: 'P2002', meta: { target: ['slug'] } },
    { code: 'P1001' },
  ])('does not hide or retry unrelated failures: %j', async (error) => {
    const h = upsertHarness();
    h.transact.mockRejectedValueOnce(error);
    await expect(h.repository.upsert(fixture())).rejects.toBe(error);
    expect(h.transact).toHaveBeenCalledTimes(1);
    expect(h.bookUpsert).not.toHaveBeenCalled();
  });
});

describe('Slug conflict classification', () => {
  it.each([
    [{ code: 'P2034' }, true],
    [{ code: 'P2002', meta: { target: ['public_slug'] } }, true],
    [{ code: 'P2002', meta: { target: ['publicSlug'] } }, true],
    [{ code: 'P2002', meta: { target: 'catalog_books_public_slug_key' } }, true],
    [{ code: 'P2002', meta: { target: ['supplier_sku'] } }, true],
    [{ code: 'P2002', meta: { target: ['supplierSku'] } }, true],
    [{ code: 'P2002', meta: { target: ['source_url'] } }, false],
    [{ code: 'P2002', meta: { target: ['slug'] } }, false],
    [{ code: 'P2002' }, false],
    [{ code: 'P1001' }, false],
    [new Error('not a Prisma conflict'), false],
    [null, false],
    ['P2034', false],
  ])('classifies %j as retryable=%s', (error, expected) => {
    expect(retryableCatalogSlugError(error)).toBe(expected);
  });
});
