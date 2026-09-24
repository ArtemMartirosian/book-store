import { indexingEnabled } from "../../lib/brand";
import { getSitemapCatalog } from "../../lib/server-sitemap";
import {
  BOOKS_PER_SITEMAP, MAX_SITEMAP_ENTRIES, renderBooksSitemap, renderStaticSitemap,
  sitemapDisabled, sitemapShardCount, sitemapUnavailable, xmlResponse,
} from "../../lib/sitemap-data";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ file: string }> }): Promise<Response> {
  if (!indexingEnabled()) return sitemapDisabled();
  const { file } = await context.params;
  if (file === "static.xml") return xmlResponse(renderStaticSitemap());
  const match = /^books-(0|[1-9]\d*)\.xml$/u.exec(file);
  const page = match ? Number(match[1]) : Number.NaN;
  if (!Number.isSafeInteger(page) || page < 0 || page >= MAX_SITEMAP_ENTRIES - 1) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const catalog = await getSitemapCatalog(page * BOOKS_PER_SITEMAP, BOOKS_PER_SITEMAP);
    if (page >= sitemapShardCount(catalog.total)) return new Response("Not found", { status: 404 });
    return xmlResponse(renderBooksSitemap(catalog.items));
  } catch {
    return sitemapUnavailable();
  }
}
