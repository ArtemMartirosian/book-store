"use client";

import Link from "next/link";
import type { Book } from "../../lib/types";
import { formatAmd } from "../../lib/catalog-data";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized } from "./i18n";
import { cx } from "./ui";

type BookCardProps = { book: Book; variant?: "default" | "compact" };

export function BookCard({ book, variant = "default" }: BookCardProps) {
  const { addToCart, locale, toggleFavorite, isFavorite } = useStorefront();
  const favorite = isFavorite(book.id);
  const t = dictionary[locale].card;
  const unavailable = book.availability === "unavailable";
  const href = localized(locale, "/books/" + encodeURIComponent(book.slug));

  return (
    <article className="group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white transition duration-300 hover:border-[var(--accent)]/30 hover:shadow-[0_12px_32px_rgba(61,52,120,.07)]">
      <Link href={href} className={cx(
        "relative flex min-w-0 items-center justify-center overflow-hidden bg-[var(--paper)] px-4 py-7 max-sm:px-2 max-sm:py-5",
        variant === "compact" ? "min-h-[288px] max-sm:min-h-[224px]" : "min-h-[304px] max-sm:min-h-[224px]",
      )}>
        <div className="relative z-10 min-w-0 max-w-full transition duration-300 group-hover:-translate-y-1"><BookCover book={book} /></div>
      </Link>
      {book.isNew === true ? <span className="pointer-events-none absolute left-3 top-3 z-20 max-w-[calc(100%-4.25rem)] rounded-md bg-white/95 px-2 py-1.5 text-[10px] font-semibold text-[var(--accent)] shadow-sm">{dictionary[locale].header.new}</span> : null}
      <button
        type="button"
        className={cx("absolute right-2.5 top-2.5 z-20 grid size-11 place-items-center rounded-xl transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]", favorite ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)]" : "bg-white/95 text-[var(--muted)] shadow-sm hover:text-[var(--accent)]")}
        onClick={() => toggleFavorite(book)}
        aria-label={favorite ? dictionary[locale].product.removeFavorite : dictionary[locale].product.favorite}
        aria-pressed={favorite}
      >
        <svg className="size-[19px]" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 20-7.6-7.4A4.7 4.7 0 0 1 11 5.9L12 7l1-1.1a4.7 4.7 0 0 1 6.6 6.7Z" /></svg>
      </button>

      <div className="flex flex-1 flex-col p-4 max-sm:p-3">
        <div className="mb-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-[var(--muted)]">
          <span>{book.language}</span>
          {unavailable ? <span className="text-[#b45359]">· {t.unavailable}</span> : null}
        </div>
        <Link href={href} className="line-clamp-2 min-h-[2.8em] text-[16px] font-semibold leading-[1.4] tracking-[-.015em] text-[var(--ink)] transition hover:text-[var(--accent)] max-sm:text-[14px]">{book.title}</Link>
        <p className="mt-1.5 line-clamp-2 min-h-5 text-xs leading-5 text-[var(--muted)]">{book.author}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <strong className="text-[17px] font-bold tracking-[-.025em] text-[var(--ink)] max-sm:text-[15px]">{formatAmd(book.price)}</strong>
          <button
            type="button"
            disabled={unavailable}
            onClick={() => addToCart(book)}
            aria-label={(unavailable ? t.unavailable : t.add) + ": " + book.title}
            className="flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)]/8 text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:bg-[var(--paper)] disabled:text-[var(--muted)]"
          >
            {unavailable ? <span aria-hidden="true">—</span> : <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h6M12 11v6"/></svg>}
          </button>
        </div>
      </div>
    </article>
  );
}
