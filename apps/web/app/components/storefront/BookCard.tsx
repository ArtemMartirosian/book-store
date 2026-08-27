"use client";

import Link from "next/link";
import type { Book } from "../../lib/types";
import { formatAmd } from "../../lib/catalog-data";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, localizeBookBadge, localizeBookBinding, localizeBookCategory } from "./i18n";
import { cx } from "./ui";

type BookCardProps = {
  book: Book;
  variant?: "default" | "compact";
};

export function BookCard({ book, variant = "default" }: BookCardProps) {
  const { addToCart, locale } = useStorefront();
  const t = dictionary[locale].card;
  const unavailable = book.availability === "unavailable";
  const href = localized(locale, `/books/${book.slug}`);
  const category = localizeBookCategory(locale, book.category);
  const binding = localizeBookBinding(locale, book.binding);
  const badge = book.badge ? localizeBookBadge(locale, book.badge) : unavailable ? t.unavailable : t.confirm;

  return (
    <article className="group flex min-w-0 flex-col">
      <Link
        href={href}
        className={cx(
          "relative flex items-center justify-center overflow-hidden rounded-[22px] border border-[#d9dde5] bg-[#e9ecf1] p-5 transition duration-300 group-hover:border-[#b9bfcb] group-hover:bg-[#e2e6ed]",
          variant === "compact" ? "min-h-[280px] max-sm:min-h-[225px] max-sm:p-3" : "min-h-[360px] max-sm:min-h-[250px] max-sm:p-3",
        )}
      >
        <span className={cx("absolute left-3 top-3 z-20 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-[7px] font-black uppercase tracking-[.06em]", unavailable && "bg-[#ffe7e1] text-[#9a3529]")}>{badge}</span>
        <span className="absolute right-3 top-3 z-20 rounded-full bg-[#0b0c10] px-2.5 py-1.5 text-[7px] font-black text-white">{book.language}</span>
        <div className={cx("transition duration-300 group-hover:-translate-y-1.5 group-hover:drop-shadow-[0_20px_18px_rgba(11,12,16,.2)]", variant === "compact" ? "scale-[.84] max-sm:scale-[.73]" : "scale-100 max-sm:scale-[.8]")}><BookCover book={book} /></div>
      </Link>

      <div className="flex flex-1 flex-col px-1 pt-3">
        <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-[#6d727c]"><span className="truncate">{category}</span><span className="shrink-0 text-[#6558ff]">★ {book.rating}</span></div>
        <Link href={href} className={cx("mt-2 line-clamp-2 min-h-11 font-black leading-[1.14] tracking-[-.035em]", variant === "compact" ? "text-[16px] max-sm:text-[14px]" : "text-[18px] max-sm:text-[15px]")}>{book.title}</Link>
        <p className="mt-1 truncate text-[11px] font-medium text-[#6d727c]">{book.author}</p>
        <p className="mt-2 truncate text-[8px] font-bold uppercase tracking-[.04em] text-[#9297a0]">{binding} · {book.year}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <strong className="text-[16px] font-black tracking-[-.03em]">{formatAmd(book.price)}</strong>
          <button
            type="button"
            disabled={unavailable}
            onClick={() => addToCart(book)}
            aria-label={`${t.add}: ${book.title}`}
            className="grid size-11 shrink-0 place-items-center rounded-[13px] bg-[#2447ff] text-xl font-bold text-white transition hover:-translate-y-1 hover:bg-[#0b0c10] disabled:cursor-not-allowed disabled:bg-[#d9dde5] disabled:text-[10px] disabled:text-[#7c828d]"
          >
            {unavailable ? "—" : "+"}
          </button>
        </div>
      </div>
    </article>
  );
}
