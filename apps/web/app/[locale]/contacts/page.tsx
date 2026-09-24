import { notFound } from "next/navigation";
import { isLocale } from "../../components/storefront/i18n";
import { pageMetadata } from "../../components/storefront/locale-seo";
import { localeMeta } from "../../components/storefront/locale-meta";
import { ShopInformation } from "../../components/storefront/ShopInformation";
import { brandName } from "../../lib/brand";
import { breadcrumbSchema, serializeJsonLd } from "../../lib/structured-data";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, { ...localeMeta[locale].contacts, path: "/contacts" }) : {};
}
export default async function ContactsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const breadcrumbs = breadcrumbSchema(locale, [{ name: brandName(locale), path: "" }, { name: localeMeta[locale].contacts.title, path: "/contacts" }]);
  return <StorefrontShell locale={locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbs) }} /><ShopInformation locale={locale} section="contacts" /></StorefrontShell>;
}
