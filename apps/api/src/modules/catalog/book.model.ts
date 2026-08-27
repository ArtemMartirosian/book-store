export type BookAvailability = 'PRELIMINARY_AVAILABLE' | 'OUT_OF_STOCK';
export type StoreLocale = 'hy' | 'ru' | 'en';

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
  observedAt: string;
}

export interface PublicBook
  extends Omit<BookRecord, 'sourcePriceAmd' | 'supplierSku' | 'sourceUrl'> {
  fallbackLocale: StoreLocale;
  price: {
    amount: number;
    currency: 'AMD';
  };
  availabilityNotice: string;
}
