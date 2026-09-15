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

const dateLocales = { hy: "hy-AM", ru: "ru-RU", en: "en-US" } as const;

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return <svg className="size-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.7 5.8c-1.8-2-5-1.6-6.7.5L12 8.7l-2-2.4C8.3 4.2 5.1 3.8 3.3 5.8c-1.9 2.1-1.6 5.4.4 7.3L12 21l8.3-7.9c2-1.9 2.3-5.2.4-7.3Z" /></svg>;
}

export function BookDetailsPage({ book, related }: { book: Book; related: Book[] }) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const { addToCart, locale, toggleFavorite, isFavorite } = useStorefront();
  const favorite = isFavorite(book.id);
  const t = dictionary[locale].product;
  const unavailable = book.availability === "unavailable";
  const category = localizeBookCategory(locale, book.category);
  const binding = book.binding ? localizeBookBinding(locale, book.binding) : null;
  const description = book.description.trim() || t.fallback;
  const publisherLabel = { hy: "Հրատարակիչ", ru: "Издательство", en: "Publisher" }[locale];
  const detailLabels = {
    hy: { productCode: "Ապրանքի կոդ", weight: "Քաշ", barcode: "Բարկոդ", newness: "Նորույթ", yes: "Այո", no: "Ոչ", format: "Չափս", series: "Շարք", images: "Նկարներ", sourceSections: "Բոլոր տվյալները" },
    ru: { productCode: "Код товара", weight: "Вес", barcode: "Штрих-код", newness: "Новинка", yes: "Да", no: "Нет", format: "Формат", series: "Серия", images: "Изображения", sourceSections: "Все данные" },
    en: { productCode: "Product code", weight: "Weight", barcode: "Barcode", newness: "Newness", yes: "Yes", no: "No", format: "Printing format", series: "Series", images: "Images", sourceSections: "All source details" },
  }[locale];
  const detailSections = book.detailSections ?? [];
  const images = book.imageUrls?.length ? book.imageUrls : (book.coverImageUrl ? [book.coverImageUrl] : []);
  const imageCount = images.length;
  const displayedBook = images[activeImage]
    ? { ...book, coverImageUrl: images[activeImage] }
    : book;
  const chips = [book.language, category, book.year ? String(book.year) : null].filter((item): item is string => Boolean(item));
  const details: Array<[string, string | number]> = [
    ...(book.productCode ? [[detailLabels.productCode, book.productCode] as [string, string]] : []),
    [t.language, book.language],
    ...(book.publisher ? [[publisherLabel, book.publisher] as [string, string]] : [[t.category, category] as [string, string]]),
    ...(book.year ? [[t.year, book.year] as [string, number]] : []),
    ...(book.pages ? [[t.pages, book.pages] as [string, number]] : []),
    ...(binding ? [[t.binding, binding] as [string, string]] : []),
    ...(book.weight ? [[detailLabels.weight, book.weight] as [string, string]] : []),
    ...(book.barcode ? [[detailLabels.barcode, book.barcode] as [string, string]] : []),
    ...(book.isNew !== null && book.isNew !== undefined ? [[detailLabels.newness, book.isNew ? detailLabels.yes : detailLabels.no] as [string, string]] : []),
    ...(book.dimensions ? [[detailLabels.format, book.dimensions] as [string, string]] : []),
    ...(book.series ? [[detailLabels.series, book.series] as [string, string]] : []),
    ...(book.isbn ? [["ISBN", book.isbn] as [string, string]] : []),
    ...(imageCount > 0 ? [[detailLabels.images, imageCount] as [string, number]] : []),
  ];
  const observedAt = (() => {
    const parsed = new Date(book.observedAt);
    return Number.isNaN(parsed.valueOf())
      ? book.observedAt
      : new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yerevan" }).format(parsed);
  })();

  return (
    <div className="min-h-[70vh] bg-[#f5f6fb]">
      <nav className={cx(container, "flex min-h-16 items-center gap-2 overflow-hidden text-[9px] font-semibold text-[#858897]")} aria-label="Breadcrumbs">
        <Link className="transition hover:text-[#a94728]" href={localized(locale)}>{t.home}</Link><span>/</span>
        <Link className="transition hover:text-[#a94728]" href={localized(locale, "/catalog")}>{t.catalog}</Link><span>/</span>
        <span className="max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap text-[#4f5851]">{book.title}</span>
      </nav>

      <section className={cx(container, "grid grid-cols-[410px_minmax(0,1fr)_320px] items-start gap-9 pb-20 pt-3 max-xl:grid-cols-[360px_minmax(0,1fr)] max-lg:grid-cols-1 max-lg:gap-7 max-sm:pt-0")}>
        <div className="relative grid min-h-[560px] place-items-center overflow-hidden rounded-[30px] bg-gradient-to-br from-[#ebe9ff] via-[#eef1fa] to-[#dce8ff] p-8 shadow-[inset_0_0_0_1px_rgba(120,120,155,.08)] max-lg:min-h-[460px] max-sm:min-h-[380px] max-sm:rounded-[24px] max-sm:p-5">
          <span className="absolute left-5 top-5 z-20 rounded-full border border-white/70 bg-white/82 px-3.5 py-2 text-[7px] font-black uppercase tracking-[.1em] text-[#575a6a] shadow-sm backdrop-blur">{book.badge ? localizeBookBadge(locale, book.badge) : t.choice}</span>
          <div className="drop-shadow-[0_28px_24px_rgba(31,40,34,.2)] transition duration-300 hover:-translate-y-1 hover:scale-[1.02]"><BookCover book={displayedBook} size="detail" /></div>
          {images.length > 1 ? <div className="absolute inset-x-4 bottom-4 z-20 flex justify-center gap-2 overflow-x-auto" aria-label={detailLabels.images}>
            {images.map((image, index) => <button className={cx("relative size-12 shrink-0 overflow-hidden rounded-xl border-2 bg-white shadow-sm", index === activeImage ? "border-[#6258ff]" : "border-white/80")} type="button" aria-label={`${detailLabels.images} ${index + 1}`} aria-pressed={index === activeImage} onClick={() => setActiveImage(index)} key={image}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="size-full object-contain" loading="lazy" referrerPolicy="no-referrer" src={image} />
            </button>)}
          </div> : null}
          <button className={cx("absolute right-5 top-5 grid size-11 place-items-center rounded-full border border-white/70 bg-white/82 text-[#606373] shadow-sm backdrop-blur transition hover:scale-105 hover:text-[#5147e2]", favorite && "border-[#6258ff] bg-[#6258ff] text-white hover:text-white")} type="button" onClick={() => toggleFavorite(book)} aria-label={favorite ? t.removeFavorite : t.favorite} aria-pressed={favorite}><HeartIcon filled={favorite} /></button>
        </div>

        <div className="min-w-0 py-2">
          <div className="flex flex-wrap gap-2">{chips.map((item) => <span className="rounded-full border border-[#dedfea] bg-white px-3 py-1.5 text-[8px] font-black uppercase tracking-[.07em] text-[#747786]" key={item}>{item}</span>)}</div>
          <h1 className="mb-4 mt-7 text-[clamp(2.7rem,4.6vw,4.8rem)] font-black leading-[.9] tracking-[-.07em]">{book.title}</h1>
          <p className="text-[15px] font-semibold text-[#707382]">{book.author}</p>
          {book.rating !== undefined ? <div className="mt-4 flex items-center gap-3"><strong className="text-[12px]">{book.rating}</strong><span className="text-[11px] tracking-wider text-[#b6502f]">★ ★ ★ ★ ★</span>{book.reviews !== undefined ? <a className="text-[10px] text-[#777d77] underline underline-offset-4" href="#details">{book.reviews} {t.reviews}</a> : null}</div> : null}
          <p className="mt-7 max-w-[720px] text-[13px] leading-7 text-[#646777] max-sm:line-clamp-4">{description}</p>
          {locale !== "ru" && <small className="mt-2 block text-[9px] leading-4 text-[#92978f]">{t.fallback}</small>}
          {binding || book.isbn ? <div className="mt-7 grid grid-cols-2 border-y border-[#dedbd2] text-[11px] max-sm:grid-cols-1">
            {binding ? <div className="py-4 pr-4 max-sm:border-b max-sm:border-[#dedbd2]"><span className="block text-[9px] uppercase tracking-[.06em] text-[#92978f]">{t.binding}</span><strong className="mt-1 block font-semibold">{binding}</strong></div> : null}
            {book.isbn ? <div className={cx("py-4", binding && "border-l border-[#dedbd2] pl-4 max-sm:border-l-0 max-sm:pl-0")}><span className="block text-[9px] uppercase tracking-[.06em] text-[#92978f]">ISBN</span><strong className="mt-1 block font-semibold">{book.isbn}</strong></div> : null}
          </div> : null}
        </div>

        <aside className="sticky top-28 rounded-[24px] bg-[#151722] p-6 text-white shadow-[0_24px_60px_rgba(28,29,48,.18)] max-xl:static max-xl:col-span-2 max-xl:grid max-xl:grid-cols-[1fr_1.1fr] max-xl:gap-6 max-lg:col-span-1 max-lg:grid-cols-1">
          <div>
            <span className="text-[8px] font-black uppercase tracking-[.12em] text-[#d9ff69]">{t.about}</span>
            <div className="mt-3 flex items-baseline gap-2"><strong className="text-[30px] font-black tracking-[-.05em]">{formatAmd(book.price)}</strong></div>
            <span className="mt-1 block text-[8px] text-white/35">{t.servicePrice}</span>
            <div className={cx("mt-5 flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[.06] p-3.5", unavailable && "bg-[#d3495c]/20")}>
              <i className={cx("mt-1 size-2 shrink-0 rounded-full bg-[#2f7654]", unavailable && "bg-[#b5493f]")} />
              <div className="grid gap-1"><strong className="text-[10px] font-semibold">{unavailable ? t.unavailable : t.checkStock}</strong><small className="text-[8px] leading-4 text-white/42" suppressHydrationWarning>{unavailable ? t.unavailableHint : t.lastCheck + ": " + observedAt}</small></div>
            </div>
          </div>
          <div className="mt-5 max-xl:mt-0 max-lg:mt-5">
            <label className="mb-2 block text-[8px] font-black uppercase tracking-[.08em] text-white/42">{t.add}</label>
            <div className="grid min-h-11 grid-cols-[42px_1fr_42px] items-center rounded-xl border border-white/12 bg-white/8">
              <button className="min-h-11 text-lg text-[#777d77] transition hover:text-[#c85f3a]" type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="-">−</button>
              <span className="text-center text-[12px] font-semibold">{quantity}</span>
              <button className="min-h-11 text-lg text-[#777d77] transition hover:text-[#c85f3a] disabled:opacity-30" type="button" disabled={quantity >= 10} onClick={() => setQuantity((value) => Math.min(10, value + 1))} aria-label="+">+</button>
            </div>
            <button className="mt-3 flex min-h-13 w-full shrink-0 items-center justify-between rounded-2xl bg-[#d9ff69] px-5 text-[9px] font-black uppercase tracking-[.07em] text-[#151722] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/35" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}>{unavailable ? t.unavailableButton : t.add}<span className="text-lg">↗</span></button>
            <div className="mt-5 grid gap-3 border-t border-[#dedbd2] pt-5">{[[t.delivery, t.deliveryHint], [t.pay, t.payHint]].map(([title, hint]) => <div className="flex gap-3" key={title}><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#f3ded3] text-[10px] font-bold text-[#a94728]">✓</span><p className="grid gap-1"><strong className="text-[10px] font-semibold">{title}</strong><small className="text-[8px] leading-4 text-[#777d77]">{hint}</small></p></div>)}</div>
          </div>
        </aside>
      </section>

      <section className="border-y border-[#e2e4ed] bg-white py-20 max-sm:py-12" id="details">
        <div className={cx(container, "grid grid-cols-[1fr_.9fr] gap-20 max-lg:grid-cols-1 max-lg:gap-9")}>
          <div><span className={eyebrow}>{t.edition}</span><h2 className={cx(sectionTitle, "mt-3")}>{t.details}</h2><p className="mt-5 max-w-[560px] text-[14px] leading-7 text-[#5f675f]">{description}</p></div>
          <dl className="m-0 border-t border-[#bfc2bb]">{details.map(([label, value]) => <div className="grid grid-cols-[1fr_auto] gap-6 border-b border-[#d8d4ca] py-4" key={label}><dt className="text-[11px] text-[#777d77]">{label}</dt><dd className="m-0 max-w-[230px] text-right text-[11px] font-semibold">{value}</dd></div>)}</dl>
        </div>
      </section>

      {detailSections.length > 0 ? <section className={cx(container, "py-16 max-sm:py-11")}>
        <span className={eyebrow}>{detailLabels.sourceSections}</span>
        <div className="mt-7 grid gap-5">
          {detailSections.map((section, index) => <article className="rounded-[14px] border border-[#dedbd2] bg-white p-6" key={`${section.code ?? section.title}-${index}`}>
            <h2 className="font-display text-2xl font-semibold">{section.title}</h2>
            {section.attributes.length > 0 ? <dl className="mt-4 grid grid-cols-2 gap-x-8 max-md:grid-cols-1">{section.attributes.map((attribute, attributeIndex) => <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-5 border-b border-[#ebe7df] py-3" key={`${attribute.code ?? attribute.label}-${attributeIndex}`}><dt className="text-[11px] text-[#777d77]">{attribute.label}</dt><dd className="m-0 max-w-[320px] text-right text-[11px] font-semibold">{attribute.value}</dd></div>)}</dl> : <p className="mt-4 whitespace-pre-line text-[13px] leading-7 text-[#5f675f]">{section.content}</p>}
          </article>)}
        </div>
      </section> : null}

      <section className="bg-[#e9e7ff] py-12">
        <div className={cx(container, "grid grid-cols-3 gap-6 max-md:grid-cols-1")}>{t.flow.map(([title, text], index) => <div className="flex gap-4" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1d2a23] text-[9px] font-bold text-white">0{index + 1}</span><div><h3 className="text-[14px] font-semibold">{title}</h3><p className="mt-1 text-[10px] leading-5 text-[#667068]">{text}</p></div></div>)}</div>
      </section>

      <section className={cx(container, "py-16 max-sm:py-11")}>
        <div className="mb-8 flex items-end justify-between gap-5"><div><span className={eyebrow}>{t.related}</span><h2 className={cx(sectionTitle, "mt-2 text-[clamp(2.2rem,4vw,3.5rem)]")}>{t.continue}</h2></div><Link className="shrink-0 text-[10px] font-bold text-[#a94728] underline underline-offset-4" href={localized(locale, "/catalog")}>{t.all} →</Link></div>
        <div className="book-rail grid grid-cols-4 gap-5 max-lg:grid-cols-2 max-sm:grid-flow-col max-sm:grid-cols-none max-sm:auto-cols-[72%] max-sm:overflow-x-auto max-sm:pb-4">{related.map((item) => <BookCard book={item} variant="compact" key={item.id} />)}</div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 hidden items-center gap-3 border-t border-[#dedbd2] bg-[#fffdf9]/96 px-4 py-3 shadow-[0_-12px_30px_rgba(31,40,34,.12)] backdrop-blur max-sm:flex">
        <strong className="shrink-0 text-[15px] font-bold">{formatAmd(book.price)}</strong>
        <button className="flex min-h-12 flex-1 items-center justify-between rounded-[9px] bg-[#c85f3a] px-5 text-[10px] font-bold uppercase text-white disabled:bg-[#c9c7c0]" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}>{unavailable ? t.unavailableButton : t.add}<span>→</span></button>
      </div>
    </div>
  );
}
