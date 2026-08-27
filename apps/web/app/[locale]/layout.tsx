import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "../components/storefront/i18n";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const localizedOpenGraph = {
    hy: {
      title: "LUMI Books — գրքեր, որոնք մնում են ձեզ հետ",
      description: "Ժամանակակից գրախանութ՝ առաքմամբ Երևանում։",
    },
    ru: {
      title: "LUMI Books — книги, которые остаются с вами",
      description: "Современный книжный магазин с доставкой по Еревану.",
    },
    en: {
      title: "LUMI Books — books that stay with you",
      description: "A modern bookstore delivering across Yerevan.",
    },
  } as const;

  return {
    openGraph: {
      ...localizedOpenGraph[locale],
      locale: locale === "hy" ? "hy_AM" : locale === "en" ? "en_AM" : "ru_AM",
      type: "website",
      siteName: "LUMI Books",
      images: [{ url: "/og.png", width: 1200, height: 630, alt: "LUMI / BOOKS — Every book you need. In one place." }],
    },
  };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <div lang={locale}>{children}</div>;
}
