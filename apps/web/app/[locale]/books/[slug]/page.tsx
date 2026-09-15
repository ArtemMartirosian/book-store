import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookDetailsPage } from "../../../components/storefront/BookDetailsPage";
import { StorefrontShell } from "../../../components/storefront/StorefrontShell";
import { isLocale, type Locale } from "../../../components/storefront/i18n";
import { localeAlternates } from "../../../components/storefront/locale-seo";
import { getServerBookBySlug, getServerCatalog } from "../../../lib/server-catalog-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = isLocale(locale) ? await getServerBookBySlug(slug, locale).catch(() => null) : null;
  if (!isLocale(locale) || !book) return { title: "LUMI Books" };
  const fallback = {
    hy: "Գրքի մանրամասները, գինը և պատվիրելու հնարավորությունը LUMI գրախանութում։ Առաքում Երևանում։",
    ru: "Описание, характеристики и цена книги в LUMI Books. Заказ с доставкой по Еревану.",
    en: "Book details and price at LUMI Books. Order with delivery across Yerevan.",
  }[locale];
  return {
    title: book.title,
    description: `${book.author}. ${book.description.trim() || fallback}`,
    alternates: localeAlternates(locale, `/books/${book.slug}`),
  };
}

export default async function LocalizedBook({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const book = await getServerBookBySlug(slug, locale).catch(() => null);
  if (!book) notFound();
  const related = await getServerCatalog({ locale, available: true, sort: "new", limit: 5 })
    .then((result) => result.items.filter((item) => item.id !== book.id).slice(0, 4))
    .catch(() => []);
  return <StorefrontShell locale={locale as Locale}><BookDetailsPage book={book} related={related} /></StorefrontShell>;
}
