import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type CatalogBookTranslation as PersistedTranslation,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import type {
  BookAttribute,
  BookAvailability,
  BookDetailSection,
  BookLocalization,
  BookRecord,
  CatalogCategoryRecord,
  StoreLocale,
} from '../book.model';
import type {
  CatalogCategorySnapshot,
  CatalogRepository,
  CatalogSearch,
  CatalogSearchResult,
  LocalizedBookCandidate,
} from './catalog.repository';

type PersistedBook = Prisma.CatalogBookGetPayload<{
  include: {
    translations: true;
    categories: {
      include: { category: { include: { translations: true; parent: true } } };
    };
  };
}>;

type PersistedCategory = Prisma.CatalogCategoryGetPayload<{
  include: { translations: true; parent: true };
}>;

const timestamp = (value: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error('Invalid book observedAt timestamp');
  return parsed;
};

type SearchableTextField =
  | 'title'
  | 'author'
  | 'description'
  | 'productCode'
  | 'barcode'
  | 'isbn'
  | 'publisher'
  | 'series';

const localizedTextFilter = (
  field: SearchableTextField,
  value: string | undefined,
  locale: StoreLocale,
): Prisma.CatalogBookWhereInput | null => {
  const query = value?.trim();
  if (!query) return null;
  const contains = { contains: query, mode: 'insensitive' as const };
  return {
    OR: [
      { [field]: contains },
      { translations: { some: { locale, [field]: contains } } },
    ],
  } as Prisma.CatalogBookWhereInput;
};

const jsonArray = <T>(value: Prisma.JsonValue): T[] =>
  Array.isArray(value) ? (value as T[]) : [];

const hydrateLocalization = (row: PersistedTranslation): BookLocalization => ({
  parserVersion: row.parserVersion,
  locale: row.locale as StoreLocale,
  title: row.title,
  author: row.author,
  description: row.description,
  languageLabel: row.languageLabel,
  isbn: row.isbn,
  publisher: row.publisher,
  productCode: row.productCode,
  weight: row.weight,
  barcode: row.barcode,
  isNew: row.isNew,
  pageCount: row.pageCount,
  coverType: row.coverType,
  dimensions: row.dimensions,
  publicationYear: row.publicationYear,
  series: row.series,
  imageUrls: row.imageUrls,
  attributes: jsonArray<BookAttribute>(row.attributes),
  detailSections: jsonArray<BookDetailSection>(row.detailSections),
  sourceUrl: row.sourceUrl,
  observedAt: row.observedAt.toISOString(),
});

const hydrateCategory = (row: PersistedCategory): CatalogCategoryRecord => ({
  id: row.id,
  supplierCategoryId: row.supplierCategoryId,
  parentSupplierCategoryId: row.parent?.supplierCategoryId ?? null,
  position: row.position,
  observedAt: row.observedAt.toISOString(),
  localizations: Object.fromEntries(
    row.translations.map((translation) => [
      translation.locale,
      {
        locale: translation.locale as StoreLocale,
        name: translation.name,
        sourceUrl: translation.sourceUrl,
        observedAt: translation.observedAt.toISOString(),
      },
    ]),
  ),
});

const hydrateBook = (row: PersistedBook): BookRecord => ({
  id: row.id,
  supplierSku: row.supplierSku,
  slug: row.slug,
  title: row.title,
  author: row.author,
  description: row.description,
  language: row.language as StoreLocale,
  locale: row.locale as StoreLocale,
  isbn: row.isbn,
  publisher: row.publisher,
  productCode: row.productCode ?? row.supplierSku,
  weight: row.weight,
  barcode: row.barcode,
  isNew: row.isNew,
  pageCount: row.pageCount,
  coverType: row.coverType,
  dimensions: row.dimensions,
  publicationYear: row.publicationYear,
  series: row.series,
  imageUrls: row.imageUrls,
  attributes: jsonArray<BookAttribute>(row.attributes),
  detailSections: jsonArray<BookDetailSection>(row.detailSections),
  localizations: Object.fromEntries(
    row.translations.map((translation) => [translation.locale, hydrateLocalization(translation)]),
  ) as Partial<Record<StoreLocale, BookLocalization>>,
  categories: row.categories.map(({ category }) => hydrateCategory(category)),
  sourcePriceAmd: row.sourcePriceAmd,
  availability: row.availability as BookAvailability,
  sourceUrl: row.sourceUrl,
  coverImageUrl: row.coverImageUrl,
  observedAt: row.observedAt.toISOString(),
});

