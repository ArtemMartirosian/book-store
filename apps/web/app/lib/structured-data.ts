import type { Locale } from "../components/storefront/i18n";
import { BRAND_NAMES, BRAND_DESCRIPTIONS, SITE_URL, absoluteUrl, localizedUrl } from "./brand";
import type { Book } from "./types";

const organizationId = `${SITE_URL}/#organization`;
const websiteId = `${SITE_URL}/#website`;

/** Catalog text is untrusted: prevent closing the script element from inside JSON. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, "\\u003c").replace(/>/gu, "\\u003e").replace(/&/gu, "\\u0026").replace(/\u2028/gu, "\\u2028").replace(/\u2029/gu, "\\u2029");
}

export function plainDescription(text: string, maxLength = 160): string {
  const plain = text.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 1).trimEnd()}…`;
}

export function bookImageUrls(book: Book): string[] {
  return [...new Set([book.coverImageUrl, ...(book.imageUrls ?? [])].flatMap((value) => {
    if (!value) return [];
    try {
      const url = new URL(value, SITE_URL);
      return url.protocol === "https:" || url.protocol === "http:" ? [url.href] : [];
    } catch { return []; }
  }))];
}

/** Match sitemap languages: actual translations plus the API's real base fallback. */
export function bookLocaleSeo(book: Book, requestedLocale: Locale) {
  const availableLocales = (["hy", "ru", "en"] as const).filter((locale) =>
    book.availableLocales?.includes(locale) || book.fallbackLocale === locale,
  );
  const hasTranslation = availableLocales.includes(requestedLocale);
  const canonicalLocale = hasTranslation ? requestedLocale
    : book.fallbackLocale && availableLocales.includes(book.fallbackLocale) ? book.fallbackLocale
    : availableLocales.includes("hy") ? "hy" : availableLocales[0] ?? requestedLocale;
  return { availableLocales, canonicalLocale, noIndex: !hasTranslation };
}

export function breadcrumbSchema(locale: Locale, pages: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: pages.map((page, index) => ({
      "@type": "ListItem", position: index + 1, name: page.name, item: localizedUrl(locale, page.path),
    })),
  };
}

export function homeSchema(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "OnlineStore", "@id": organizationId,
        name: BRAND_NAMES.hy, alternateName: [BRAND_NAMES.ru, BRAND_NAMES.en],
        url: SITE_URL, description: BRAND_DESCRIPTIONS[locale],
        logo: { "@type": "ImageObject", url: absoluteUrl("/brand/grqaser-mark.png") },
        areaServed: { "@type": "City", name: "Yerevan" },
      },
      {
        "@type": "WebSite", "@id": websiteId,
        name: BRAND_NAMES.hy, alternateName: [BRAND_NAMES.ru, BRAND_NAMES.en],
        url: SITE_URL, inLanguage: ["hy", "ru", "en"],
        publisher: { "@id": organizationId },
      },
    ],
  };
}

function validIsbn(value: string | null): string | undefined {
  const normalized = value?.replace(/[-\s]/gu, "").toUpperCase();
  if (!normalized) return undefined;
  if (/^\d{9}[\dX]$/u.test(normalized)) {
    const sum = [...normalized].reduce((total, digit, index) => total + (digit === "X" ? 10 : Number(digit)) * (10 - index), 0);
    return sum % 11 === 0 ? normalized : undefined;
  }
  if (/^97[89]\d{10}$/u.test(normalized)) {
    const sum = [...normalized].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? normalized : undefined;
  }
  return undefined;
}

export function bookSchema(book: Book, locale: Locale) {
  const url = localizedUrl(locale, `/books/${encodeURIComponent(book.slug)}`);
  const images = bookImageUrls(book);
  const isbn = validIsbn(book.isbn);
  const description = plainDescription(book.description, 5000);
  const confirmation = {
    hy: "Առկայությունն ու ճշգրիտ հրատարակությունը հաստատում ենք պատվերը մշակելիս։",
    ru: "Наличие и точное издание подтверждаются при обработке заказа.",
    en: "Availability and the exact edition are confirmed when the order is processed.",
  }[locale];
  return {
    "@context": "https://schema.org",
    "@type": ["Product", "Book"],
    "@id": `${url}#book`, url, name: book.title,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(book.productCode ? { sku: book.productCode } : {}),
    ...(book.author?.trim() ? { author: { "@type": "Person", name: book.author.trim() } } : {}),
    ...(isbn ? { isbn } : {}),
    ...(book.publisher?.trim() ? { publisher: { "@type": "Organization", name: book.publisher.trim() } } : {}),
    ...(Number.isInteger(book.pages) && book.pages! > 0 ? { numberOfPages: book.pages } : {}),
    ...(Number.isInteger(book.year) && book.year! > 0 ? { datePublished: String(book.year) } : {}),
    inLanguage: { "Հայերեն": "hy", "Русский": "ru", "English": "en" }[book.language],
    ...(Number.isFinite(book.price) && book.price > 0 ? {
      offers: {
        "@type": "Offer", url, price: book.price, priceCurrency: "AMD",
        seller: { "@type": "OnlineStore", "@id": organizationId, name: BRAND_NAMES[locale], url: SITE_URL },
        // A supplier observation is not confirmed stock. Omit unknown availability.
        ...(book.availability === "unavailable" ? { availability: "https://schema.org/OutOfStock" } : { description: confirmation }),
      },
    } : {}),
  };
}
