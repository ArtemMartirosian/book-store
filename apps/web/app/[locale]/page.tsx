import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage } from "../components/storefront/HomePage";
import { StorefrontShell } from "../components/storefront/StorefrontShell";
import { isLocale, locales, type Locale } from "../components/storefront/i18n";
import { localeMeta } from "../components/storefront/locale-meta";
import { localeAlternates } from "../components/storefront/locale-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? { ...localeMeta[locale].home, alternates: localeAlternates(locale) } : {};
}

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><HomePage /></StorefrontShell>;
}
