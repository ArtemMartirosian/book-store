import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HomePage, type HomePageProps } from "../components/storefront/HomePage";
import { StorefrontShell } from "../components/storefront/StorefrontShell";
import { isLocale, locales } from "../components/storefront/i18n";
import { localeMeta } from "../components/storefront/locale-meta";
import { pageMetadata } from "../components/storefront/locale-seo";
import { homeSchema, serializeJsonLd } from "../lib/structured-data";
import { getServerHomeShowcase } from "../lib/server-home-showcase";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, localeMeta[locale].home) : {};
}

export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function LocalizedHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  let home: HomePageProps;
  try {
    const { stale, ...showcase } = await getServerHomeShowcase(locale);
    home = { ...showcase, showcaseLoadFailed: stale };
  } catch {
    home = { books: [], catalogLoadFailed: true, categoryLoadFailed: true };
  }
  return <StorefrontShell locale={locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeSchema(locale)) }} /><HomePage {...home} /></StorefrontShell>;
}
