import type { Metadata } from "next";
import { headers } from "next/headers";
import { DOCUMENT_LOCALE_HEADER, documentLocaleFromHeader } from "./lib/document-locale";
import { BRAND_DESCRIPTIONS, brandName, SITE_URL, indexingEnabled } from "./lib/brand";
import { pageMetadata } from "./components/storefront/locale-seo";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const locale = documentLocaleFromHeader(requestHeaders.get(DOCUMENT_LOCALE_HEADER));

  return {
    ...pageMetadata(locale, { title: brandName(locale), description: BRAND_DESCRIPTIONS[locale] }),
    metadataBase: new URL(SITE_URL),
    title: {
      default: brandName(locale),
      template: `%s | ${brandName(locale)}`,
    },
    applicationName: brandName(locale),
    manifest: "/manifest.webmanifest",
    icons: { icon: [{ url: "/brand/icon-192.png?v=violet-20260924", sizes: "192x192", type: "image/png" }, { url: "/brand/icon-48.png?v=violet-20260924", sizes: "48x48", type: "image/png" }], apple: [{ url: "/brand/apple-touch-icon.png?v=violet-20260924", sizes: "180x180" }] },
    verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, yandex: process.env.YANDEX_SITE_VERIFICATION || undefined },
    robots: { index: indexingEnabled(), follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const lang = documentLocaleFromHeader((await headers()).get(DOCUMENT_LOCALE_HEADER));

  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
