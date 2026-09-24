import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdvancedSearchPage } from "../../components/storefront/AdvancedSearchPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";
import { localeMeta } from "../../components/storefront/locale-meta";
import { pageMetadata } from "../../components/storefront/locale-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return pageMetadata(locale, { ...localeMeta[locale].search, path: "/search", noIndex: true });
}

export default async function SearchRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><AdvancedSearchPage /></StorefrontShell>;
}
