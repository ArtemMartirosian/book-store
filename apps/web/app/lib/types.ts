export type BookAccent = "amber" | "coral" | "mint" | "blue" | "violet" | "sand";

export type BookAttribute = {
  code: string | null;
  label: string;
  value: string;
};

export type BookDetailSection = {
  code: string | null;
  title: string;
  content: string;
  attributes: BookAttribute[];
};

export type CatalogCategory = {
  id: string;
  supplierCategoryId: string;
  parentSupplierCategoryId: string | null;
  name: string;
  locale: "hy" | "ru" | "en";
};

export type Book = {
  id: string;
  slug: string;
  title: string;
  author: string;
  category: string;
  categories?: CatalogCategory[];
  language: "Հայերեն" | "Русский" | "English";
  sourcePrice?: number;
  price: number;
  rating?: number;
  reviews?: number;
  year?: number;
  pages?: number;
  binding?: string;
  productCode?: string;
  weight?: string | null;
  barcode?: string | null;
  isNew?: boolean | null;
  dimensions?: string | null;
  series?: string | null;
  isbn: string | null;
  publisher?: string | null;
  coverImageUrl?: string | null;
  imageUrls?: string[];
  attributes?: BookAttribute[];
  detailSections?: BookDetailSection[];
  availableLocales?: Array<"hy" | "ru" | "en">;
  availability: "observed" | "reserved" | "unavailable";
  observedAt: string;
  badge?: string;
  accent: BookAccent;
  coverLabel: string;
  description: string;
};

export type AdminOrder = {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: "Новая заявка" | "Проверка" | "Закупка" | "У курьера" | "Доставлен";
  procurement: "Ожидает" | "Подтверждено" | "Не требуется";
  createdAt: string;
  zone: string;
};

export type CrawlEvent = {
  id: string;
  url: string;
  stage: "published" | "quarantine" | "fetched";
  status: number;
  observedAt: string;
  note: string;
};
