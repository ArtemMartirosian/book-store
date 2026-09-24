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
    hy: { productCode: "Ապրանքի կոդ", weight: "Քաշ", barcode: "Շտրիխ կոդ", newness: "Նորույթ", yes: "Այո", no: "Ոչ", format: "Չափս", series: "Շարք", images: "Նկարներ", sourceSections: "Ավելին հրատարակության մասին" },
    ru: { productCode: "Код товара", weight: "Вес", barcode: "Штрих-код", newness: "Новинка", yes: "Да", no: "Нет", format: "Формат", series: "Серия", images: "Изображения", sourceSections: "Дополнительно об издании" },
    en: { productCode: "Product code", weight: "Weight", barcode: "Barcode", newness: "New release", yes: "Yes", no: "No", format: "Format", series: "Series", images: "Images", sourceSections: "More about this edition" },
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
    <div className="min-h-[70vh] bg-[#f7f5f0] text-[#202c28] max-sm:pb-24">
      <nav className={cx(container, "flex min-h-16 items-center gap-2 overflow-hidden text-xs text-[#626e64]")} aria-label={t.catalog}>
        <Link className="transition hover:text-[#243e35]" href={localized(locale)}>{t.home}</Link><span aria-hidden="true">/</span>
        <Link className="transition hover:text-[#243e35]" href={localized(locale, "/catalog")}>{t.catalog}</Link><span aria-hidden="true">/</span>
        <span className="max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap text-[#526257]">{book.title}</span>
      </nav>

      <section className={cx(container, "grid grid-cols-[minmax(0,.95fr)_minmax(0,1fr)] items-start gap-[clamp(2rem,5vw,5.5rem)] pb-16 pt-3 max-lg:grid-cols-1 max-lg:gap-8 max-sm:pb-10 max-sm:pt-0")}>
        <div className="sticky top-28 grid min-h-[640px] xl:top-[164px] place-items-center overflow-hidden rounded-[18px] bg-[#eeeee7] p-12 max-lg:static max-lg:min-h-[510px] max-lg:p-7 max-sm:min-h-[440px] max-sm:rounded-2xl max-sm:p-8">
          {book.badge ? <span className="absolute left-5 top-5 z-20 rounded-full bg-[#fbfaf7] px-3 py-2 text-xs text-[#526257]">{localizeBookBadge(locale, book.badge)}</span> : null}
          <div className="pb-4 transition duration-500 hover:-translate-y-1 hover:rotate-[-1deg]"><BookCover book={displayedBook} size="detail" /></div>
          {images.length > 1 ? <div className="absolute inset-x-4 bottom-4 z-20 flex justify-center gap-2 overflow-x-auto" aria-label={detailLabels.images}>
            {images.map((image, index) => <button className={cx("relative size-12 shrink-0 overflow-hidden rounded-lg border bg-[#fbfaf7]", index === activeImage ? "border-[#243e35]" : "border-[#d7dbd1]")} type="button" aria-label={detailLabels.images + " " + (index + 1)} aria-pressed={index === activeImage} onClick={() => setActiveImage(index)} key={image}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="size-full object-contain" loading="lazy" referrerPolicy="no-referrer" src={image} />
            </button>)}
          </div> : null}
          <button className={cx("absolute right-4 top-4 grid size-11 place-items-center rounded-full transition", favorite ? "bg-[#243e35] text-white hover:bg-[#304e41] hover:text-white" : "bg-[#fbfaf7] text-[#526257] hover:bg-white hover:text-[#243e35]")} type="button" onClick={() => toggleFavorite(book)} aria-label={favorite ? t.removeFavorite : t.favorite} aria-pressed={favorite}><HeartIcon filled={favorite} /></button>
        </div>

        <div className="min-w-0 pt-3 max-sm:pt-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[#626e64]">{chips.map((item, index) => <span className="flex items-center gap-3" key={item}>{index > 0 ? <i className="size-[3px] rounded-full bg-[#a7b1a3]" aria-hidden="true" /> : null}{item}</span>)}</div>
          <h1 className="font-display mb-4 mt-5 text-[clamp(2.5rem,4.1vw,4rem)] font-normal leading-[1.08] tracking-[-.04em] max-sm:text-[2.3rem]">{book.title}</h1>
          <p className="text-lg text-[#626e64]">{book.author}</p>
          {book.rating !== undefined ? <div className="mt-4 flex items-center gap-2"><span className="text-base text-[#b58a42]" aria-hidden="true">★</span><strong className="text-sm font-medium">{book.rating}</strong>{book.reviews !== undefined ? <a className="ml-2 text-sm text-[#626e64] underline underline-offset-4" href="#details">{book.reviews} {t.reviews}</a> : null}</div> : null}
          <p className="mt-6 line-clamp-4 text-[15px] leading-7 text-[#526257]">{description}</p>
          {binding || book.isbn ? <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#626e64]">
            {binding ? <p><span>{t.binding}: </span><strong className="font-normal text-[#526257]">{binding}</strong></p> : null}
            {book.isbn ? <p><span>ISBN: </span><strong className="font-normal text-[#526257]">{book.isbn}</strong></p> : null}
          </div> : null}

          <aside className="mt-7 border-t border-[#dedfd5] pt-6">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="text-[32px] font-medium tracking-[-.04em]">{formatAmd(book.price)}</strong>
              <span className="text-xs text-[#626e64]">{t.servicePrice}</span>
            </div>
            <div className="mt-4 flex items-start gap-2.5">
              <i className={cx("mt-1.5 size-1.5 shrink-0 rounded-full bg-[#526e59]", unavailable && "bg-[#995846]")} />
              <div className="grid gap-1"><strong className={cx("text-sm font-normal text-[#526e59]", unavailable && "text-[#995846]")}>{unavailable ? t.unavailable : t.checkStock}</strong><small className="text-xs leading-5 text-[#626e64]" suppressHydrationWarning>{unavailable ? t.unavailableHint : t.lastCheck + ": " + observedAt}</small></div>
            </div>
            <div className="mt-6 grid grid-cols-[124px_minmax(0,1fr)] gap-3 max-sm:grid-cols-[116px_minmax(0,1fr)]">
              <div className="grid min-h-13 grid-cols-[44px_1fr_44px] items-center rounded-xl border border-[#d7dbd1]">
                <button className="min-h-13 text-lg text-[#526257] transition hover:text-[#243e35] disabled:opacity-30" type="button" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="-">−</button>
                <span className="text-center text-sm">{quantity}</span>
                <button className="min-h-13 text-lg text-[#526257] transition hover:text-[#243e35] disabled:opacity-30" type="button" disabled={quantity >= 10} onClick={() => setQuantity((value) => Math.min(10, value + 1))} aria-label="+">+</button>
              </div>
              <button className="flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[#243e35] px-4 text-sm font-medium text-white transition hover:bg-[#304e41] disabled:cursor-not-allowed disabled:bg-[#d9ddd3] disabled:text-[#626e64]" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}><svg className="size-5 shrink-0 max-sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>{unavailable ? t.unavailableButton : t.add}</button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[#dedfd5] pt-6 max-lg:grid-cols-1 max-md:grid-cols-2 max-sm:grid-cols-1">{[[t.delivery, t.deliveryHint], [t.pay, t.payHint]].map(([title, hint]) => <div className="flex gap-3" key={title}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e8ede5] text-[#526e59]" aria-hidden="true">✓</span><p className="grid gap-1"><strong className="text-sm font-medium">{title}</strong><small className="text-xs leading-5 text-[#626e64]">{hint}</small></p></div>)}</div>
          </aside>
        </div>
      </section>

      <section className="border-y border-[#dedfd5] bg-[#fbfaf7] py-16 max-sm:py-12" id="details">
        <div className={cx(container, "grid grid-cols-[1fr_.9fr] gap-16 max-lg:grid-cols-1 max-lg:gap-9")}>
          <div><span className={eyebrow}>{t.edition}</span><h2 className={cx(sectionTitle, "mt-3")}>{t.details}</h2><p className="mt-5 max-w-[560px] text-[15px] leading-7 text-[#526257]">{description}</p></div>
          <dl className="m-0 border-t border-[#c4ccbd]">{details.map(([label, value]) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6 border-b border-[#dedfd5] py-4" key={label}><dt className="text-sm text-[#626e64]">{label}</dt><dd className="m-0 min-w-0 max-w-[230px] break-words text-right text-sm font-semibold">{value}</dd></div>)}</dl>
        </div>
      </section>

      {detailSections.length > 0 ? <section className={cx(container, "py-16 max-sm:py-11")}>
        <span className={eyebrow}>{detailLabels.sourceSections}</span>
        <div className="mt-7 grid gap-5">
          {detailSections.map((section, index) => <article className="rounded-2xl border border-[#dedfd5] bg-[#fbfaf7] p-6" key={`${section.code ?? section.title}-${index}`}>
            <h2 className="font-display text-2xl font-normal">{section.title}</h2>
            {section.attributes.length > 0 ? <dl className="mt-4 grid grid-cols-2 gap-x-8 max-md:grid-cols-1">{section.attributes.map((attribute, attributeIndex) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 border-b border-[#e7e9df] py-3" key={`${attribute.code ?? attribute.label}-${attributeIndex}`}><dt className="text-sm text-[#626e64]">{attribute.label}</dt><dd className="m-0 min-w-0 max-w-[320px] break-words text-right text-sm font-semibold">{attribute.value}</dd></div>)}</dl> : <p className="mt-4 whitespace-pre-line text-base leading-7 text-[#526257]">{section.content}</p>}
          </article>)}
        </div>
      </section> : null}

      <section className="bg-[#e8ede5] py-12">
        <div className={cx(container, "grid grid-cols-3 gap-6 max-md:grid-cols-1")}>{t.flow.map(([title, text], index) => <div className="flex gap-4" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#243e35] text-xs font-bold text-white">0{index + 1}</span><div><h3 className="text-[14px] font-semibold">{title}</h3><p className="mt-1 text-sm leading-5 text-[#626e64]">{text}</p></div></div>)}</div>
      </section>

      <section className={cx(container, "py-16 max-sm:py-11")}>
        <div className="mb-8 flex items-end justify-between gap-5"><div><span className={eyebrow}>{t.related}</span><h2 className={cx(sectionTitle, "mt-2 text-[clamp(2.2rem,4vw,3.5rem)]")}>{t.continue}</h2></div><Link className="shrink-0 text-sm font-bold text-[#243e35] underline underline-offset-4" href={localized(locale, "/catalog")}>{t.all} →</Link></div>
        <div className="book-rail grid grid-cols-4 gap-x-6 gap-y-9 max-lg:grid-cols-2 max-sm:gap-x-3">{related.map((item) => <BookCard book={item} variant="compact" key={item.id} />)}</div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 hidden items-center gap-3 border-t border-[#dedfd5] bg-[#f7f5f0]/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-5px_20px_rgba(31,40,34,.04)] backdrop-blur max-sm:flex">
        <strong className="shrink-0 text-[15px] font-bold">{formatAmd(book.price)}</strong>
        <button className="flex min-h-12 flex-1 items-center justify-between rounded-xl bg-[#243e35] px-5 text-sm font-medium text-white disabled:bg-[#d9ddd3]" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}>{unavailable ? t.unavailableButton : t.add}<span>→</span></button>
      </div>
    </div>
  );
}
