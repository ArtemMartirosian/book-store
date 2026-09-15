import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import type {
  BookRecord,
  CatalogCategoryRecord,
  PublicBook,
  PublicBookCategory,
  StoreLocale,
} from './book.model';
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

  async getPublicBookBySlug(slug: string, locale: StoreLocale = 'hy'): Promise<PublicBook> {
    const book = await this.repository.findBySlug(slug);
    if (!book) throw new NotFoundException('Book not found');
    return this.toPublicBook(book, locale);
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

  async listCategories(locale: StoreLocale = 'hy'): Promise<PublicBookCategory[]> {
    const categories = await this.repository.listCategories();
    return categories.map((category) => this.toPublicCategory(category, locale));
  }

  private toPublicBook(book: BookRecord, locale: StoreLocale): PublicBook {
    const selected = book.localizations?.[locale] ?? book.localizations?.[book.locale];
    const {
      sourcePriceAmd,
      supplierSku: _supplierSku,
      sourceUrl: _sourceUrl,
      localizations,
      ...publicFields
    } = book;
    return {
      ...publicFields,
      ...(selected
        ? {
            title: selected.title,
            author: selected.author,
            description: selected.description,
            isbn: selected.isbn,
            publisher: selected.publisher,
            productCode: selected.productCode,
            weight: selected.weight,
            barcode: selected.barcode,
            isNew: selected.isNew,
            pageCount: selected.pageCount,
            coverType: selected.coverType,
            dimensions: selected.dimensions,
            publicationYear: selected.publicationYear,
            series: selected.series,
            imageUrls: selected.imageUrls,
            coverImageUrl: selected.imageUrls[0] ?? book.coverImageUrl,
            attributes: selected.attributes,
            detailSections: selected.detailSections,
          }
        : {}),
      productCode: selected?.productCode ?? book.productCode ?? book.supplierSku,
      imageUrls: selected?.imageUrls ?? book.imageUrls ?? (book.coverImageUrl ? [book.coverImageUrl] : []),
      attributes: selected?.attributes ?? book.attributes ?? [],
      detailSections: selected?.detailSections ?? book.detailSections ?? [],
      locale: selected?.locale ?? book.locale,
      availableLocales: Object.keys(localizations ?? {}).filter((value): value is StoreLocale =>
        ['hy', 'ru', 'en'].includes(value),
      ),
      categories: (book.categories ?? []).map((category) =>
        this.toPublicCategory(category, locale),
      ),
      fallbackLocale: selected?.locale ?? book.locale,
      price: { amount: this.pricing.customerUnitPrice(sourcePriceAmd), currency: 'AMD' },
      availabilityNotice: availabilityNotice[locale][book.availability],
    };
  }

  private toPublicCategory(
    category: CatalogCategoryRecord,
    locale: StoreLocale,
  ): PublicBookCategory {
    const selected =
      category.localizations[locale] ??
      category.localizations.hy ??
      category.localizations.ru ??
      category.localizations.en;
    if (!selected) throw new Error('CATALOG_CATEGORY_LOCALIZATION_MISSING');
    return {
      id: category.id,
      supplierCategoryId: category.supplierCategoryId,
      parentSupplierCategoryId: category.parentSupplierCategoryId,
      name: selected.name,
      locale: selected.locale,
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
