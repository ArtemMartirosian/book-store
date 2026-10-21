import { notFound } from "next/navigation";
import { isLocale } from "../../components/storefront/i18n";
import { pageMetadata } from "../../components/storefront/locale-seo";
import { StorePolicy } from "../../components/storefront/StorePolicy";
import { policyCopy } from "../../components/storefront/policy-copy";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { brandName } from "../../lib/brand";
import { breadcrumbSchema, serializeJsonLd } from "../../lib/structured-data";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, { ...policyCopy[locale].privacy, path: "/privacy" }) : {};
}
export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const breadcrumbs = breadcrumbSchema(locale, [{ name: brandName(locale), path: "" }, { name: policyCopy[locale].privacy.title, path: "/privacy" }]);
  return <StorefrontShell locale={locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} /><StorePolicy locale={locale} kind="privacy" /></StorefrontShell>;
}
