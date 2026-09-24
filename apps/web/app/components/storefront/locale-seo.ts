import type { Metadata } from "next";
import type { Locale } from "./i18n";
import { absoluteUrl, brandName, DEFAULT_LOCALE, indexingEnabled, localizedUrl } from "../../lib/brand";

const allLocales: Locale[] = ["hy", "ru", "en"];
export function localeAlternates(locale: Locale, path = "", availableLocales: readonly Locale[] = allLocales, canonicalLocale?: Locale): NonNullable<Metadata["alternates"]> {
  const supported = allLocales.filter((item) => availableLocales.includes(item));
  const fallback = supported.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : supported[0];
  return {
    canonical: localizedUrl(canonicalLocale ?? (supported.includes(locale) ? locale : fallback ?? locale), path),
    languages: Object.fromEntries([
      ...supported.map((item) => [item, localizedUrl(item, path)]),
      ...(fallback ? [["x-default", localizedUrl(fallback, path)]] : []),
    ]),
  };
}

export type PageMetadataInput = {
  title: string; description: string; path?: string; noIndex?: boolean;
  image?: string | null; availableLocales?: readonly Locale[];
  canonicalLocale?: Locale;
};

export function pageMetadata(locale: Locale, { title, description, path = "", noIndex = false, image, availableLocales, canonicalLocale }: PageMetadataInput): Metadata {
  const fullTitle = `${title} | ${brandName(locale)}`;
  const text = description.replace(/\s+/gu, " ").trim().slice(0, 170);
  const socialImage = image && /^https?:\/\//iu.test(image) ? image : absoluteUrl(`/brand/og-${locale}.png`);
  const supportedLocales = availableLocales ?? allLocales;
  const mayIndex = indexingEnabled() && !noIndex && supportedLocales.includes(locale);
  const resolvedLocale = canonicalLocale ?? (supportedLocales.includes(locale) ? locale : supportedLocales.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : supportedLocales[0] ?? locale);
  const alternates = localeAlternates(locale, path, availableLocales, resolvedLocale);
  return {
    title: { absolute: fullTitle }, description: text,
    alternates,
    robots: { index: mayIndex, follow: true, googleBot: { index: mayIndex, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
    openGraph: { title: fullTitle, description: text, url: localizedUrl(resolvedLocale, path), type: "website", siteName: brandName(locale), locale: `${locale}_AM`, alternateLocale: supportedLocales.filter((item) => item !== locale).map((item) => `${item}_AM`), images: [{ url: socialImage, alt: title, ...(!image ? { width: 1200, height: 630 } : {}) }] },
    twitter: { card: "summary_large_image", title: fullTitle, description: text, images: [socialImage] },
  };
}
