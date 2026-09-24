import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales, localized } from "../../../components/storefront/i18n";
import { StorefrontShell } from "../../../components/storefront/StorefrontShell";
import { pageMetadata } from "../../../components/storefront/locale-seo";
import { journalArticle, journalCopy, journalSlugs } from "../../../lib/journal";
import { brandName, localizedUrl, SITE_URL } from "../../../lib/brand";
import { breadcrumbSchema, serializeJsonLd } from "../../../lib/structured-data";
import { container, cx } from "../../../components/storefront/ui";

export const dynamic = "force-dynamic";
type Params = { locale: string; slug: string };
export function generateStaticParams() { return locales.flatMap((locale) => journalSlugs.map((slug) => ({ locale, slug }))); }
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const article = journalArticle(slug, locale);
  if (!article) notFound();
  return pageMetadata(locale, { title: article.title, description: article.summary, path: "/journal/" + slug });
}
export default async function JournalArticlePage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const article = journalArticle(slug, locale);
  if (!article) notFound();
  const t = journalCopy[locale];
  const url = localizedUrl(locale, "/journal/" + slug);
  const schema = [
    breadcrumbSchema(locale, [{ name: brandName(locale), path: "" }, { name: t.title, path: "/journal" }, { name: article.title, path: "/journal/" + slug }]),
    { "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.summary, inLanguage: locale, url, mainEntityOfPage: url, author: { "@type": "Organization", name: brandName(locale), url: SITE_URL }, publisher: { "@id": SITE_URL + "/#organization" } },
  ];
  return <StorefrontShell locale={locale}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    <div className={cx(container, "py-10 sm:py-14")}><Link href={localized(locale, "/journal")} className="inline-flex min-h-11 items-center gap-3 text-sm font-medium text-[var(--accent)]">← {t.back}</Link>
      <article className="mx-auto mt-5 max-w-3xl rounded-2xl border border-[var(--line)] bg-white p-6 sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--accent)]">{t.guide}</p><h1 className="mt-5 text-[clamp(2rem,4.5vw,3.3rem)] font-bold leading-[1.12] tracking-[-.04em]">{article.title}</h1><p className="mt-6 text-lg leading-8 text-[var(--muted)]">{article.summary}</p>
        {article.sections.map((section) => <section className="mt-9" key={section.title}><h2 className="text-2xl font-bold tracking-[-.025em]">{section.title}</h2><p className="mt-4 text-base leading-8 text-[var(--muted)]">{section.text}</p></section>)}
        <Link href={localized(locale, "/catalog")} className="mt-10 inline-flex min-h-12 items-center gap-6 rounded-xl bg-[var(--accent)] px-6 text-sm font-semibold text-white hover:bg-[var(--accent-deep)]">{t.catalog}<span aria-hidden="true">↗</span></Link>
      </article>
    </div>
  </StorefrontShell>;
}
