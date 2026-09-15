export type BookAvailability = 'PRELIMINARY_AVAILABLE' | 'OUT_OF_STOCK';
export type StoreLocale = 'hy' | 'ru' | 'en';

export interface BookAttribute {
  code: string | null;
  label: string;
  value: string;
}

export interface BookDetailSection {
  code: string | null;
  title: string;
  content: string;
  attributes: BookAttribute[];
}

export interface BookLocalization {
  parserVersion: string;
  locale: StoreLocale;
  title: string;
  author: string;
  description: string;
  languageLabel: string | null;
  isbn: string | null;
  publisher: string | null;
  productCode: string;
  weight: string | null;
  barcode: string | null;
  isNew: boolean | null;
  pageCount: number | null;
  coverType: string | null;
  dimensions: string | null;
  publicationYear: number | null;
  series: string | null;
  imageUrls: string[];
  attributes: BookAttribute[];
  detailSections: BookDetailSection[];
  sourceUrl: string;
  observedAt: string;
}

export interface CatalogCategoryLocalization {
  locale: StoreLocale;
  name: string;
  sourceUrl: string;
  observedAt: string;
}

export interface CatalogCategoryRecord {
  id: string;
  supplierCategoryId: string;
  parentSupplierCategoryId: string | null;
  position: number;
  observedAt: string;
  localizations: Partial<Record<StoreLocale, CatalogCategoryLocalization>>;
}

export interface PublicBookCategory {
  id: string;
  supplierCategoryId: string;
  parentSupplierCategoryId: string | null;
  name: string;
  locale: StoreLocale;
}

export interface BookRecord {
  id: string;
  supplierSku: string;
  slug: string;
  title: string;
  author: string;
  description: string;
  language: StoreLocale;
  locale: StoreLocale;
  isbn: string | null;
  publisher: string | null;
  sourcePriceAmd: number;
  availability: BookAvailability;
  sourceUrl: string;
  coverImageUrl: string | null;
  productCode?: string;
  weight?: string | null;
  barcode?: string | null;
  isNew?: boolean | null;
  pageCount?: number | null;
  coverType?: string | null;
  dimensions?: string | null;
  publicationYear?: number | null;
  series?: string | null;
  imageUrls?: string[];
  attributes?: BookAttribute[];
  detailSections?: BookDetailSection[];
  localizations?: Partial<Record<StoreLocale, BookLocalization>>;
  categories?: CatalogCategoryRecord[];
  observedAt: string;
}

export interface PublicBook
  extends Omit<
    BookRecord,
    'sourcePriceAmd' | 'supplierSku' | 'sourceUrl' | 'localizations' | 'categories'
  > {
  productCode: string;
  imageUrls: string[];
  attributes: BookAttribute[];
  detailSections: BookDetailSection[];
  availableLocales: StoreLocale[];
  fallbackLocale: StoreLocale;
  categories: PublicBookCategory[];
  price: {
    amount: number;
    currency: 'AMD';
  };
  availabilityNotice: string;
}
