import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "../components/storefront/HomePage";
import { StorefrontShell } from "../components/storefront/StorefrontShell";
import { isLocale, locales, type Locale } from "../components/storefront/i18n";
import { localeMeta } from "../components/storefront/locale-meta";
import { pageMetadata } from "../components/storefront/locale-seo";
import { homeSchema, serializeJsonLd } from "../lib/structured-data";
import { getServerCatalog, getServerCategories } from "../lib/server-catalog-api";
import { homeCatalogResult } from "../lib/storefront-state";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, localeMeta[locale].home) : {};
}

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const [catalog, categories, newBooks, affordableBooks] = await Promise.allSettled([
    getServerCatalog({ locale, available: true, sort: "new", limit: 36 }),
    getServerCategories(locale),
    getServerCatalog({ locale, available: true, isNew: true, sort: "new", limit: 24 }),
    getServerCatalog({ locale, available: true, sort: "price-asc", limit: 15 }),
  ]);
  const home = homeCatalogResult(catalog, categories);
  return <StorefrontShell locale={locale as Locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeSchema(locale)) }} /><HomePage {...home} newBooks={newBooks.status === "fulfilled" ? newBooks.value.items : []} affordableBooks={affordableBooks.status === "fulfilled" ? affordableBooks.value.items : []} showcaseLoadFailed={newBooks.status === "rejected" || affordableBooks.status === "rejected"} /></StorefrontShell>;
}
