import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdvancedSearchPage } from "../../components/storefront/AdvancedSearchPage";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../components/storefront/i18n";
import { localeAlternates } from "../../components/storefront/locale-seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = {
    hy: { title: "Ընդլայնված որոնում", description: "Գտեք գիրքը LUMI-ում ըստ անվանման, հեղինակի, ISBN-ի կամ հրատարակչի։" },
    ru: { title: "Расширенный поиск", description: "Найдите книгу в LUMI по названию, автору, ISBN или издательству." },
    en: { title: "Advanced search", description: "Find your next book at LUMI by title, author, ISBN or publisher." },
  }[locale];
  return { ...copy, alternates: localeAlternates(locale, "/search") };
}

export default async function SearchRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <StorefrontShell locale={locale as Locale}><AdvancedSearchPage /></StorefrontShell>;
}