const bookData = (book: BookRecord) => ({
  id: book.id,
  supplierSku: book.supplierSku,
  slug: book.slug,
  title: book.title,
  author: book.author,
  description: book.description,
  language: book.language,
  locale: book.locale,
  isbn: book.isbn,
  publisher: book.publisher,
  productCode: book.productCode ?? book.supplierSku,
  weight: book.weight ?? null,
  barcode: book.barcode ?? null,
  isNew: book.isNew ?? null,
  pageCount: book.pageCount ?? null,
  coverType: book.coverType ?? null,
  dimensions: book.dimensions ?? null,
  publicationYear: book.publicationYear ?? null,
  series: book.series ?? null,
  imageUrls: book.imageUrls ?? [],
  attributes: (book.attributes ?? []) as unknown as Prisma.InputJsonValue,
  detailSections: (book.detailSections ?? []) as unknown as Prisma.InputJsonValue,
  parserVersion: book.localizations?.[book.locale]?.parserVersion ?? 'books-html-v1',
  sourcePriceAmd: book.sourcePriceAmd,
  availability: book.availability,
  sourceUrl: book.sourceUrl,
  coverImageUrl: book.coverImageUrl,
  observedAt: timestamp(book.observedAt),
});

const translationData = (bookId: string, localization: BookLocalization) => ({
  bookId,
  locale: localization.locale,
  parserVersion: localization.parserVersion,
  title: localization.title,
  author: localization.author,
  description: localization.description,
  languageLabel: localization.languageLabel,
  isbn: localization.isbn,
  publisher: localization.publisher,
  productCode: localization.productCode,
  weight: localization.weight,
  barcode: localization.barcode,
  isNew: localization.isNew,
  pageCount: localization.pageCount,
  coverType: localization.coverType,
  dimensions: localization.dimensions,
  publicationYear: localization.publicationYear,
  series: localization.series,
  imageUrls: localization.imageUrls,
  attributes: localization.attributes as unknown as Prisma.InputJsonValue,
  detailSections: localization.detailSections as unknown as Prisma.InputJsonValue,
  sourceUrl: localization.sourceUrl,
  observedAt: timestamp(localization.observedAt),
});

