import Link from "next/link";
import { brandName } from "../../lib/brand";
import { getShopInfo } from "../../lib/shop-info.mjs";
import { localized, type Locale } from "./i18n";
import { policyCopy, STORE_SUPPORT_EMAIL, type StorePolicyKind } from "./policy-copy";
import { container, cx } from "./ui";

export function StorePolicy({ locale, kind }: { locale: Locale; kind: StorePolicyKind }) {
  const t = policyCopy[locale];
  const document = t[kind];
  const email = getShopInfo(process.env).email ?? { label: STORE_SUPPORT_EMAIL, href: "mailto:" + STORE_SUPPORT_EMAIL };
  return <section className={cx(container, "py-12 pb-20 max-sm:py-8")} data-testid={"store-policy-" + kind}>
    <div className="max-w-3xl">
      <Link href={localized(locale)} className="inline-flex min-h-11 items-center text-xs font-semibold tracking-[.12em] text-[var(--accent)]">{brandName(locale)} <span className="ml-2" aria-hidden="true">↗</span></Link>
      <h1 className="mt-3 text-[clamp(2.1rem,5vw,3.5rem)] font-bold leading-[1.12] tracking-[-.04em]">{document.title}</h1>
      <p className="mt-5 text-base leading-8 text-[var(--muted)]">{document.intro}</p>
      <p className="mt-5 text-xs leading-6 text-[var(--muted)]">{t.updated}</p>
    </div>
    <div className="mt-9 grid items-start gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="rounded-2xl border border-[var(--line)] bg-white p-4 lg:sticky lg:top-48" aria-label={document.title}>
        {document.sections.map((section, index) => <a href={"#section-" + (index + 1)} key={section.title} className="flex min-h-11 gap-3 rounded-xl px-3 py-3 text-sm leading-6 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"><span className="text-[var(--accent)]" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><span>{section.title}</span></a>)}
      </nav>
      <div className="min-w-0 space-y-4">
        {document.sections.map((section, index) => <article id={"section-" + (index + 1)} key={section.title} className="scroll-mt-48 rounded-2xl border border-[var(--line)] bg-white p-7 max-sm:p-5"><h2 className="text-xl font-semibold tracking-tight">{section.title}</h2><p className="mt-4 text-sm leading-8 text-[var(--muted)] sm:text-base">{section.text}</p></article>)}
        <aside className="rounded-2xl border border-[#ded8ff] bg-[var(--accent-soft)] p-7 max-sm:p-5"><h2 className="text-xl font-semibold">{t.contact}</h2><p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t.contactText}</p><a className="inline-flex min-h-12 break-all items-center text-base font-semibold text-[var(--accent)] underline underline-offset-4" href={email.href}>{email.label}</a></aside>
        <nav className="flex flex-wrap gap-x-6 gap-y-1 pt-3" aria-label={t.information}>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)]" href={localized(locale, kind === "privacy" ? "/terms" : "/privacy")}>{t[kind === "privacy" ? "terms" : "privacy"].title} ↗</Link>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)]" href={localized(locale, "/information")}>{t.information} ↗</Link>
          <Link className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--accent)]" href={localized(locale, "/catalog")}>{t.catalog} ↗</Link>
        </nav>
      </div>
    </div>
  </section>;
}
