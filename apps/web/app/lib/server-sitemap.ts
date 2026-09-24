import "server-only";
import { validateSitemapCatalog, type SitemapCatalog } from "./sitemap-data";

/** A sitemap shard must never require walking the entire catalog or reading demo fixtures. */
export async function getSitemapCatalog(offset: number, limit: number): Promise<SitemapCatalog> {
  const backend = (process.env.BACKEND_INTERNAL_URL?.trim() || "http://127.0.0.1:4000").replace(/\/$/u, "");
  const query = new URLSearchParams({ locale: "hy", sort: "title", offset: String(offset), limit: String(limit) });
  // Deliberately omit available=true: temporary stock status must not remove existing pages.
  const response = await fetch(`${backend}/api/v1/catalog/books?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Sitemap catalog API returned ${response.status}`);
  return validateSitemapCatalog(await response.json(), offset, limit);
}
