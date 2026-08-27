import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import type { BookRecord, PublicBook, StoreLocale } from './book.model';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
  type CatalogSearch,
} from './repositories/catalog.repository';

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CATALOG_REPOSITORY) private readonly repository: CatalogRepository,
    private readonly pricing: PricingService,
  ) {}

  async search(input: CatalogSearch): Promise<{
    items: PublicBook[];
    total: number;
    offset: number;
    limit: number;
    locale: 'hy' | 'ru' | 'en';
    fallbackLocale: StoreLocale;
  }> {
    const result = await this.repository.search(input);
    return {
      ...result,
      items: result.items.map((book) => this.toPublicBook(book, input.locale ?? 'hy')),
      locale: input.locale ?? 'hy',
      fallbackLocale: 'hy',
    };
  }

  async getPublicBook(id: string, locale: StoreLocale = 'hy'): Promise<PublicBook> {
    return this.toPublicBook(await this.getBookRecord(id), locale);
  }

  async getBookRecord(id: string): Promise<BookRecord> {
    const book = await this.repository.findById(id);
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  async getBookRecords(ids: string[]): Promise<BookRecord[]> {
    const uniqueIds = [...new Set(ids)];
    const books = await this.repository.findByIds(uniqueIds);
    if (books.length !== uniqueIds.length) {
      const found = new Set(books.map((book) => book.id));
      throw new NotFoundException({
        message: 'One or more books were not found',
        missingProductIds: uniqueIds.filter((id) => !found.has(id)),
      });
    }
    return books;
  }

  private toPublicBook(book: BookRecord, locale: StoreLocale): PublicBook {
    const {
      sourcePriceAmd,
      supplierSku: _supplierSku,
      sourceUrl: _sourceUrl,
      ...publicFields
    } = book;
    return {
      ...publicFields,
      fallbackLocale: book.locale,
      price: { amount: this.pricing.customerUnitPrice(sourcePriceAmd), currency: 'AMD' },
      availabilityNotice: availabilityNotice[locale][book.availability],
    };
  }
}

const availabilityNotice: Record<StoreLocale, Record<BookRecord['availability'], string>> = {
  hy: {
    PRELIMINARY_AVAILABLE: 'Առկայությունը նախնական է և օպերատորը կհաստատի հայտից հետո։',
    OUT_OF_STOCK: 'Առկա չէ։',
  },
  ru: {
    PRELIMINARY_AVAILABLE: 'Наличие предварительное и подтверждается оператором после заявки.',
    OUT_OF_STOCK: 'Нет в наличии.',
  },
  en: {
    PRELIMINARY_AVAILABLE: 'Availability is preliminary and confirmed by an operator after your request.',
    OUT_OF_STOCK: 'Out of stock.',
  },
};
