import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localized } from "../../components/storefront/i18n";
import { StorefrontShell } from "../../components/storefront/StorefrontShell";
import { pageMetadata } from "../../components/storefront/locale-seo";
import { container, cx } from "../../components/storefront/ui";
import { journalArticles, journalCopy, journalSlugs } from "../../lib/journal";
import { brandName } from "../../lib/brand";
import { breadcrumbSchema, serializeJsonLd } from "../../lib/structured-data";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return isLocale(locale) ? pageMetadata(locale, { title: journalCopy[locale].title, description: journalCopy[locale].intro, path: "/journal" }) : {};
}
export default async function JournalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = journalCopy[locale];
  return <StorefrontShell locale={locale}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema(locale, [{ name: brandName(locale), path: "" }, { name: t.title, path: "/journal" }])) }} />
    <div className={cx(container, "py-12 sm:py-16")}>
      <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--accent)]">{brandName(locale)}</p>
      <h1 className="mt-4 text-[clamp(2.3rem,5vw,4rem)] font-bold leading-tight tracking-[-.04em]">{t.title}</h1>
      <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--muted)]">{t.intro}</p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">{journalSlugs.map((slug, index) => {
        const article = journalArticles[slug][locale];
        return <article key={slug} className="flex flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <div className={cx("relative grid h-44 place-items-center overflow-hidden", ["bg-[#eeebff] text-[#6258ff]", "bg-[#eff4db] text-[#7b8636]", "bg-[#fff0e6] text-[#b27955]"][index])} aria-hidden="true"><span className="text-8xl font-black tracking-[-.09em]">0{index + 1}</span><span className="absolute -right-6 -top-12 size-44 rounded-full border-[20px] border-current opacity-[.06]" /></div>
          <div className="flex flex-1 flex-col p-6"><span className="text-xs font-medium text-[var(--muted)]">{t.guide}</span><h2 className="mt-3 text-2xl font-bold leading-tight tracking-[-.03em]"><Link href={localized(locale, "/journal/" + slug)}>{article.title}</Link></h2><p className="mb-5 mt-4 text-sm leading-7 text-[var(--muted)]">{article.summary}</p><Link href={localized(locale, "/journal/" + slug)} className="mt-auto flex min-h-11 items-center justify-between font-semibold text-[var(--accent)]">{t.read}<span aria-hidden="true">↗</span></Link></div>
        </article>;
      })}</div>
    </div>
  </StorefrontShell>;
}
