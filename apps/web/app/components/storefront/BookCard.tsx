"use client";

import Link from "next/link";
import type { Book } from "../../lib/types";
import { formatAmd } from "../../lib/catalog-data";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized } from "./i18n";
import { cx } from "./ui";

type BookCardProps = {
  book: Book;
  variant?: "default" | "compact";
};

export function BookCard({ book, variant = "default" }: BookCardProps) {
  const { addToCart, locale, toggleFavorite, isFavorite } = useStorefront();
  const favorite = isFavorite(book.id);
  const t = dictionary[locale].card;
  const unavailable = book.availability === "unavailable";
  const href = localized(locale, "/books/" + book.slug);

  return (
    <article className="group relative flex min-w-0 flex-col">
      <Link
        href={href}
        className={cx(
          "relative flex items-center justify-center overflow-hidden rounded-2xl bg-[#eeeee7] px-5 py-7 transition duration-500 group-hover:bg-[#e8ebe2] max-sm:rounded-xl max-sm:px-1 max-sm:py-5",
          variant === "compact" ? "min-h-[292px] max-sm:min-h-[226px]" : "min-h-[318px] max-sm:min-h-[226px]",
        )}
      >
        <div className="relative z-10 transition duration-500 group-hover:-translate-y-1.5 group-hover:rotate-[-2deg]"><BookCover book={book} /></div>
      </Link>

      <button
        type="button"
        className={cx("absolute right-2.5 top-2.5 z-20 grid size-11 place-items-center rounded-full shadow-[0_2px_10px_rgba(32,44,40,.04)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#243e35]", favorite ? "bg-[#243e35] text-white hover:bg-[#304e41] hover:text-white" : "bg-[#fbfaf7]/95 text-[#526257] hover:bg-white hover:text-[#243e35]")}
        onClick={() => toggleFavorite(book)}
        aria-label={favorite ? dictionary[locale].product.removeFavorite : dictionary[locale].product.favorite}
        aria-pressed={favorite}
      >
        <svg className="size-[19px]" viewBox="0 0 24 24" fill={favorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m12 20-7.6-7.4A4.7 4.7 0 0 1 11 5.9L12 7l1-1.1a4.7 4.7 0 0 1 6.6 6.7Z" /></svg>
      </button>

      <div className="flex flex-1 flex-col px-0.5 pb-1 pt-4">
        <div className="mb-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-[#626e64]">
          <span>{book.language}</span>
          {unavailable && <span className="text-[#995846]">· {t.unavailable}</span>}
        </div>
        <Link href={href} className={cx("font-display line-clamp-2 min-h-[2.5em] font-medium leading-[1.25] tracking-[-.02em] text-[#202c28] transition hover:text-[#526e59]", variant === "compact" ? "text-[21px] max-sm:text-[19px]" : "text-[23px] max-sm:text-[19px]")}>{book.title}</Link>
        <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[#626e64]">{book.author}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          <strong className="text-base font-semibold tracking-[-.025em] text-[#202c28]">{formatAmd(book.price)}</strong>
          <button
            type="button"
            disabled={unavailable}
            onClick={() => addToCart(book)}
            aria-label={(unavailable ? t.unavailable : t.add) + ": " + book.title}
            className="flex size-11 min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-[#d5ddd2] bg-transparent text-[#243e35] transition hover:border-[#243e35] hover:bg-[#243e35] hover:text-white disabled:cursor-not-allowed disabled:border-[#dedfd5] disabled:text-[#aaafa5]"
          >
            {unavailable ? <span aria-hidden="true">—</span> : <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 8h14l1 12H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M9 14h6M12 11v6"/></svg>}
          </button>
        </div>
      </div>
    </article>
  );
}
