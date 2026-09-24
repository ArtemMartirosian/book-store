import type { CatalogLanguage, CatalogSort } from "./catalog-api";

export type CatalogState = {
  query: string;
  language: CatalogLanguage | "all";
  category: string;
  sort: CatalogSort;
  availableOnly: boolean;
  page: number;
};

export const defaultCatalogState: CatalogState = {
  query: "", language: "all", category: "all", sort: "new", availableOnly: true, page: 1,
};

export function parseCatalogState(search: string): CatalogState {
  const params = new URLSearchParams(search);
  const language = params.get("language");
  const sort = params.get("sort");
  const category = params.get("category");
  const page = Number(params.get("page"));
  return {
    query: (params.get("q") ?? "").slice(0, 500),
    language: language === "hy" || language === "ru" || language === "en" ? language : "all",
    category: category && /^\d+$/u.test(category) ? category : "all",
    sort: sort === "popular" || sort === "price-asc" || sort === "price-desc" || sort === "title" ? sort : "new",
    availableOnly: params.get("available") !== "all",
    page: Number.isSafeInteger(page) && page > 0 && Number.isSafeInteger((page - 1) * 24) ? page : 1,
  };
}

export function catalogStateSearch(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.language !== "all") params.set("language", state.language);
  if (state.category !== "all") params.set("category", state.category);
  if (state.sort !== "new") params.set("sort", state.sort);
  if (!state.availableOnly) params.set("available", "all");
  if (state.page > 1) params.set("page", String(state.page));
  return params.toString();
}

export function updateCatalogSearch(search: string, patch: Partial<CatalogState>): string {
  const filterChanged = ["query", "language", "category", "sort", "availableOnly"].some((key) => key in patch);
  const state = { ...parseCatalogState(search), ...(filterChanged ? { page: 1 } : {}), ...patch };
  return catalogStateSearch(parseCatalogState(catalogStateSearch(state)));
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
