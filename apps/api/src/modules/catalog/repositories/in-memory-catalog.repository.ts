import { Injectable } from '@nestjs/common';
import type { BookRecord } from '../book.model';
import type {
  CatalogRepository,
  CatalogSearch,
  CatalogSearchResult,
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

  async search(input: CatalogSearch): Promise<CatalogSearchResult> {
    const query = input.query?.trim().toLocaleLowerCase();
    const matched = [...this.books.values()].filter((book) => {
      if (input.available !== undefined) {
        const isAvailable = book.availability === 'PRELIMINARY_AVAILABLE';
        if (isAvailable !== input.available) return false;
      }
      if (query && !`${book.title} ${book.author} ${book.isbn ?? ''}`.toLocaleLowerCase().includes(query)) {
        return false;
      }
      return true;
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

  async findByIds(ids: string[]): Promise<BookRecord[]> {
    return ids
      .map((id) => this.books.get(id))
      .filter((book): book is BookRecord => Boolean(book))
      .map((book) => structuredClone(book));
  }

  async upsert(book: BookRecord): Promise<void> {
    this.books.set(book.id, structuredClone(book));
  }
}
