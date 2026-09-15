import { notFound } from "next/navigation";
import { FavoritesPage } from "../../components/storefront/FavoritesPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";

export default async function FavoritesRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><FavoritesPage /></StorefrontShell>;
}