@Injectable()
export class PrismaCatalogRepository implements CatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: CatalogSearch): Promise<CatalogSearchResult> {
    const query = input.query?.trim();
    const advancedFilters = ([
      localizedTextFilter('title', input.title, input.locale ?? 'hy'),
      localizedTextFilter('author', input.author, input.locale ?? 'hy'),
      localizedTextFilter('description', input.description, input.locale ?? 'hy'),
      localizedTextFilter('productCode', input.productCode, input.locale ?? 'hy'),
      localizedTextFilter('barcode', input.barcode, input.locale ?? 'hy'),
      localizedTextFilter('isbn', input.isbn, input.locale ?? 'hy'),
      localizedTextFilter('publisher', input.publisher, input.locale ?? 'hy'),
      localizedTextFilter('series', input.series, input.locale ?? 'hy'),
    ] as Array<Prisma.CatalogBookWhereInput | null>).filter(
      (filter): filter is Prisma.CatalogBookWhereInput => filter !== null,
    );
    const where: Prisma.CatalogBookWhereInput = {
      ...(advancedFilters.length > 0 ? { AND: advancedFilters } : {}),
      ...(input.available === undefined
        ? {}
        : {
            availability: input.available
              ? 'PRELIMINARY_AVAILABLE'
              : 'OUT_OF_STOCK',
          }),
      ...(input.language ? { language: input.language } : {}),
      ...(input.category
        ? {
            categories: {
              some: { category: { supplierCategoryId: input.category } },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { author: { contains: query, mode: 'insensitive' } },
              { isbn: { contains: query, mode: 'insensitive' } },
              { productCode: { contains: query, mode: 'insensitive' } },
              { barcode: { contains: query, mode: 'insensitive' } },
              { publisher: { contains: query, mode: 'insensitive' } },
              { series: { contains: query, mode: 'insensitive' } },
              { description: { contains: query, mode: 'insensitive' } },
              {
                translations: {
                  some: {
                    locale: input.locale,
                    OR: [
                      { title: { contains: query, mode: 'insensitive' } },
                      { author: { contains: query, mode: 'insensitive' } },
                      { isbn: { contains: query, mode: 'insensitive' } },
                      { productCode: { contains: query, mode: 'insensitive' } },
                      { barcode: { contains: query, mode: 'insensitive' } },
                      { publisher: { contains: query, mode: 'insensitive' } },
                      { series: { contains: query, mode: 'insensitive' } },
                      { description: { contains: query, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.CatalogBookOrderByWithRelationInput[] =
      input.sort === 'price-asc'
        ? [{ sourcePriceAmd: 'asc' }, { id: 'asc' }]
        : input.sort === 'price-desc'
          ? [{ sourcePriceAmd: 'desc' }, { id: 'desc' }]
          : input.sort === 'title'
            ? [{ title: 'asc' }, { id: 'asc' }]
            : [{ observedAt: 'desc' }, { id: 'desc' }];
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.catalogBook.findMany({
        where,
        orderBy,
        skip: input.offset,
        take: input.limit,
        include: {
          translations: true,
          categories: {
            include: { category: { include: { translations: true, parent: true } } },
          },
        },
      }),
      this.prisma.catalogBook.count({ where }),
    ]);
    return {
      items: rows.map(hydrateBook),
      total,
      offset: input.offset,
      limit: input.limit,
    };
  }

  async findById(id: string): Promise<BookRecord | null> {
    const row = await this.prisma.catalogBook.findUnique({
      where: { id },
      include: {
        translations: true,
        categories: {
          include: { category: { include: { translations: true, parent: true } } },
        },
      },
    });
    return row ? hydrateBook(row) : null;
  }

  async findBySlug(slug: string): Promise<BookRecord | null> {
    const row = await this.prisma.catalogBook.findUnique({
      where: { slug },
      include: {
        translations: true,
        categories: {
          include: { category: { include: { translations: true, parent: true } } },
        },
      },
    });
    return row ? hydrateBook(row) : null;
  }

  async findByIds(ids: string[]): Promise<BookRecord[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.catalogBook.findMany({
      where: { id: { in: ids } },
      include: {
        translations: true,
        categories: {
          include: { category: { include: { translations: true, parent: true } } },
        },
      },
    });
    const byId = new Map(rows.map((row) => [row.id, hydrateBook(row)]));
    return ids.map((id) => byId.get(id)).filter((book): book is BookRecord => Boolean(book));
  }

  async findLocalizedSlugsObservedSince(
    candidates: LocalizedBookCandidate[],
    observedSince: string,
    parserVersion: string,
  ): Promise<Set<string>> {
    if (candidates.length === 0) return new Set();
    const slugs = [...new Set(candidates.map(({ slug }) => slug))];
    const locales = [...new Set(candidates.map(({ locale }) => locale))];
    const rows = await this.prisma.catalogBookTranslation.findMany({
      where: {
        locale: { in: locales },
        parserVersion,
        observedAt: { gte: timestamp(observedSince) },
        book: { slug: { in: slugs } },
      },
      select: { locale: true, book: { select: { slug: true } } },
    });
    const requested = new Set(candidates.map(({ slug, locale }) => `${slug}:${locale}`));
    return new Set(
      rows
        .map(({ book, locale }) => `${book.slug}:${locale}`)
        .filter((key) => requested.has(key)),
    );
  }

  async listCategories(): Promise<CatalogCategoryRecord[]> {
    const rows = await this.prisma.catalogCategory.findMany({
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      include: { translations: true, parent: true },
    });
    return rows.map(hydrateCategory);
  }

  async upsertCategories(categories: CatalogCategorySnapshot[]): Promise<void> {
    if (categories.length === 0) return;
    await this.prisma.$transaction(async (transaction) => {
      for (const category of categories) {
        const observedAt = timestamp(category.observedAt);
        const existing = await transaction.catalogCategory.findUnique({
          where: { supplierCategoryId: category.supplierCategoryId },
          select: {
            manualEdited: true,
            translations: {
              where: { locale: category.locale },
              select: { manualEdited: true },
            },
          },
        });
        const persisted = await transaction.catalogCategory.upsert({
          where: { supplierCategoryId: category.supplierCategoryId },
          create: {
            id: category.id,
            supplierCategoryId: category.supplierCategoryId,
            parentId: category.parentId,
            position: category.position,
            observedAt,
          },
          update: {
            ...(existing?.manualEdited
              ? {}
              : {
                  parentId: category.parentId,
                  position: category.position,
                }),
            observedAt,
          },
          select: { id: true },
        });
        await transaction.catalogCategoryTranslation.upsert({
          where: {
            categoryId_locale: { categoryId: persisted.id, locale: category.locale },
          },
          create: {
            id: randomUUID(),
            categoryId: persisted.id,
            locale: category.locale,
            name: category.name,
            sourceUrl: category.sourceUrl,
            observedAt,
          },
          update: {
            ...(existing?.translations[0]?.manualEdited
              ? {}
              : {
                  name: category.name,
                  sourceUrl: category.sourceUrl,
                }),
            observedAt,
          },
        });
      }
    });
  }

  async linkBooksToCategory(
    slugs: string[],
    supplierCategoryId: string,
    observedAtValue: string,
  ): Promise<number> {
    if (slugs.length === 0) return 0;
    const category = await this.prisma.catalogCategory.findUnique({
      where: { supplierCategoryId },
      select: { id: true },
    });
    if (!category) throw new Error('CRAWLER_CATEGORY_NOT_IMPORTED');
    const books = await this.prisma.catalogBook.findMany({
      where: { slug: { in: [...new Set(slugs)] }, manualEdited: false },
      select: { id: true },
    });
    if (books.length === 0) return 0;
    const observedAt = timestamp(observedAtValue);
    await this.prisma.$transaction([
      this.prisma.catalogBookCategory.createMany({
        data: books.map(({ id }) => ({ bookId: id, categoryId: category.id, observedAt })),
        skipDuplicates: true,
      }),
      this.prisma.catalogBookCategory.updateMany({
        where: { categoryId: category.id, bookId: { in: books.map(({ id }) => id) } },
        data: { observedAt },
      }),
    ]);
    return books.length;
  }

  async linkUncategorizedBooksToCategory(
    supplierCategoryId: string,
    observedAtValue: string,
  ): Promise<number> {
    const category = await this.prisma.catalogCategory.findUnique({
      where: { supplierCategoryId },
      select: { id: true },
    });
    if (!category) throw new Error('CRAWLER_CATEGORY_NOT_IMPORTED');
    const books = await this.prisma.catalogBook.findMany({
      where: { categories: { none: {} } },
      select: { id: true },
    });
    if (books.length === 0) return 0;
    await this.prisma.catalogBookCategory.createMany({
      data: books.map(({ id }) => ({
        bookId: id,
        categoryId: category.id,
        observedAt: timestamp(observedAtValue),
      })),
      skipDuplicates: true,
    });
    return books.length;
  }

  async upsert(book: BookRecord, options: { force?: boolean } = {}): Promise<void> {
    const data = bookData(book);
    const localization = book.localizations?.[book.locale];
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.catalogBook.findUnique({
        where: { supplierSku: book.supplierSku },
        select: {
          imageUrls: true,
          manualEdited: true,
          translations: {
            where: { locale: book.locale },
            select: { manualEdited: true },
          },
        },
      });
      const editorialProtected = Boolean(
        existing?.manualEdited || existing?.translations[0]?.manualEdited,
      );
      data.imageUrls = options.force
        ? data.imageUrls
        : [...new Set([...(existing?.imageUrls ?? []), ...data.imageUrls])];
      data.coverImageUrl = data.imageUrls[0] ?? data.coverImageUrl;
      const { id: _id, ...update } = data;
      const persisted = await transaction.catalogBook.upsert({
        where: { supplierSku: book.supplierSku },
        create: data,
        update:
          editorialProtected && !options.force
            ? {
                sourcePriceAmd: data.sourcePriceAmd,
                availability: data.availability,
                observedAt: data.observedAt,
              }
            : { ...update, ...(options.force ? { manualEdited: false } : {}) },
        select: { id: true, manualEdited: true },
      });
      if (!localization || (editorialProtected && !options.force)) return;
      const localizedData = translationData(persisted.id, localization);
      await transaction.catalogBookTranslation.upsert({
        where: {
          bookId_locale: { bookId: persisted.id, locale: localization.locale },
        },
        create: { id: randomUUID(), ...localizedData },
        update: {
          ...localizedData,
          ...(options.force ? { manualEdited: false } : {}),
        },
      });
    });
  }
}
