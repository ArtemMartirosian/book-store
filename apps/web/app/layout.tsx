import type { Metadata } from "next";
import { headers } from "next/headers";
import { DOCUMENT_LOCALE_HEADER, documentLocaleFromHeader } from "./lib/document-locale";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "LUMI Books — книги с доставкой по Еревану",
      template: "%s · LUMI Books",
    },
    description:
      "Современный книжный магазин с прозрачной ценой, аккуратной проверкой издания и доставкой по Еревану.",
    applicationName: "LUMI Books",
    keywords: ["книги", "Ереван", "книжный магазин", "գրքեր", "доставка книг"],
    openGraph: {
      title: "LUMI Books — книги, которые остаются с вами",
      description: "Современный книжный магазин с доставкой по Еревану.",
      type: "website",
      locale: "ru_AM",
      siteName: "LUMI Books",
      images: [{ url: socialImage, width: 1659, height: 948, alt: "LUMI Books" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "LUMI Books",
      description: "Книги с аккуратной доставкой по Еревану.",
      images: [socialImage],
    },
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
