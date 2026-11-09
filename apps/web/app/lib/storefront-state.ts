import type { CatalogLanguage, CatalogSort } from "./catalog-api";

export type CatalogState = {
  query: string;
  author: string;
  publisher: string;
  series: string;
  minPrice?: number;
  maxPrice?: number;
  hasCover?: boolean;
  isNew?: boolean;
  language: CatalogLanguage | "all";
  category: string;
  sort: CatalogSort;
  availableOnly: boolean;
  page: number;
};

export const defaultCatalogState: CatalogState = {
  query: "", author: "", publisher: "", series: "", language: "all", category: "all", sort: "popular", availableOnly: false, page: 1,
  minPrice: undefined, maxPrice: undefined, hasCover: undefined, isNew: undefined,
};

function priceBound(value: string | null): number | undefined {
  if (value === null || !/^\d+$/u.test(value)) return undefined;
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount <= 2147483647 ? amount : undefined;
}

function optionalBoolean(value: string | null): boolean | undefined {
  return value === "true" ? true : value === "false" ? false : undefined;
}

export function parseCatalogState(search: string): CatalogState {
  const params = new URLSearchParams(search);
  const language = params.get("language");
  const sort = params.get("sort");
  const category = params.get("category");
  const page = Number(params.get("page"));
  const minimum = priceBound(params.get("minPrice"));
  const maximum = priceBound(params.get("maxPrice"));
  // Reject malformed bookmark ranges together; the price form prevents creating them.
  const invalidRange = minimum !== undefined && maximum !== undefined && maximum < minimum;
  return {
    query: (params.get("q") ?? "").slice(0, 120),
    author: (params.get("author") ?? "").slice(0, 500),
    publisher: (params.get("publisher") ?? "").slice(0, 256),
    series: (params.get("series") ?? "").slice(0, 256),
    minPrice: invalidRange ? undefined : minimum,
    maxPrice: invalidRange ? undefined : maximum,
    hasCover: optionalBoolean(params.get("hasCover")),
    isNew: optionalBoolean(params.get("isNew")),
    language: language === "hy" || language === "ru" || language === "en" ? language : "all",
    category: category && /^\d+$/u.test(category) ? category : "all",
    sort: sort === "new" || sort === "price-asc" || sort === "price-desc" || sort === "title" ? sort : defaultCatalogState.sort,
    availableOnly: params.get("available") === "true",
    page: Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger((page - 1) * 24) ? page : 1,
  };
}

export function catalogStateSearch(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.author) params.set("author", state.author);
  if (state.publisher) params.set("publisher", state.publisher);
  if (state.series) params.set("series", state.series);
  if (state.minPrice !== undefined) params.set("minPrice", String(state.minPrice));
  if (state.maxPrice !== undefined) params.set("maxPrice", String(state.maxPrice));
  if (state.hasCover !== undefined) params.set("hasCover", String(state.hasCover));
  if (state.isNew !== undefined) params.set("isNew", String(state.isNew));
  if (state.language !== "all") params.set("language", state.language);
  if (state.category !== "all") params.set("category", state.category);
  if (state.sort !== defaultCatalogState.sort) params.set("sort", state.sort);
  if (state.availableOnly) params.set("available", "true");
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function updateCatalogSearch(search: string, patch: Partial<CatalogState>): string {
  const filterChanged = ["query", "author", "publisher", "series", "minPrice", "maxPrice", "hasCover", "isNew", "language", "category", "sort", "availableOnly"].some((key) => key in patch);
  const state = { ...parseCatalogState(search), ...(filterChanged ? { page: 1 } : {}), ...patch };
  return catalogStateSearch(parseCatalogState(catalogStateSearch(state)));
}

// Keep the ends reachable in a catalog with hundreds of pages without
// rendering a link for every page.
export function catalogPageWindow(page: number, total: number): Array<number | "start-gap" | "end-gap"> {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const current = Math.max(1, Math.min(page, total));
  const start = Math.max(2, Math.min(current - 1, total - 3));
  const end = Math.min(total - 1, start + 2);
  return [
    1, ...(start > 2 ? ["start-gap" as const] : []),
    ...Array.from({ length: end - start + 1 }, (_, index) => start + index),
    ...(end < total - 1 ? ["end-gap" as const] : []), total,
  ];
}

// Alpine Node and Chromium ship different Armenian locale data. A stable
// grouping separator keeps the server-rendered count identical on hydration.
export function formatCatalogCount(total: number, locale: CatalogLanguage): string {
  return String(total).replace(/\B(?=(\d{3})+(?!\d))/gu, locale === "en" ? "," : "\u00a0");
}

export function mergeSearchPage<T extends { id: string }>(current: T[], incoming: T[], offset: number, total: number) {
  const byId = new Map((offset === 0 ? [] : current).map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  const nextOffset = offset + incoming.length;
  return { items: [...byId.values()], total, nextOffset, hasMore: incoming.length > 0 && nextOffset < total };
}

export function createLatestRequestGate() {
  let version = 0;
  let controller: AbortController | undefined;
  return {
    begin() {
      controller?.abort();
      controller = new AbortController();
      const current = ++version;
      const signal = controller.signal;
      return { signal, isCurrent: () => current === version && !signal.aborted };
    },
    cancel() { version += 1; controller?.abort(); },
  };
}

export function homeCatalogResult<B, C>(booksResult: PromiseSettledResult<{ items: B[] }>, categoriesResult: PromiseSettledResult<C[]>) {
  return {
    books: booksResult.status === "fulfilled" ? booksResult.value.items : [],
    categories: categoriesResult.status === "fulfilled" ? categoriesResult.value : [],
    catalogLoadFailed: booksResult.status === "rejected",
    categoryLoadFailed: categoriesResult.status === "rejected",
  };
}
