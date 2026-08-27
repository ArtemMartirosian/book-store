"use client";

import Link from "next/link";
import type { Book } from "../../lib/types";
import { books, booksForFacet, newestBooks, popularBooks, storefrontFacets } from "../../lib/catalog-data";
import { BookCard } from "./BookCard";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized } from "./i18n";
import { container, cx, eyebrow } from "./ui";

const facetLooks = {
  amber: "bg-[#c9ff3d] text-[#0b0c10]",
  coral: "bg-[#ff715b] text-[#0b0c10]",
  blue: "bg-[#2447ff] text-white",
  mint: "bg-[#7ee2be] text-[#0b0c10]",
  violet: "bg-[#6558ff] text-white",
  sand: "bg-[#e1e4ea] text-[#0b0c10]",
} as const;

function BookShelf({ overline, title, text, items, allLabel, allHref, dark = false }: {
  overline: string;
  title: string;
  text: string;
  items: Book[];
  allLabel: string;
  allHref: string;
  dark?: boolean;
}) {
  return (
    <section className={cx(container, "py-20 max-sm:py-12", dark && "text-white")}>
      <div className="mb-9 grid grid-cols-[minmax(0,1fr)_minmax(260px,440px)_auto] items-end gap-8 max-lg:grid-cols-[1fr_auto] max-md:grid-cols-1">
        <div>
          <span className={cx(eyebrow, dark && "text-[#c9ff3d]")}>{overline}</span>
          <h2 className="mt-3 max-w-[720px] text-[clamp(2.5rem,5vw,5.4rem)] font-black leading-[.86] tracking-[-.075em]">{title}</h2>
        </div>
        <p className={cx("text-[12px] font-medium leading-6", dark ? "text-white/52" : "text-black/52")}>{text}</p>
        <Link className={cx("flex min-h-11 shrink-0 items-center gap-6 border-b-2 pb-1 text-[10px] font-black uppercase tracking-[.04em]", dark ? "border-[#c9ff3d]" : "border-black")} href={allHref}>{allLabel}<span>↗</span></Link>
      </div>
      <div className="grid grid-cols-5 gap-4 max-xl:grid-cols-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:gap-2.5">
        {items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}
      </div>
    </section>
  );
}

