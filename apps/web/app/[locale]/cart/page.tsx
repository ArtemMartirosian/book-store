import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CartPage } from "../../components/storefront/CartPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";
import { localeMeta } from "../../components/storefront/locale-meta";
import { localeAlternates } from "../../components/storefront/locale-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { ...localeMeta[locale].cart, alternates: localeAlternates(locale, "/cart") } : {};
}

export default async function LocalizedCart({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><CartPage /></StorefrontShell>;
}
