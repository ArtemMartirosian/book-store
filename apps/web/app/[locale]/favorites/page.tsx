import { notFound } from "next/navigation";
import { FavoritesPage } from "../../components/storefront/FavoritesPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";
import { localeMeta } from "../../components/storefront/locale-meta";
import { pageMetadata } from "../../components/storefront/locale-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, { ...localeMeta[locale].favorites, path: "/favorites", noIndex: true }) : {};
}

export default async function FavoritesRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><FavoritesPage /></StorefrontShell>;
}
import type { Metadata } from "next";
