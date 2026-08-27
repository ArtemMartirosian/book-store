import type { BookRecord } from '../book.model';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CatalogSearch {
  query?: string;
  locale?: 'hy' | 'ru' | 'en';
  available?: boolean;
  offset: number;
  limit: number;
}

export interface CatalogSearchResult {
  items: BookRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface CatalogRepository {
  search(input: CatalogSearch): Promise<CatalogSearchResult>;
  findById(id: string): Promise<BookRecord | null>;
  findByIds(ids: string[]): Promise<BookRecord[]>;
  upsert(book: BookRecord): Promise<void>;
}
