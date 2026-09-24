import { Injectable } from '@nestjs/common';
import type { BookRecord, CatalogCategoryRecord } from '../book.model';
import type {
  CatalogCategorySnapshot,
  CatalogRepository,
  CatalogSearch,
  CatalogSearchResult,
  LocalizedBookCandidate,
} from './catalog.repository';

const FIXTURE_BOOKS: BookRecord[] = [
  {
    id: 'd1e7c1be-74e2-4c7a-9e9d-4aee1bc12301',
    supplierSku: 'DEMO-HY-001',
    slug: 'narek',
    title: 'Մատյան ողբերգության',
    author: 'Գրիգոր Նարեկացի',
    description:
      'Монументальное произведение армянской духовной литературы в тщательно подготовленном современном издании.',
    language: 'hy',
    locale: 'hy',
    isbn: '978-9939-68-999-2',
    publisher: null,
    sourcePriceAmd: 5200,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/am/narek-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:42:00.000Z',
  },
  {
    id: '29f69fbb-569c-45df-9293-a7f8a31c3331',
    supplierSku: 'DEMO-RU-002',
    slug: 'the-little-prince',
    title: 'Маленький принц',
    author: 'Антуан де Сент-Экзюпери',
    description:
      'История о дружбе, ответственности и способности видеть главное — издание для домашней библиотеки и подарка.',
    language: 'ru',
    locale: 'ru',
    isbn: '978-5-17-149999-8',
    publisher: null,
    sourcePriceAmd: 2700,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/ru/the-little-prince-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:38:00.000Z',
  },
  {
    id: 'a17da6f2-e994-48d1-a4c4-fbb402f78737',
    supplierSku: 'DEMO-RU-003',
    slug: 'atomic-habits',
    title: 'Атомные привычки',
    author: 'Джеймс Клир',
    description:
      'Практическая система небольших изменений, которые помогают выстраивать устойчивые привычки без резких рывков.',
    language: 'ru',
    locale: 'ru',
    isbn: '978-5-04-116577-8',
    publisher: null,
    sourcePriceAmd: 6200,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/ru/atomic-habits-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:31:00.000Z',
  },
  {
    id: '720a3034-fd32-4d9e-a6a0-78a1bec13404',
    supplierSku: 'DEMO-RU-004',
    slug: 'one-hundred-years',
    title: 'Сто лет одиночества',
    author: 'Габриэль Гарсиа Маркес',
    description:
      'Семейная сага, в которой история, память и магическое восприятие мира складываются в единый миф.',
    language: 'ru',
    locale: 'ru',
    isbn: '978-5-17-090999-1',
    publisher: null,
    sourcePriceAmd: 4500,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/ru/one-hundred-years-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:29:00.000Z',
  },
  {
    id: 'e6f5c76e-7c93-4c5a-8ca1-05964d913505',
    supplierSku: 'DEMO-RU-005',
    slug: 'sapiens',
    title: 'Sapiens. Краткая история человечества',
    author: 'Юваль Ной Харари',
    description:
      'Большой обзор ключевых поворотов человеческой истории — от когнитивной революции до технологического настоящего.',
    language: 'ru',
    locale: 'ru',
    isbn: '978-5-00139-999-9',
    publisher: null,
    sourcePriceAmd: 6900,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/ru/sapiens-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:22:00.000Z',
  },
  {
    id: '51e3034d-eec6-4f3c-81c6-f91043a13606',
    supplierSku: 'DEMO-EN-006',
    slug: 'creative-act',
    title: 'The Creative Act',
    author: 'Rick Rubin',
    description:
      'A thoughtful collection of observations about attention, practice, and the conditions that help creative work emerge.',
    language: 'en',
    locale: 'en',
    isbn: '978-0-593-65588-6',
    publisher: null,
    sourcePriceAmd: 8800,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/en/creative-act-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:18:00.000Z',
  },
  {
    id: '99ce814c-53e2-4ced-9874-01d36a713707',
    supplierSku: 'DEMO-RU-007',
    slug: 'nineteen-eighty-four',
    title: '1984',
    author: 'Джордж Оруэлл',
    description:
      'Классический роман о языке, власти и хрупкости личной свободы в мире тотального наблюдения.',
    language: 'ru',
    locale: 'ru',
    isbn: '978-5-17-150198-1',
    publisher: null,
    sourcePriceAmd: 3100,
    availability: 'PRELIMINARY_AVAILABLE',
    sourceUrl: 'https://www.books.am/ru/nineteen-eighty-four-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T06:12:00.000Z',
  },
  {
    id: '4ad0fc5d-3739-49b7-84fa-11d895a13808',
    supplierSku: 'DEMO-RU-008',
    slug: 'the-stranger',
    title: 'Посторонний',
    author: 'Альбер Камю',
    description:
      'Лаконичный роман о человеке перед лицом общественных ожиданий, случайности и абсурда.',
    language: 'ru',
    locale: 'ru',
    isbn: '978-5-17-112811-9',
    publisher: null,
    sourcePriceAmd: 2800,
    availability: 'OUT_OF_STOCK',
    sourceUrl: 'https://www.books.am/ru/the-stranger-demo.html',
    coverImageUrl: null,
    observedAt: '2026-08-14T05:58:00.000Z',
  },
];

