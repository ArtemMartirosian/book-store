import { indexingEnabled } from "../lib/brand";
import { getSitemapCatalog } from "../lib/server-sitemap";
import { renderSitemapIndex, sitemapDisabled, sitemapUnavailable, xmlResponse } from "../lib/sitemap-data";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (!indexingEnabled()) return sitemapDisabled();
  try {
    const { total } = await getSitemapCatalog(0, 1);
    return xmlResponse(renderSitemapIndex(total));
  } catch {
    // A failed API response is not evidence that the catalog is empty.
    return sitemapUnavailable();
  }
}
