import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdvancedSearchPage } from "../../components/storefront/AdvancedSearchPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";

export const metadata: Metadata = {
  title: "Расширенный поиск",
  description: "Точный поиск книг по названию, автору, ISBN, издательству и другим данным издания.",
};

export default async function SearchRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><AdvancedSearchPage /></StorefrontShell>;
}