@Injectable()
export class InMemoryCatalogRepository implements CatalogRepository {
  private readonly books = new Map(FIXTURE_BOOKS.map((book) => [book.id, structuredClone(book)]));
  private readonly categories = new Map<string, CatalogCategoryRecord>();

  async search(input: CatalogSearch): Promise<CatalogSearchResult> {
    const query = input.query?.trim().toLocaleLowerCase();
    const matched = [...this.books.values()].filter((book) => {
      if (input.minSourcePriceAmd !== undefined && book.sourcePriceAmd < input.minSourcePriceAmd) return false;
      if (input.maxSourcePriceAmd !== undefined && book.sourcePriceAmd > input.maxSourcePriceAmd) return false;
      const display = book.localizations?.[input.locale ?? 'hy'] ?? book.localizations?.[book.locale];
      if (input.isNew !== undefined && (display ? display.isNew : book.isNew) !== input.isNew) return false;
      if (input.hasCover !== undefined) {
        const hasCover = Boolean(book.coverImageUrl) || (display ? display.imageUrls.length > 0 : (book.imageUrls?.length ?? 0) > 0);
        if (hasCover !== input.hasCover) return false;
      }
      if (input.available !== undefined) {
        const isAvailable = book.availability === 'PRELIMINARY_AVAILABLE';
        if (isAvailable !== input.available) return false;
      }
      if (input.language && book.language !== input.language) return false;
      if (
        input.category &&
        !book.categories?.some(({ supplierCategoryId }) => supplierCategoryId === input.category)
      ) return false;
      const localized = book.localizations?.[input.locale ?? 'hy'];
      const includes = (
        expected: string | undefined,
        ...values: Array<string | null | undefined>
      ) => !expected?.trim() || values.some((value) =>
        value?.toLocaleLowerCase().includes(expected.trim().toLocaleLowerCase()),
      );
      if (!includes(input.title, book.title, localized?.title)) return false;
      if (!includes(input.author, book.author, localized?.author)) return false;
      if (!includes(input.description, book.description, localized?.description)) return false;
      if (!includes(input.productCode, book.productCode, localized?.productCode)) return false;
      if (!includes(input.barcode, book.barcode, localized?.barcode)) return false;
      if (!includes(input.isbn, book.isbn, localized?.isbn)) return false;
      if (!includes(input.publisher, book.publisher, localized?.publisher)) return false;
      if (!includes(input.series, book.series, localized?.series)) return false;
      const localizedSearchText = Object.values(book.localizations ?? {})
        .map((localization) => [
          localization?.title,
          localization?.author,
          localization?.description,
          localization?.isbn,
          localization?.productCode,
          localization?.barcode,
          localization?.publisher,
          localization?.series,
        ].filter(Boolean).join(' '))
        .join(' ');
      const searchText = [
        book.title,
        book.author,
        book.description,
        book.isbn,
        book.productCode,
        book.barcode,
        book.publisher,
        book.series,
        localizedSearchText,
      ].filter(Boolean).join(' ');
      if (query && !searchText.toLocaleLowerCase().includes(query)) {
        return false;
      }
      return true;
    });
    matched.sort((left, right) => {
      if (input.sort === 'price-asc') return left.sourcePriceAmd - right.sourcePriceAmd;
      if (input.sort === 'price-desc') return right.sourcePriceAmd - left.sourcePriceAmd;
      if (input.sort === 'title') return left.title.localeCompare(right.title);
      return new Date(right.observedAt).valueOf() - new Date(left.observedAt).valueOf();
    });

    return {
      items: matched.slice(input.offset, input.offset + input.limit).map((book) => structuredClone(book)),
      total: matched.length,
      offset: input.offset,
      limit: input.limit,
    };
  }

