import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AccountPage } from "../../components/storefront/AccountPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";
import { localeMeta } from "../../components/storefront/locale-meta";
import { pageMetadata } from "../../components/storefront/locale-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, { ...localeMeta[locale].account, path: "/account", noIndex: true }) : {};
}

export default async function LocalizedAccount({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><AccountPage /></StorefrontShell>;
}
