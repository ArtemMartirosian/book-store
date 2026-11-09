import "server-only";
import { isCatalogCategoriesResponse, mapCatalogBook, type CatalogApiBook, type CatalogLanguage } from "./catalog-api";
import { visibleStorefrontCategories } from "./storefront-categories";
import type { Book, CatalogCategory } from "./types";

type ShowcaseBook = Pick<CatalogApiBook,
  "id" | "slug" | "title" | "author" | "language" | "locale" | "publisher" | "isNew" | "availability" | "coverImageUrl" | "observedAt" | "price"
> & { categoryIds: string[] };

type HomeShowcase = {
  books: Book[];
  categories: CatalogCategory[];
  newBooks: Book[];
  affordableBooks: Book[];
  categoryPreviews: Array<{ categoryId: string; books: Book[] }>;
};

const backendBase = (process.env.BACKEND_INTERNAL_URL?.trim() || "http://127.0.0.1:4000").replace(/\/$/u, "");
const freshMs = 60_000;
const staleMaxAgeMs = 300_000;
const refreshBackoffMs = 10_000;

function isLocale(value: unknown): value is CatalogLanguage {
  return value === "hy" || value === "ru" || value === "en";
}

function isShowcaseBook(value: unknown): value is ShowcaseBook {
  if (!value || typeof value !== "object") return false;
  const book = value as Partial<ShowcaseBook>;
  return typeof book.id === "string" && book.id.length > 0
    && typeof book.slug === "string" && book.slug.length > 0
    && typeof book.title === "string" && book.title.length > 0
    && typeof book.author === "string"
    && isLocale(book.language) && isLocale(book.locale)
    && (book.publisher == null || typeof book.publisher === "string")
    && (book.isNew == null || typeof book.isNew === "boolean")
    && (book.availability === "PRELIMINARY_AVAILABLE" || book.availability === "OUT_OF_STOCK")
    && (book.coverImageUrl === null || typeof book.coverImageUrl === "string")
    && typeof book.observedAt === "string"
    && book.price?.currency === "AMD" && Number.isSafeInteger(book.price.amount) && book.price.amount >= 0
    && Array.isArray(book.categoryIds) && book.categoryIds.every(id => typeof id === "string");
}

function isShelf(value: unknown, limit: number): value is ShowcaseBook[] {
  return Array.isArray(value) && value.length <= limit && value.every(isShowcaseBook);
}

function isDepartment(value: unknown): value is { categoryId: string; books: ShowcaseBook[] } {
  if (!value || typeof value !== "object") return false;
  const department = value as { categoryId?: unknown; books?: unknown };
  return typeof department.categoryId === "string" && isShelf(department.books, 4);
}

function mapShowcase(value: unknown): HomeShowcase {
  if (!value || typeof value !== "object") throw new Error("Catalog API returned an invalid showcase");
  const data = value as Record<string, unknown>;
  if (!isShelf(data.books, 24) || !isShelf(data.newBooks, 12) || !isShelf(data.affordableBooks, 8)
    || !isCatalogCategoriesResponse(data.categories)
    || !data.categories.every(category => isLocale(category.locale) && (category.parentSupplierCategoryId === null || typeof category.parentSupplierCategoryId === "string"))
    || !Array.isArray(data.categoryPreviews) || data.categoryPreviews.length > 3 || !data.categoryPreviews.every(isDepartment)) {
    throw new Error("Catalog API returned an invalid showcase");
  }

  const categories = visibleStorefrontCategories(data.categories);
  const byId = new Map(categories.map(category => [category.supplierCategoryId, category]));
  const mapBook = ({ categoryIds, ...book }: ShowcaseBook): Book => mapCatalogBook({
    ...book,
    publisher: book.publisher ?? null,
    fallbackLocale: book.locale,
    description: "",
    isbn: null,
    productCode: "",
    imageUrls: book.coverImageUrl ? [book.coverImageUrl] : [],
    attributes: [],
    detailSections: [],
    availableLocales: [],
    availabilityNotice: "",
    categories: categoryIds.flatMap(id => {
      const category = byId.get(id);
      return category ? [category] : [];
    }),
  });
  return {
    books: data.books.map(mapBook),
    categories,
    newBooks: data.newBooks.map(mapBook),
    affordableBooks: data.affordableBooks.map(mapBook),
    categoryPreviews: data.categoryPreviews.filter(department => byId.has(department.categoryId))
      .map(department => ({ categoryId: department.categoryId, books: department.books.map(mapBook) })),
  };
}

async function fetchShowcase(locale: CatalogLanguage): Promise<HomeShowcase> {
  const query = new URLSearchParams({ locale });
  const response = await fetch(`${backendBase}/api/v1/catalog/showcase?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Catalog showcase API returned ${response.status}`);
  return mapShowcase(await response.json());
}

type HomeShowcaseResult = HomeShowcase & { stale: boolean };
type CacheEntry = {
  snapshot?: { data: HomeShowcase; loadedAt: number };
  pending?: Promise<HomeShowcaseResult>;
  retryAfter?: number;
};

// A public showcase only, keyed by one of the three storefront languages.
// Product, cart and checkout pricing remain fresh reads. Never retain an error
// or turn it into a successful empty catalog; only a bounded last-good result
// can be shown while the API recovers.
export function createHomeShowcaseReader(load = fetchShowcase, now = () => performance.now()) {
  const entries = new Map<CatalogLanguage, CacheEntry>();
  return function read(locale: CatalogLanguage): Promise<HomeShowcaseResult> {
    const entry = entries.get(locale) ?? {};
    entries.set(locale, entry);
    const time = now();
    const snapshot = entry.snapshot;
    if (snapshot && time - snapshot.loadedAt < freshMs) {
      return Promise.resolve({ ...snapshot.data, stale: false });
    }
    if (snapshot && time - snapshot.loadedAt < staleMaxAgeMs && time < (entry.retryAfter ?? 0)) {
      return Promise.resolve({ ...snapshot.data, stale: true });
    }
    if (entry.pending) return entry.pending;

    const pending = Promise.resolve().then(() => load(locale)).then(data => {
      entry.snapshot = { data, loadedAt: now() };
      entry.retryAfter = undefined;
      return { ...data, stale: false };
    }, (error: unknown) => {
      const finishedAt = now();
      if (snapshot && finishedAt - snapshot.loadedAt < staleMaxAgeMs) {
        entry.retryAfter = finishedAt + refreshBackoffMs;
        return { ...snapshot.data, stale: true };
      }
      throw error;
    }).finally(() => { entry.pending = undefined; });
    entry.pending = pending;
    return pending;
  };
}

export const getServerHomeShowcase = createHomeShowcaseReader();
