import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "../components/storefront/HomePage";
import { StorefrontShell } from "../components/storefront/StorefrontShell";
import { isLocale, locales, type Locale } from "../components/storefront/i18n";
import { localeMeta } from "../components/storefront/locale-meta";
import { pageMetadata } from "../components/storefront/locale-seo";
import { homeSchema, serializeJsonLd } from "../lib/structured-data";
import type { CatalogQuery } from "../lib/catalog-api";
import { getServerCatalog, getServerCategories } from "../lib/server-catalog-api";
import { homeCatalogResult } from "../lib/storefront-state";
import type { CatalogCategory } from "../lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, localeMeta[locale].home) : {};
}

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

async function getShowcase(query: CatalogQuery) {
  const preferred = await getServerCatalog({ ...query, hasCover: true });
  const covered = preferred.items.filter(book => book.coverImageUrl);
  const previewSize = Math.min(query.limit ?? 4, 4);
  if (covered.length >= previewSize) return { ...preferred, items: covered };

  // Keep a small real selection even in a department with few or no covers.
  try {
    const fallback = await getServerCatalog({ ...query, limit: previewSize });
    const items = [...new Map([...covered, ...fallback.items].map(book => [book.id, book])).values()];
    return { ...fallback, items: items.slice(0, previewSize) };
  } catch (error) {
    if (covered.length === 0) throw error;
    return { ...preferred, items: covered };
  }
}

async function getDepartmentPreviews(locale: Locale, categories: CatalogCategory[]) {
  const departments = categories.filter(category => category.parentSupplierCategoryId === "7463").slice(0, 3);
  const results = await Promise.allSettled(departments.map(async category => {
    const categoryId = category.supplierCategoryId;
    const { items: books } = await getShowcase({ locale, category: categoryId, available: true, sort: "new", limit: 4 });
    return { categoryId, books };
  }));
  return {
    previews: results.flatMap(result => result.status === "fulfilled" ? [result.value] : []),
    loadFailed: results.some(result => result.status === "rejected"),
  };
}

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const categoryRequest = getServerCategories(locale);
  const [catalog, categories, newBooks, affordableBooks, departments] = await Promise.allSettled([
    getShowcase({ locale, available: true, sort: "new", limit: 24 }),
    categoryRequest,
    getShowcase({ locale, available: true, isNew: true, sort: "new", limit: 12 }),
    getShowcase({ locale, available: true, sort: "price-asc", limit: 8 }),
    categoryRequest.then(items => getDepartmentPreviews(locale, items)),
  ]);
  const home = homeCatalogResult(catalog, categories);
  return <StorefrontShell locale={locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeSchema(locale)) }} /><HomePage
    {...home}
    newBooks={newBooks.status === "fulfilled" ? newBooks.value.items : undefined}
    affordableBooks={affordableBooks.status === "fulfilled" ? affordableBooks.value.items : undefined}
    categoryPreviews={departments.status === "fulfilled" ? departments.value.previews : []}
    showcaseLoadFailed={newBooks.status === "rejected" || affordableBooks.status === "rejected" || (departments.status === "fulfilled" && departments.value.loadFailed)}
  /></StorefrontShell>;
}
