import type { Book, BookAccent, BookAttribute, BookDetailSection, CatalogCategory } from "./types";

export type CatalogSort = "popular" | "new" | "price-asc" | "price-desc" | "title";
export type CatalogLanguage = "hy" | "ru" | "en";

export type CatalogApiBook = {
  id: string;
  slug: string;
  title: string;
  author: string;
  description: string;
  language: CatalogLanguage;
  locale: CatalogLanguage;
  fallbackLocale: CatalogLanguage;
  isbn: string | null;
  publisher: string | null;
  productCode: string;
  weight?: string | null;
  barcode?: string | null;
  isNew?: boolean | null;
  pageCount?: number | null;
  coverType?: string | null;
  dimensions?: string | null;
  publicationYear?: number | null;
  series?: string | null;
  availability: "PRELIMINARY_AVAILABLE" | "OUT_OF_STOCK";
  coverImageUrl: string | null;
  imageUrls: string[];
  attributes: BookAttribute[];
  detailSections: BookDetailSection[];
  availableLocales: CatalogLanguage[];
  observedAt: string;
  price: { amount: number; currency: "AMD" };
  availabilityNotice: string;
  categories: Array<{
    id: string;
    supplierCategoryId: string;
    parentSupplierCategoryId: string | null;
    name: string;
    locale: CatalogLanguage;
  }>;
};

export type CatalogApiResponse = {
  items: CatalogApiBook[];
  total: number;
  offset: number;
  limit: number;
};

export function isCatalogCategoriesResponse(value: unknown): value is CatalogCategory[] {
  return Array.isArray(value) && value.every((category) => Boolean(
    category &&
    typeof category.id === "string" &&
    typeof category.supplierCategoryId === "string" &&
    typeof category.name === "string",
  ));
}

export type CatalogQuery = {
  locale: CatalogLanguage;
  q?: string;
  title?: string;
  author?: string;
  description?: string;
  productCode?: string;
  barcode?: string;
  isbn?: string;
  publisher?: string;
  series?: string;
  minPrice?: number;
  maxPrice?: number;
  hasCover?: boolean;
  isNew?: boolean;
  language?: CatalogLanguage;
  category?: string;
  available?: boolean;
  sort?: CatalogSort;
  offset?: number;
  limit?: number;
};

export const publicApiBase = (process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1").replace(/\/$/u, "");

const accents: BookAccent[] = ["amber", "coral", "mint", "blue", "violet", "sand"];
const languageLabels: Record<CatalogLanguage, Book["language"]> = {
  hy: "Հայերեն",
  ru: "Русский",
  en: "English",
};

function stableAccent(value: string): BookAccent {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return accents[hash % accents.length];
}

function coverLabel(title: string): string {
  const compact = title.trim().replace(/\s+/gu, " ");
  if (!compact) return "Grqaser";
  const words = compact.split(" ");
  return words.length > 3 ? `${words.slice(0, 2).join(" ")}\n${words.slice(2, 4).join(" ")}` : compact;
}

function storefrontImageUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const isBooksAm = url.hostname === "books.am" || url.hostname === "www.books.am";
    if (isBooksAm && url.searchParams.get("v")?.toLowerCase() === "social") {
      url.pathname = url.pathname.replace(
        /\/media\/catalog\/product\/cache\/[^/]+\//u,
        "/media/catalog/product/",
      );
      url.searchParams.delete("v");
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function mapCatalogBook(book: CatalogApiBook): Book {
  const imageUrls = [...new Set(
    (book.imageUrls ?? (book.coverImageUrl ? [book.coverImageUrl] : []))
      .map(storefrontImageUrl)
      .filter((value): value is string => Boolean(value)),
  )];
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    category:
      book.categories?.find(({ supplierCategoryId }) => supplierCategoryId !== "7463")?.name ??
      book.categories?.[0]?.name ??
      { hy: "Գրքեր", ru: "Книги", en: "Books" }[book.locale],
    categories: book.categories ?? [],
    language: languageLabels[book.language],
    price: book.price.amount,
    year: book.publicationYear ?? undefined,
    pages: book.pageCount ?? undefined,
    binding: book.coverType ?? undefined,
    productCode: book.productCode,
    weight: book.weight,
    barcode: book.barcode,
    isNew: book.isNew,
    dimensions: book.dimensions,
    series: book.series,
    isbn: book.isbn,
    publisher: book.publisher,
    coverImageUrl: storefrontImageUrl(book.coverImageUrl) ?? imageUrls[0] ?? null,
    imageUrls,
    attributes: book.attributes ?? [],
    detailSections: book.detailSections ?? [],
    availableLocales: book.availableLocales ?? [],
    fallbackLocale: book.fallbackLocale ?? book.locale,
    availability: book.availability === "OUT_OF_STOCK" ? "unavailable" : "observed",
    observedAt: book.observedAt,
    accent: stableAccent(book.slug),
    coverLabel: coverLabel(book.title),
    description: book.description,
    badge: book.isNew ? "Новинка" : undefined,
  };
}

export function catalogQueryString(query: CatalogQuery): string {
  const params = new URLSearchParams({
    locale: query.locale,
    offset: String(query.offset ?? 0),
    limit: String(query.limit ?? 24),
  });
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.title?.trim()) params.set("title", query.title.trim());
  if (query.author?.trim()) params.set("author", query.author.trim());
  if (query.description?.trim()) params.set("description", query.description.trim());
  if (query.productCode?.trim()) params.set("productCode", query.productCode.trim());
  if (query.barcode?.trim()) params.set("barcode", query.barcode.trim());
  if (query.isbn?.trim()) params.set("isbn", query.isbn.trim());
  if (query.publisher?.trim()) params.set("publisher", query.publisher.trim());
  if (query.series?.trim()) params.set("series", query.series.trim());
  if (query.minPrice !== undefined) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice !== undefined) params.set("maxPrice", String(query.maxPrice));
  if (query.hasCover !== undefined) params.set("hasCover", String(query.hasCover));
  if (query.isNew !== undefined) params.set("isNew", String(query.isNew));
  if (query.language) params.set("language", query.language);
  if (query.category) params.set("category", query.category);
  if (query.available !== undefined) params.set("available", String(query.available));
  if (query.sort) params.set("sort", query.sort);
  return params.toString();
}

export function isCatalogApiResponse(value: unknown): value is CatalogApiResponse {
  if (!value || typeof value !== "object") return false;
  const response = value as Partial<CatalogApiResponse>;
  return Number.isSafeInteger(response.total) && Array.isArray(response.items)
    && response.items.every((item) => Boolean(item?.id && item.slug && item.title && item.price?.currency === "AMD"));
}