export function HomePage() {
  const { locale } = useStorefront();
  const t = dictionary[locale].home;
  const featured = popularBooks(2);
  const heroBook = featured[0] ?? books[0];
  const companionBook = featured[1] ?? books[1];
  const thirdHeroBook = books[5] ?? books[2];
  const newest = newestBooks(5);
  const popular = popularBooks(5);
  const facetHref = (facet: (typeof storefrontFacets)[number]) => `${localized(locale, "/catalog")}?${facet.kind === "language" ? "language" : "category"}=${facet.slug}`;

  return (
    <>
      <section className="border-b-2 border-black bg-[#f1f2f4] py-4">
        <div className={cx(container, "grid grid-cols-[minmax(0,1.55fr)_minmax(290px,.65fr)] gap-4 max-lg:grid-cols-1")}>
          <div className="relative min-h-[540px] overflow-hidden rounded-[30px] bg-[#0b0c10] p-[clamp(1.5rem,4vw,3.75rem)] text-white max-sm:min-h-[650px]">
            <div className="relative z-20 flex h-full max-w-[58%] flex-col max-lg:max-w-[55%] max-sm:max-w-none">
              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[.1em] text-white/55"><span className="size-2 rounded-full bg-[#c9ff3d]" />01 / LUMI DROP</div>
              <h1 className={cx("mt-8 text-[clamp(3.2rem,6vw,6.4rem)] font-black leading-[.82] tracking-[-.075em]", locale === "hy" && "text-[clamp(2.7rem,5vw,5rem)] tracking-[-.04em]")}>{t.heroTitle} <span className="text-[#8f85ff]">{t.heroAccent}</span></h1>
              <p className="mt-7 max-w-[510px] text-[13px] font-medium leading-6 text-white/58">{t.heroText}</p>
              <div className="mt-auto flex flex-wrap items-center gap-4 pt-8 max-sm:mb-[235px]">
                <Link className="flex min-h-13 items-center gap-10 rounded-[14px] bg-[#c9ff3d] px-6 text-[10px] font-black uppercase tracking-[.05em] text-[#111] transition hover:-translate-y-1" href={localized(locale, "/catalog")}>{t.shopNow}<span>↗</span></Link>
                <Link className="px-2 py-3 text-[10px] font-black uppercase tracking-[.05em] text-white/70 underline decoration-white/30 underline-offset-8" href="#delivery">{t.learnMore}</Link>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 top-0 w-[42%] max-sm:top-auto max-sm:h-[255px] max-sm:w-full">
              <div className="absolute inset-x-8 bottom-0 h-[72%] rounded-t-[80px] bg-[#6558ff] max-sm:inset-x-10 max-sm:h-[230px]" />
              {thirdHeroBook && <div className="absolute bottom-10 right-[55%] z-0 w-[120px] -rotate-3 opacity-70 max-sm:bottom-5 max-sm:right-[62%] max-sm:w-[94px]"><BookCover book={thirdHeroBook} size="hero" /></div>}
              {companionBook && <div className="absolute bottom-8 right-[31%] z-10 w-[145px] rotate-2 opacity-90 max-sm:bottom-4 max-sm:right-[35%] max-sm:w-[108px]"><BookCover book={companionBook} size="hero" /></div>}
              {heroBook && <div className="absolute bottom-6 right-[8%] z-20 w-[175px] -rotate-1 drop-shadow-[0_26px_22px_rgba(0,0,0,.3)] max-sm:bottom-3 max-sm:right-[8%] max-sm:w-[126px]"><BookCover book={heroBook} size="hero" /></div>}
            </div>
          </div>

          <div className="grid min-h-[540px] grid-rows-[1.25fr_.75fr] gap-4 max-lg:min-h-0 max-lg:grid-cols-2 max-lg:grid-rows-1 max-sm:grid-cols-1">
            <div className="flex flex-col rounded-[30px] bg-[#6558ff] p-7 text-white">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[.1em] text-white/55"><span>{t.categoryMenu}</span><span>02</span></div>
              <h2 className="mt-7 max-w-[290px] text-[clamp(2rem,3vw,3.2rem)] font-black leading-[.92] tracking-[-.06em]">{t.categoriesTitle}</h2>
              <div className="mt-auto grid gap-2 pt-8">{storefrontFacets.slice(0, 4).map((facet, index) => <Link className="flex min-h-11 items-center justify-between rounded-[12px] bg-white px-4 text-[10px] font-black text-[#111] transition hover:translate-x-1" href={facetHref(facet)} key={facet.slug}><span>{t.facets[index][0]}</span><span>→</span></Link>)}</div>
            </div>
            <div className="relative overflow-hidden rounded-[30px] bg-[#c9ff3d] p-7 text-[#111]">
              <span className="text-[10px] font-black uppercase tracking-[.1em]">{t.deliveryCardTitle}</span>
              <strong className="mt-5 block text-[clamp(2.5rem,4vw,4.4rem)] font-black leading-none tracking-[-.075em]">1 000 ֏</strong>
              <p className="mt-3 max-w-[230px] text-[11px] font-bold leading-5 text-black/55">{t.deliveryCardText} · {dictionary[locale].header.cash}</p>
              <span className="absolute -bottom-9 -right-3 text-[130px] font-black leading-none text-black/[.08]" aria-hidden="true">↗</span>
            </div>
          </div>
        </div>
        <nav className={cx(container, "mt-4 grid grid-cols-6 overflow-hidden rounded-[18px] border-2 border-black bg-white max-lg:grid-cols-3 max-sm:grid-cols-2")} aria-label={t.categoryMenu}>
          {storefrontFacets.map((facet, index) => <Link className="flex min-h-16 items-center justify-between border-r border-black/15 px-4 text-[10px] font-black uppercase tracking-[.04em] transition hover:bg-[#c9ff3d]" href={facetHref(facet)} key={facet.slug}><span>{t.facets[index][0]}</span><span className="text-black/35">{facet.symbol}</span></Link>)}
        </nav>
      </section>

      <section className={cx(container, "grid grid-cols-4 border-x-2 border-b-2 border-black bg-white max-md:grid-cols-2")}>
        {t.values.map(([title, subtitle], index) => <div className="relative min-h-28 border-r border-black/15 px-5 py-5 last:border-r-0 even:max-md:border-r-0" key={title}><span className="text-[10px] font-black text-[#6558ff]">0{index + 1}</span><strong className="mt-3 block text-[15px] font-black tracking-[-.03em]">{title}</strong><small className="mt-1 block text-[10px] font-medium text-black/45">{subtitle}</small></div>)}
      </section>

      <section className={cx(container, "py-20 max-sm:py-12")}>
        <div className="mb-9 grid grid-cols-[1fr_minmax(260px,440px)_auto] items-end gap-8 max-lg:grid-cols-[1fr_auto] max-md:grid-cols-1">
          <div><span className={eyebrow}>{t.categoriesOverline}</span><h2 className="mt-3 text-[clamp(2.5rem,5vw,5.4rem)] font-black leading-[.86] tracking-[-.075em]">{t.categoriesTitle}</h2></div>
          <p className="text-[12px] font-medium leading-6 text-black/52">{t.categoriesText}</p>
          <Link className="flex min-h-11 items-center gap-6 border-b-2 border-black pb-1 text-[10px] font-black uppercase" href={localized(locale, "/catalog")}>{t.browseAll} ↗</Link>
        </div>
        <div className="grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-sm:grid-cols-2 max-sm:gap-2">
          {storefrontFacets.map((facet, index) => {
            const [title, subtitle] = t.facets[index];
            const count = booksForFacet(facet).length;
            return <Link className={cx("group relative flex min-h-[220px] flex-col justify-between overflow-hidden rounded-[24px] p-5 transition duration-300 hover:-translate-y-1", facetLooks[facet.accent])} href={facetHref(facet)} key={facet.slug}><span className="text-[10px] font-black uppercase tracking-[.06em] opacity-65">{String(index + 1).padStart(2, "0")} / {count} {count === 1 ? t.item : t.items}</span><span className="absolute -right-3 top-8 text-[92px] font-black leading-none opacity-10" aria-hidden="true">{facet.symbol}</span><div><h3 className="max-w-[170px] text-[22px] font-black leading-[.9] tracking-[-.055em]">{title}</h3><p className="mt-3 text-[10px] font-bold opacity-62">{subtitle}</p></div><span className="grid size-10 place-items-center self-end rounded-[12px] border-2 border-current/25 text-lg transition group-hover:translate-x-1">→</span></Link>;
          })}
        </div>
      </section>

      <div className="border-y-2 border-black bg-[#e9ebef]">
        <BookShelf overline={t.newOverline} title={t.newTitle} text={t.newText} items={newest} allLabel={t.browseAll} allHref={`${localized(locale, "/catalog")}?sort=new`} />
      </div>

      <section className="bg-[#0b0c10] py-20 text-white max-sm:py-12">
        <div className={container}>
          <div className="mb-9 grid grid-cols-[1fr_minmax(260px,480px)] items-end gap-10 max-md:grid-cols-1 max-md:gap-4"><div><span className={cx(eyebrow, "text-[#c9ff3d]")}>{t.languagesOverline}</span><h2 className="mt-3 text-[clamp(2.6rem,5vw,5.4rem)] font-black leading-[.86] tracking-[-.075em]">{t.languagesTitle}</h2></div><p className="text-[12px] font-medium leading-6 text-white/52">{t.languagesText}</p></div>
          <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
            {storefrontFacets.slice(0, 3).map((facet, index) => {
              const facetBooks = booksForFacet(facet).slice(0, 2);
              const [title, subtitle] = t.facets[index];
              return <Link className="group flex min-h-[255px] items-center justify-between overflow-hidden rounded-[26px] border border-white/13 bg-white/[.055] p-6 transition hover:border-[#8f85ff] hover:bg-[#6558ff]" href={facetHref(facet)} key={facet.slug}><div className="relative z-10 self-stretch py-2"><span className="text-[10px] font-black uppercase tracking-[.1em] text-white/45">{subtitle}</span><h3 className="mt-5 max-w-[160px] text-[28px] font-black leading-[.9] tracking-[-.055em]">{title}</h3><span className="mt-9 inline-flex size-10 items-center justify-center rounded-[12px] border border-white/25 transition group-hover:translate-x-1">→</span></div><div className="relative h-full w-[160px] shrink-0">{facetBooks.map((book, bookIndex) => <div className={cx("absolute bottom-1 right-2 rotate-[7deg]", bookIndex === 1 && "bottom-5 right-16 -rotate-[8deg]")} key={book.id}><BookCover book={book} size="mini" /></div>)}</div></Link>;
            })}
          </div>
        </div>
      </section>

      <BookShelf overline={t.popularOverline} title={t.popularTitle} text={t.popularText} items={popular} allLabel={t.browseAll} allHref={`${localized(locale, "/catalog")}?sort=popular`} />

      <section className={cx(container, "grid grid-cols-[.9fr_1.1fr] overflow-hidden rounded-[32px] border-2 border-black bg-[#6558ff] text-white max-lg:grid-cols-1")} id="about">
        <div className="p-[clamp(2rem,6vw,5rem)]"><span className={cx(eyebrow, "text-[#c9ff3d]")}>{t.aboutOverline}</span><h2 className="mt-5 max-w-[560px] text-[clamp(2.7rem,5vw,5.3rem)] font-black leading-[.88] tracking-[-.075em]">{t.aboutTitle}</h2><p className="mt-6 max-w-[520px] text-[13px] font-medium leading-6 text-white/62">{t.aboutText}</p><Link className="mt-8 inline-flex min-h-13 items-center gap-10 rounded-[14px] bg-[#c9ff3d] px-6 text-[10px] font-black uppercase text-[#0b0c10]" href={localized(locale, "/catalog")}>{t.shopNow}<span>→</span></Link></div>
        <div className="grid content-center gap-3 bg-[#0b0c10] p-[clamp(2rem,6vw,5rem)]">
          {t.benefits.map(([title, text], index) => <div className="flex gap-5 rounded-[18px] border border-white/12 bg-white/[.055] p-5" key={title}><span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#c9ff3d] text-[10px] font-black text-[#0b0c10]">0{index + 1}</span><div><strong className="text-[17px] font-black tracking-[-.03em]">{title}</strong><p className="mt-2 text-[10px] font-medium leading-5 text-white/48">{text}</p></div></div>)}
        </div>
      </section>

      <section className={cx(container, "py-20 max-sm:py-12")} id="delivery">
        <div className="relative overflow-hidden rounded-[32px] border-2 border-black bg-[#c9ff3d] p-[clamp(2rem,5vw,4.5rem)] text-[#0b0c10]">
          <span className="absolute -bottom-16 -right-8 text-[280px] font-black leading-none text-black/[.06]" aria-hidden="true">↗</span>
          <div className="relative z-10 grid grid-cols-[.78fr_1.22fr_auto] items-center gap-10 max-lg:grid-cols-1">
            <div><span className={eyebrow}>{t.deliveryOverline}</span><h2 className="mt-4 whitespace-pre-line text-[clamp(2.7rem,5vw,5.2rem)] font-black leading-[.86] tracking-[-.075em]">{t.deliveryTitle}</h2><p className="mt-5 max-w-[360px] text-[11px] font-bold leading-5 text-black/52">{t.deliveryText}</p></div>
            <ol className="grid gap-2">{t.steps.map(([title, text], index) => <li className="flex gap-4 rounded-[16px] border-2 border-black bg-white/70 p-4" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#6558ff] text-[10px] font-black text-white">{index + 1}</span><div><strong className="text-[15px] font-black tracking-[-.02em]">{title}</strong><p className="mt-1 text-[9px] font-medium leading-4 text-black/52">{text}</p></div></li>)}</ol>
            <div className="grid aspect-square w-[190px] place-items-center rounded-[28px] bg-[#0b0c10] text-center text-white max-lg:w-[170px] max-lg:justify-self-center"><div><small className="text-[9px] font-black uppercase tracking-[.1em] text-[#c9ff3d]">{t.deliveryYerevan}</small><strong className="my-3 block text-[34px] font-black tracking-[-.06em]">1 000 ֏</strong><span className="text-[9px] font-bold text-white/45">{t.fixed}</span></div></div>
          </div>
        </div>
      </section>
    </>
  );
}
