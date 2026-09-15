import type { BookRecord, CatalogCategoryRecord, StoreLocale } from '../book.model';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export type CatalogSort = 'popular' | 'new' | 'price-asc' | 'price-desc' | 'title';

export interface CatalogSearch {
  query?: string;
  title?: string;
  author?: string;
  description?: string;
  productCode?: string;
  barcode?: string;
  isbn?: string;
  publisher?: string;
  series?: string;
  locale?: 'hy' | 'ru' | 'en';
  language?: 'hy' | 'ru' | 'en';
  category?: string;
  available?: boolean;
  sort?: CatalogSort;
  offset: number;
  limit: number;
}

export interface CatalogSearchResult {
  items: BookRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface LocalizedBookCandidate {
  slug: string;
  locale: 'hy' | 'ru' | 'en';
}

export interface CatalogCategorySnapshot {
  id: string;
  supplierCategoryId: string;
  parentId: string | null;
  parentSupplierCategoryId: string | null;
  position: number;
  locale: StoreLocale;
  name: string;
  sourceUrl: string;
  observedAt: string;
}

export interface CatalogRepository {
  search(input: CatalogSearch): Promise<CatalogSearchResult>;
  findById(id: string): Promise<BookRecord | null>;
  findBySlug(slug: string): Promise<BookRecord | null>;
  findByIds(ids: string[]): Promise<BookRecord[]>;
  findLocalizedSlugsObservedSince(
    candidates: LocalizedBookCandidate[],
    observedSince: string,
    parserVersion: string,
  ): Promise<Set<string>>;
  listCategories(): Promise<CatalogCategoryRecord[]>;
  upsertCategories(categories: CatalogCategorySnapshot[]): Promise<void>;
  linkBooksToCategory(
    slugs: string[],
    supplierCategoryId: string,
    observedAt: string,
  ): Promise<number>;
  linkUncategorizedBooksToCategory(
    supplierCategoryId: string,
    observedAt: string,
  ): Promise<number>;
  upsert(book: BookRecord, options?: { force?: boolean }): Promise<void>;
}
