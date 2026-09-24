import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "../../components/storefront/CatalogPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale } from "../../components/storefront/i18n";
import { localeMeta } from "../../components/storefront/locale-meta";
import { pageMetadata } from "../../components/storefront/locale-seo";
import { brandName } from "../../lib/brand";
import { breadcrumbSchema, serializeJsonLd } from "../../lib/structured-data";
import { getServerCatalog, getServerCategories } from "../../lib/server-catalog-api";
import { catalogStateSearch, parseCatalogState } from "../../lib/storefront-state";

export const dynamic = "force-dynamic";

type RouteProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function catalogState(searchParams: RouteProps["searchParams"]) {
  const params = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) search.set(key, first);
  }
  return parseCatalogState(search.toString());
}

export async function generateMetadata({ params, searchParams }: RouteProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const state = await catalogState(searchParams);
  const search = catalogStateSearch(state);
  const pageLabel = { hy: "Էջ", ru: "Страница", en: "Page" }[locale];
  const copy = localeMeta[locale].catalog;
  const paginated = state.page > 1 ? `${pageLabel} ${state.page}` : "";
  return pageMetadata(locale, {
    title: paginated ? `${copy.title} — ${paginated}` : copy.title,
    description: paginated ? `${paginated}. ${copy.description}` : copy.description,
    path: `/catalog${search ? `?${search}` : ""}`,
    // Keep useful unfiltered pagination indexable, not faceted/search combinations.
    noIndex: Boolean(state.query || state.author || state.publisher || state.series || state.minPrice !== undefined || state.maxPrice !== undefined || state.hasCover !== undefined || state.isNew !== undefined || state.language !== "all" || state.category !== "all" || state.sort !== "new" || !state.availableOnly),
  });
}

export default async function LocalizedCatalog({ params, searchParams }: RouteProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const state = await catalogState(searchParams);
  const [catalog, categories] = await Promise.all([
    getServerCatalog({
      locale, q: state.query,
      author: state.author, publisher: state.publisher, series: state.series,
      minPrice: state.minPrice, maxPrice: state.maxPrice, hasCover: state.hasCover, isNew: state.isNew,
      language: state.language === "all" ? undefined : state.language,
      category: state.category === "all" ? undefined : state.category,
      available: state.availableOnly ? true : undefined,
      sort: state.sort, offset: (state.page - 1) * 24, limit: 24,
    }),
    getServerCategories(locale).catch(() => []),
  ]);
  if (state.page > 1 && (state.page - 1) * 24 >= catalog.total) notFound();
  const breadcrumbs = breadcrumbSchema(locale, [
    { name: brandName(locale), path: "" },
    { name: localeMeta[locale].catalog.title, path: "/catalog" },
  ]);
  return <StorefrontShell locale={locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} /><CatalogPage key={catalogStateSearch(state)} initialData={catalog} initialCategories={categories} /></StorefrontShell>;
}
