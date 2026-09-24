import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { BookDetailsPage } from "../../../components/storefront/BookDetailsPage";
import { StorefrontShell } from "../../../components/storefront/StorefrontShell";
import { isLocale } from "../../../components/storefront/i18n";
import { localeMeta } from "../../../components/storefront/locale-meta";
import { pageMetadata } from "../../../components/storefront/locale-seo";
import { brandName } from "../../../lib/brand";
import { bookImageUrls, bookLocaleSeo, bookSchema, breadcrumbSchema, plainDescription, serializeJsonLd } from "../../../lib/structured-data";
import { getServerBookBySlug, getServerCatalog } from "../../../lib/server-catalog-api";

export const dynamic = "force-dynamic";
// One snapshot per server request for metadata and HTML, never a persistent price cache.
const getBookForRequest = cache(getServerBookBySlug);

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  // A timeout/5xx must remain an error, never a false "book not found" response.
  const book = await getBookForRequest(slug, locale);
  if (!book) notFound();
  const localeSeo = bookLocaleSeo(book, locale);
  const fallback = {
    hy: `Գրքի նկարագրությունը, գինը և պատվիրելու հնարավորությունը ${brandName(locale)} գրախանութում։ Առաքում Երևանում։`,
    ru: `Описание, характеристики и цена книги в ${brandName(locale)}. Заказ с доставкой по Еревану.`,
    en: `Book details and price at ${brandName(locale)}. Order with delivery across Yerevan.`,
  }[locale];
  return pageMetadata(locale, {
    title: [book.title, book.author].filter(Boolean).join(" — "),
    description: plainDescription([book.author, book.description.trim() || fallback].filter(Boolean).join(". ")),
    path: `/books/${encodeURIComponent(book.slug)}`,
    image: bookImageUrls(book)[0],
    availableLocales: localeSeo.availableLocales,
    canonicalLocale: localeSeo.canonicalLocale,
    noIndex: localeSeo.noIndex,
  });
}

export default async function LocalizedBook({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const book = await getBookForRequest(slug, locale);
  if (!book) notFound();
  const related = await getServerCatalog({ locale, available: true, sort: "new", limit: 5 })
    .then((result) => result.items.filter((item) => item.id !== book.id).slice(0, 4))
    .catch(() => []);
  const breadcrumbs = breadcrumbSchema(locale, [
    { name: brandName(locale), path: "" },
    { name: localeMeta[locale].catalog.title, path: "/catalog" },
    { name: book.title, path: `/books/${encodeURIComponent(book.slug)}` },
  ]);
  return <StorefrontShell locale={locale}><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd([bookSchema(book, bookLocaleSeo(book, locale).canonicalLocale), breadcrumbs]) }} /><BookDetailsPage book={book} related={related} /></StorefrontShell>;
}
