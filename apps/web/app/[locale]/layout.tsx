import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "../components/storefront/i18n";
import { brandName } from "../lib/brand";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  // Route-specific canonical, descriptions and social metadata belong to each page.
  return { title: { default: brandName(locale), template: `%s | ${brandName(locale)}` } };
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <div lang={locale}>{children}</div>;
}
