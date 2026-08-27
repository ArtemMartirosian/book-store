import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookDetailsPage } from "../../../components/storefront/BookDetailsPage";
import { StorefrontShell } from "../../../components/storefront/StorefrontShell";
import { books, getBookBySlug } from "../../../lib/catalog-data";
import { isLocale, locales, type Locale } from "../../../components/storefront/i18n";
import { localeAlternates } from "../../../components/storefront/locale-seo";

export function generateStaticParams() {
  return locales.flatMap((locale) => books.map((book) => ({ locale, slug: book.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const book = getBookBySlug(slug);
  if (!isLocale(locale) || !book) return { title: "LUMI Books" };
  const fallback = locale === "hy"
    ? "Գրքի նկարագրությունը ցուցադրվում է հրատարակության լեզվով։"
    : locale === "en"
      ? "The book description is shown in the edition language."
      : book?.description;
  return {
    title: book.title,
    description: `${book.author}. ${fallback ?? book.description}`,
    alternates: localeAlternates(locale, `/books/${book.slug}`),
  };
}

export default async function LocalizedBook({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const book = getBookBySlug(slug);
  if (!book) notFound();
  return <StorefrontShell locale={locale as Locale}><BookDetailsPage book={book} related={books.filter((item) => item.id !== book.id).slice(0, 4)} /></StorefrontShell>;
}
