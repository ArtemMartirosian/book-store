import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "../components/storefront/HomePage";
import { StorefrontShell } from "../components/storefront/StorefrontShell";
import { isLocale, locales, type Locale } from "../components/storefront/i18n";
import { localeMeta } from "../components/storefront/locale-meta";
import { localeAlternates } from "../components/storefront/locale-seo";
import { getServerCatalog, getServerCategories } from "../lib/server-catalog-api";
import type { Book, CatalogCategory } from "../lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { ...localeMeta[locale].home, alternates: localeAlternates(locale) } : {};
}

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let books: Book[] = [];
  let categories: CatalogCategory[] = [];
  try {
    const [catalog, categoryTree] = await Promise.all([
      getServerCatalog({ locale, available: true, sort: "new", limit: 36 }),
      getServerCategories(locale),
    ]);
    books = catalog.items;
    categories = categoryTree;
  } catch {
    // HomePage keeps a small local fallback so an API outage does not blank the landing page.
  }
  return <StorefrontShell locale={locale as Locale}><HomePage books={books} categories={categories} /></StorefrontShell>;
}
