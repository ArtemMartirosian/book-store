"use client";

import Link from "next/link";
import { useState } from "react";
import type { Book } from "../../lib/types";
import { formatAmd } from "../../lib/catalog-data";
import { BookCard } from "./BookCard";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, localizeBookBinding, localizeBookCategory } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

const dateLocales = { hy: "hy-AM", ru: "ru-RU", en: "en-US" } as const;

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return <svg className="size-5" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.7 5.8c-1.8-2-5-1.6-6.7.5L12 8.7l-2-2.4C8.3 4.2 5.1 3.8 3.3 5.8c-1.9 2.1-1.6 5.4.4 7.3L12 21l8.3-7.9c2-1.9 2.3-5.2.4-7.3Z" /></svg>;
}

export function BookDetailsPage({ book, related }: { book: Book; related: Book[] }) {
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<"description" | "specifications">("description");
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
  const controls = {
    hy: { description: "Նկարագրություն", specifications: "Բնութագրեր", decrease: "Նվազեցնել քանակը", increase: "Ավելացնել քանակը", quantity: "Քանակ", more: "Կարդալ ավելին" },
    ru: { description: "Описание", specifications: "Характеристики", decrease: "Уменьшить количество", increase: "Увеличить количество", quantity: "Количество", more: "Читать описание" },
    en: { description: "Description", specifications: "Book details", decrease: "Decrease quantity", increase: "Increase quantity", quantity: "Quantity", more: "Read description" },
  }[locale];
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
      ? ""
      : new Intl.DateTimeFormat(dateLocales[locale], { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Yerevan" }).format(parsed);
  })();

  return (
    <div className="min-h-[70vh] bg-[var(--paper)] text-[var(--ink)] max-sm:pb-24">
      <nav className={cx(container, "flex min-h-16 items-center gap-2 overflow-hidden text-xs text-[var(--muted)]")} aria-label={t.catalog}>
        <Link className="transition hover:text-[var(--accent)]" href={localized(locale)}>{t.home}</Link><span aria-hidden="true">/</span>
        <Link className="transition hover:text-[var(--accent)]" href={localized(locale, "/catalog")}>{t.catalog}</Link><span aria-hidden="true">/</span>
        <span className="max-w-[280px] overflow-hidden text-ellipsis whitespace-nowrap text-[var(--muted)]">{book.title}</span>
      </nav>

      <section className={cx(container, "grid grid-cols-[minmax(0,.95fr)_minmax(0,1fr)] items-start gap-[clamp(2rem,5vw,5.5rem)] pb-16 pt-3 max-lg:grid-cols-1 max-lg:gap-8 max-sm:pb-10 max-sm:pt-0")}>
        <div className="sticky top-28 grid min-h-[590px] xl:top-[164px] place-items-center overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-12 max-lg:static max-lg:min-h-[510px] max-lg:p-7 max-sm:min-h-[440px] max-sm:rounded-2xl max-sm:p-8">
          <div className="pointer-events-none absolute inset-x-10 inset-y-12 rounded-[45%] bg-[var(--accent)]/4" aria-hidden="true" />
          {book.isNew === true ? <span className="absolute left-5 top-5 z-20 rounded-lg bg-[var(--paper)] px-3 py-2 text-xs font-semibold text-[var(--accent)]">{dictionary[locale].header.new}</span> : null}
          <div className="relative pb-4 transition duration-500 hover:-translate-y-1"><BookCover book={displayedBook} size="detail" /></div>
          {images.length > 1 ? <div className="absolute inset-x-4 bottom-4 z-20 flex justify-center gap-2 overflow-x-auto" aria-label={detailLabels.images}>
            {images.map((image, index) => <button className={cx("relative size-12 shrink-0 overflow-hidden rounded-lg border bg-[var(--white)]", index === activeImage ? "border-[var(--accent)]" : "border-[var(--line)]")} type="button" aria-label={detailLabels.images + " " + (index + 1)} aria-pressed={index === activeImage} onClick={() => setActiveImage(index)} key={image}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="" className="size-full object-contain" loading="lazy" referrerPolicy="no-referrer" src={image} />
            </button>)}
          </div> : null}
          <button className={cx("absolute right-4 top-4 grid size-11 place-items-center rounded-full transition", favorite ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] hover:text-white" : "bg-[var(--white)] text-[var(--muted)] hover:bg-white hover:text-[var(--accent)]")} type="button" onClick={() => toggleFavorite(book)} aria-label={favorite ? t.removeFavorite : t.favorite} aria-pressed={favorite}><HeartIcon filled={favorite} /></button>
        </div>

        <div className="min-w-0 pt-3 max-sm:pt-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-[var(--muted)]">{chips.map((item, index) => <span className="flex items-center gap-3" key={item}>{index > 0 ? <i className="size-[3px] rounded-full bg-[var(--line)]" aria-hidden="true" /> : null}{item}</span>)}</div>
          <h1 className="mb-3 mt-4 text-[clamp(1.65rem,3vw,2.65rem)] font-semibold leading-[1.2] tracking-[-.035em]">{book.title}</h1>
          {book.author ? <Link className="inline-flex min-h-11 items-center text-base text-[var(--accent)] underline-offset-4 hover:underline" href={`${localized(locale, "/catalog")}?author=${encodeURIComponent(book.author)}`}>{book.author}</Link> : null}
          <p className="mt-4 line-clamp-3 text-sm leading-7 text-[var(--muted)]">{description}</p>
          <a className="inline-flex min-h-11 items-center text-xs font-semibold text-[var(--accent)] hover:underline" href="#details" onClick={() => setActiveTab("description")}>{controls.more} ↓</a>
          {binding || book.isbn ? <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[var(--muted)]">
            {binding ? <p><span>{t.binding}: </span><strong className="font-normal text-[var(--muted)]">{binding}</strong></p> : null}
            {book.isbn ? <p><span>ISBN: </span><strong className="font-normal text-[var(--muted)]">{book.isbn}</strong></p> : null}
          </div> : null}

          <aside className="mt-5 rounded-2xl border border-[var(--line)] bg-white p-6 max-sm:p-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="text-[30px] font-bold tracking-[-.035em]">{formatAmd(book.price)}</strong>
              <span className="text-xs text-[var(--muted)]">{t.servicePrice}</span>
            </div>
            <div className="mt-4 flex items-start gap-2.5">
              <i className={cx("mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--accent)]", unavailable && "bg-[#995846]")} />
              <div className="grid gap-1"><strong className={cx("text-sm font-medium text-[var(--accent)]", unavailable && "text-[#995846]")}>{unavailable ? t.unavailable : t.checkStock}</strong>{unavailable || observedAt ? <small className="text-xs leading-5 text-[var(--muted)]" suppressHydrationWarning>{unavailable ? t.unavailableHint : t.lastCheck + ": " + observedAt}</small> : null}</div>
            </div>
            <div className="mt-6 grid grid-cols-[124px_minmax(0,1fr)] gap-3 max-sm:grid-cols-[116px_minmax(0,1fr)]">
              <div className="grid min-h-13 grid-cols-[44px_1fr_44px] items-center rounded-xl border border-[var(--line)]">
                <button className="min-h-13 text-lg text-[var(--muted)] transition hover:text-[var(--accent)] disabled:opacity-30" type="button" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label={controls.decrease}>−</button>
                <output className="text-center text-sm" aria-label={controls.quantity}>{quantity}</output>
                <button className="min-h-13 text-lg text-[var(--muted)] transition hover:text-[var(--accent)] disabled:opacity-30" type="button" disabled={quantity >= 10} onClick={() => setQuantity((value) => Math.min(10, value + 1))} aria-label={controls.increase}>+</button>
              </div>
              <button className="flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white transition hover:bg-[var(--accent-deep)] disabled:cursor-not-allowed disabled:bg-[#d9ddd3] disabled:text-[var(--muted)]" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}><svg className="size-5 shrink-0 max-sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>{unavailable ? t.unavailableButton : t.add}</button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-6 max-lg:grid-cols-1 max-md:grid-cols-2 max-sm:grid-cols-1">{[[t.delivery, t.deliveryHint], [t.pay, t.payHint]].map(([title, hint]) => <div className="flex gap-3" key={title}><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[var(--accent)]" aria-hidden="true">✓</span><p className="grid gap-1"><strong className="text-sm font-medium">{title}</strong><small className="text-xs leading-5 text-[var(--muted)]">{hint}</small></p></div>)}</div>
          </aside>
        </div>
      </section>

      <section className="scroll-mt-44 border-y border-[var(--line)] bg-white py-10 max-sm:py-8" id="details">
        <div className={container}>
          <div className="flex gap-2 border-b border-[var(--line)]" role="tablist" aria-label={t.details}>
            {(["description", "specifications"] as const).map((tab) => <button className={cx("min-h-12 border-b-2 px-5 text-sm font-semibold transition max-sm:px-3", activeTab === tab ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]")} type="button" role="tab" id={`book-tab-${tab}`} aria-controls={`book-panel-${tab}`} aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} onClick={() => setActiveTab(tab)} onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const next = event.key === "Home" ? "description" : event.key === "End" ? "specifications" : tab === "description" ? "specifications" : "description";
              setActiveTab(next);
              document.getElementById(`book-tab-${next}`)?.focus();
            }} key={tab}>{controls[tab]}</button>)}
          </div>
          <div className="py-7" role="tabpanel" id="book-panel-description" aria-labelledby="book-tab-description" tabIndex={0} hidden={activeTab !== "description"}>
            <h2 className="text-xl font-semibold text-[var(--ink)]">{t.about}</h2>
            <p className="mt-4 max-w-[900px] whitespace-pre-line text-[15px] leading-8 text-[var(--muted)]">{description}</p>
          </div>
          <div className="py-7" role="tabpanel" id="book-panel-specifications" aria-labelledby="book-tab-specifications" tabIndex={0} hidden={activeTab !== "specifications"}>
            <h2 className="mb-4 text-xl font-semibold text-[var(--ink)]">{t.edition}</h2>
            <dl className="m-0 grid max-w-[1000px] grid-cols-2 gap-x-10 max-md:grid-cols-1">{details.map(([label, value]) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 border-b border-[var(--line)] py-3.5" key={label}><dt className="text-sm text-[var(--muted)]">{label}</dt><dd className="m-0 min-w-0 break-words text-right text-sm font-medium text-[var(--ink)]">{value}</dd></div>)}</dl>
          </div>
        </div>
      </section>

      {detailSections.length > 0 ? <section className={cx(container, "py-16 max-sm:py-11")}>
        <span className={eyebrow}>{detailLabels.sourceSections}</span>
        <div className="mt-7 grid gap-5">
          {detailSections.map((section, index) => <article className="rounded-2xl border border-[var(--line)] bg-[var(--white)] p-6" key={`${section.code ?? section.title}-${index}`}>
            <h2 className="font-display text-2xl font-normal">{section.title}</h2>
            {section.attributes.length > 0 ? <dl className="mt-4 grid grid-cols-2 gap-x-8 max-md:grid-cols-1">{section.attributes.map((attribute, attributeIndex) => <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 border-b border-[var(--line)] py-3" key={`${attribute.code ?? attribute.label}-${attributeIndex}`}><dt className="text-sm text-[var(--muted)]">{attribute.label}</dt><dd className="m-0 min-w-0 max-w-[320px] break-words text-right text-sm font-semibold">{attribute.value}</dd></div>)}</dl> : <p className="mt-4 whitespace-pre-line text-base leading-7 text-[var(--muted)]">{section.content}</p>}
          </article>)}
        </div>
      </section> : null}

      <section className="bg-[var(--paper)] py-12">
        <div className={cx(container, "grid grid-cols-3 gap-6 max-md:grid-cols-1")}>{t.flow.map(([title, text], index) => <div className="flex gap-4" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">0{index + 1}</span><div><h3 className="text-[14px] font-semibold">{title}</h3><p className="mt-1 text-sm leading-5 text-[var(--muted)]">{text}</p></div></div>)}</div>
      </section>

      {related.length > 0 ? <section className={cx(container, "py-16 max-sm:py-11")}>
        <div className="mb-8 flex items-end justify-between gap-5"><div><span className={eyebrow}>{t.related}</span><h2 className={cx(sectionTitle, "mt-2 text-[clamp(2.2rem,4vw,3.5rem)]")}>{t.continue}</h2></div><Link className="shrink-0 text-sm font-bold text-[var(--accent)] underline underline-offset-4" href={localized(locale, "/catalog")}>{t.all} →</Link></div>
        <div className="book-rail grid grid-cols-4 gap-x-6 gap-y-9 max-lg:grid-cols-2 max-sm:gap-x-3">{related.map((item) => <BookCard book={item} variant="compact" key={item.id} />)}</div>
      </section> : null}

      <div className="fixed inset-x-0 bottom-0 z-40 hidden items-center gap-3 border-t border-[var(--line)] bg-[var(--paper)]/95 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-5px_20px_rgba(31,40,34,.04)] backdrop-blur max-sm:flex">
        <strong className="shrink-0 text-[15px] font-bold">{formatAmd(book.price)}</strong>
        <button className="flex min-h-12 flex-1 items-center justify-between rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-white disabled:bg-[#d9ddd3]" type="button" disabled={unavailable} onClick={() => addToCart(book, quantity)}>{unavailable ? t.unavailableButton : t.add}<span>→</span></button>
      </div>
    </div>
  );
}