  async findById(id: string): Promise<BookRecord | null> {
    const book = this.books.get(id);
    return book ? structuredClone(book) : null;
  }

  async findBySlug(slug: string): Promise<BookRecord | null> {
    const book = [...this.books.values()].find((candidate) => candidate.slug === slug);
    return book ? structuredClone(book) : null;
  }

  async findByIds(ids: string[]): Promise<BookRecord[]> {
    return ids
      .map((id) => this.books.get(id))
      .filter((book): book is BookRecord => Boolean(book))
      .map((book) => structuredClone(book));
  }

  async findLocalizedSlugsObservedSince(
    input: LocalizedBookCandidate[],
    observedSince: string,
    parserVersion: string,
  ): Promise<Set<string>> {
    const candidates = new Set(input.map(({ slug, locale }) => `${slug}:${locale}`));
    return new Set(
      [...this.books.values()].flatMap((book) =>
        Object.values(book.localizations ?? {})
          .filter(
            (localization) =>
              localization &&
              candidates.has(`${book.slug}:${localization.locale}`) &&
              localization.parserVersion === parserVersion &&
              new Date(localization.observedAt).valueOf() >= new Date(observedSince).valueOf(),
          )
          .map((localization) => `${book.slug}:${localization!.locale}`),
      ),
    );
  }

  async listCategories(): Promise<CatalogCategoryRecord[]> {
    return [...this.categories.values()]
      .sort((left, right) => left.position - right.position)
      .map((category) => structuredClone(category));
  }

  async upsertCategories(input: CatalogCategorySnapshot[]): Promise<void> {
    for (const category of input) {
      const existing = this.categories.get(category.supplierCategoryId);
      this.categories.set(category.supplierCategoryId, {
        id: category.id,
        supplierCategoryId: category.supplierCategoryId,
        parentSupplierCategoryId: category.parentSupplierCategoryId,
        position: category.position,
        observedAt: category.observedAt,
        localizations: {
          ...(existing?.localizations ?? {}),
          [category.locale]: {
            locale: category.locale,
            name: category.name,
            sourceUrl: category.sourceUrl,
            observedAt: category.observedAt,
          },
        },
      });
    }
  }

  async linkBooksToCategory(
    slugs: string[],
    supplierCategoryId: string,
    _observedAt: string,
  ): Promise<number> {
    const category = this.categories.get(supplierCategoryId);
    if (!category) return 0;
    let linked = 0;
    const requested = new Set(slugs);
    for (const [id, book] of this.books) {
      if (!requested.has(book.slug)) continue;
      const categories = book.categories ?? [];
      if (!categories.some((item) => item.id === category.id)) {
        categories.push(structuredClone(category));
        linked += 1;
      }
      this.books.set(id, { ...book, categories });
    }
    return linked;
  }

  async linkUncategorizedBooksToCategory(
    supplierCategoryId: string,
    _observedAt: string,
  ): Promise<number> {
    const category = this.categories.get(supplierCategoryId);
    if (!category) return 0;
    let linked = 0;
    for (const [id, book] of this.books) {
      if (book.categories?.length) continue;
      this.books.set(id, { ...book, categories: [structuredClone(category)] });
      linked += 1;
    }
    return linked;
  }

  async upsert(book: BookRecord): Promise<void> {
    const existing = this.books.get(book.id);
    this.books.set(
      book.id,
      structuredClone({
        ...existing,
        ...book,
        imageUrls: [...new Set([...(existing?.imageUrls ?? []), ...(book.imageUrls ?? [])])],
        localizations: {
          ...(existing?.localizations ?? {}),
          ...(book.localizations ?? {}),
        },
      }),
    );
  }
}
