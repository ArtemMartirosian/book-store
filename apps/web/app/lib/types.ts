export type BookAccent = "amber" | "coral" | "mint" | "blue" | "violet" | "sand";

export type Book = {
  id: string;
  slug: string;
  title: string;
  author: string;
  category: string;
  language: "Հայերեն" | "Русский" | "English";
  sourcePrice: number;
  price: number;
  rating: number;
  reviews: number;
  year: number;
  pages: number;
  binding: string;
  isbn: string;
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
