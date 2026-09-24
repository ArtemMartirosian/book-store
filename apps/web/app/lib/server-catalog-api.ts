import "server-only";
import {
  catalogQueryString,
  isCatalogCategoriesResponse,
  isCatalogApiResponse,
  mapCatalogBook,
  type CatalogApiBook,
  type CatalogQuery,
} from "./catalog-api";

const backendBase = (process.env.BACKEND_INTERNAL_URL?.trim() || "http://127.0.0.1:4000").replace(/\/$/u, "");
const apiBase = `${backendBase}/api/v1`;
const catalogTimeoutMs = 10_000;

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`Catalog API returned ${response.status}`);
  return response.json();
}

export async function getServerCatalog(query: CatalogQuery) {
  const response = await fetch(`${apiBase}/catalog/books?${catalogQueryString(query)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(catalogTimeoutMs),
  });
  const body = await readJson(response);
  if (!isCatalogApiResponse(body)) throw new Error("Catalog API returned an invalid response");
  return { ...body, items: body.items.map(mapCatalogBook) };
}

export async function getServerCategories(locale: CatalogQuery["locale"]) {
  const response = await fetch(`${apiBase}/catalog/categories?locale=${locale}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(catalogTimeoutMs),
  });
  const body = await readJson(response);
  if (!isCatalogCategoriesResponse(body)) throw new Error("Catalog API returned invalid categories");
  return body;
}

export async function getServerBookBySlug(slug: string, locale: CatalogQuery["locale"]) {
  const response = await fetch(
    `${apiBase}/catalog/books/by-slug/${encodeURIComponent(slug)}?locale=${locale}`,
    { cache: "no-store", signal: AbortSignal.timeout(catalogTimeoutMs) },
  );
  if (response.status === 404) return null;
  const body = await readJson(response) as Partial<CatalogApiBook>;
  if (!body.id || !body.slug || !body.title || !body.price) {
    throw new Error("Catalog API returned an invalid book");
  }
  return mapCatalogBook(body as CatalogApiBook);
}
