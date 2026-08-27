"use client";

import Link from "next/link";
import { useState } from "react";
import type { Book } from "../../lib/types";
import { formatAmd } from "../../lib/catalog-data";
import { BookCard } from "./BookCard";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, localizeBookBadge, localizeBookBinding, localizeBookCategory } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

export function BookDetailsPage({ book, related }: { book: Book; related: Book[] }) {
  const [quantity, setQuantity] = useState(1);
  const [favorite, setFavorite] = useState(false);
  const { addToCart, locale } = useStorefront();
  const t = dictionary[locale].product;
  const unavailable = book.availability === "unavailable";
  const category = localizeBookCategory(locale, book.category);
  const binding = localizeBookBinding(locale, book.binding);

  return (
    <div className="min-h-[70vh] bg-[#f1f2f4]">
      <nav className={cx(container, "flex min-h-14 items-center gap-2 text-[9px] font-bold text-black/40")} aria-label="Breadcrumbs"><Link href={localized(locale)}>{t.home}</Link><span>/</span><Link href={localized(locale, "/catalog")}>{t.catalog}</Link><span>/</span><span className="max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap text-[#0b0c10]">{book.title}</span></nav>

      <section className={cx(container, "mb-20 grid min-h-[650px] grid-cols-[minmax(380px,.9fr)_minmax(0,1.1fr)] overflow-hidden rounded-[30px] border-2 border-black max-lg:grid-cols-1 max-sm:w-full max-sm:rounded-none max-sm:border-x-0")}>
        <div className="relative grid min-h-[650px] place-items-center overflow-hidden bg-[#6558ff] max-sm:min-h-[500px]">
          <div className="absolute -left-36 -top-44 size-[430px] rounded-full border border-white/20" />
          <span className="absolute left-5 top-5 z-20 rounded-[10px] bg-[#c9ff3d] px-3 py-2 text-[8px] font-black uppercase tracking-wider text-[#0b0c10]">{book.badge ? localizeBookBadge(locale, book.badge) : t.choice}</span>
          <div className="-rotate-3 drop-shadow-[0_34px_25px_rgba(41,32,23,.28)] transition hover:rotate-0 hover:scale-[1.035]"><BookCover book={book} size="detail" /></div>
          <button className={cx("absolute right-5 top-5 grid size-11 place-items-center rounded-[12px] bg-white text-xl font-black", favorite && "bg-[#c9ff3d] text-[#0b0c10]")} type="button" onClick={() => setFavorite((value) => !value)} aria-label={favorite ? t.removeFavorite : t.favorite}>{favorite ? "♥" : "♡"}</button>
        </div>

        <div className="flex flex-col justify-center bg-white px-[clamp(3rem,6vw,5.8rem)] py-16 max-sm:px-6 max-sm:py-12">
          <div className="flex flex-wrap gap-2">{[book.language, category, String(book.year)].map((item) => <span className="rounded-[9px] border border-black/15 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-wider text-black/45" key={item}>{item}</span>)}</div>
          <h1 className="mb-3 mt-7 text-[clamp(2.8rem,5vw,5rem)] font-black leading-[.86] tracking-[-.075em]">{book.title}</h1>
          <p className="text-[17px] font-bold text-black/48">{book.author}</p>
          <div className="mt-5 flex items-center gap-2.5"><strong className="text-xs">{book.rating}</strong><span className="text-[9px] tracking-wider text-[#6558ff]">★ ★ ★ ★ ★</span><a className="text-[8px] font-bold text-black/45 underline" href="#reviews">{book.reviews} {t.reviews}</a></div>
          <p className="mt-6 max-w-[620px] text-[13px] font-medium leading-7 text-black/58">{book.description}</p>{locale !== "ru" && <small className="mt-2 text-[8px] leading-4 text-black/38">{t.fallback}</small>}
          <div className="mt-7 flex items-baseline gap-3.5"><strong className="text-3xl font-black tracking-[-.05em]">{formatAmd(book.price)}</strong><span className="text-[8px] font-bold text-black/40">{t.servicePrice}</span></div>
          <div className={cx("mt-5 flex items-center gap-3 rounded-[12px] border-2 border-black bg-[#c9ff3d] p-3.5", unavailable && "bg-[#ff715b]")}><i className="size-2 rounded-full bg-[#0b0c10]" /><div className="grid gap-1"><strong className="text-[9px] font-black">{unavailable ? t.unavailable : t.checkStock}</strong><small className="text-[8px] font-medium text-black/55">{unavailable ? t.unavailableHint : `${t.lastCheck}: ${book.observedAt}`}</small></div></div>
          <div className="mt-5 flex gap-2.5 max-sm:flex-col"><div className="grid h-13 grid-cols-[36px_32px_36px] items-center overflow-hidden rounded-[12px] border-2 border-black"><button className="h-full bg-transparent font-black" type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>−</button><span className="text-center text-[11px] font-black">{quantity}</span><button className="h-full bg-transparent font-black" type="button" onClick={() => setQuantity((value) => value + 1)}>+</button></div><button className="flex h-13 min-w-[240px] flex-1 items-center justify-between rounded-[12px] bg-[#2447ff] px-6 text-[11px] font-black uppercase text-white transition hover:bg-[#0b0c10] disabled:cursor-not-allowed disabled:bg-[#aaa9a4]" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}>{unavailable ? t.unavailableButton : t.add}<span className="text-lg">→</span></button></div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-black/12 pt-5 max-sm:grid-cols-1">{[["⌂", t.delivery, t.deliveryHint], ["✓", t.pay, t.payHint]].map(([icon, title, hint]) => <div className="flex items-center gap-2.5" key={title}><span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[#e9ebef] text-xs font-black">{icon}</span><p className="grid gap-1"><strong className="text-[9px] font-black">{title}</strong><small className="text-[7px] font-medium text-black/40">{hint}</small></p></div>)}</div>
        </div>
      </section>

      <section className="mx-auto grid w-[min(1100px,calc(100%-4rem))] grid-cols-2 gap-24 py-14 pb-20 max-md:grid-cols-1 max-md:gap-8 max-sm:w-[calc(100%-3rem)]"><div><span className={eyebrow}>{t.edition}</span><h2 className={cx(sectionTitle, "mt-3 text-5xl")}>{t.details}</h2><p className="mt-5 max-w-[480px] text-[13px] font-medium leading-7 text-black/52">{book.description} {t.detailSuffix}</p></div><dl className="m-0 border-t-2 border-[#0b0c10]">{[[t.language, book.language], [t.year, book.year], [t.pages, book.pages], [t.binding, binding], ["ISBN", book.isbn], [t.category, category]].map(([label, value]) => <div className="grid grid-cols-2 border-b border-black/12 py-4" key={label}><dt className="text-[10px] font-bold text-black/42">{label}</dt><dd className="m-0 text-[10px] font-black">{value}</dd></div>)}</dl></section>

      <section className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-8 bg-[#0b0c10] px-[max(2rem,calc((100vw-1200px)/2))] py-14 text-white max-md:grid-cols-1 max-md:gap-5">{t.flow.map(([title, text], index) => <div className="contents" key={title}><div className="grid grid-cols-[42px_1fr]"><span className="row-span-2 grid size-8 place-items-center rounded-[10px] bg-[#c9ff3d] text-[8px] font-black text-[#0b0c10]">0{index + 1}</span><h3 className="text-base font-black tracking-[-.03em]">{title}</h3><p className="mt-1 text-[8px] font-medium text-white/48">{text}</p></div>{index < t.flow.length - 1 && <i className="text-xl not-italic text-[#6558ff] max-md:rotate-90 max-md:justify-self-center">→</i>}</div>)}</section>

      <section className={cx(container, "py-20")}><div className="mb-8 flex items-end justify-between"><div><span className={eyebrow}>{t.related}</span><h2 className={cx(sectionTitle, "mt-2 text-[clamp(2.4rem,4vw,3.6rem)]")}>{t.continue}</h2></div><Link className="border-b border-[#182019] pb-1 text-[10px] font-bold" href={localized(locale, "/catalog")}>{t.all} ↗</Link></div><div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:gap-2.5">{related.map((item) => <BookCard book={item} variant="compact" key={item.id} />)}</div></section>
    </div>
  );
}
