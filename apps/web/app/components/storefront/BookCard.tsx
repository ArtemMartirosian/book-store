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
  const { addToCart, locale, toggleFavorite, isFavorite } = useStorefront();
  const favorite = isFavorite(book.id);
  const t = dictionary[locale].card;
  const unavailable = book.availability === "unavailable";
  const href = localized(locale, "/books/" + book.slug);
  const category = localizeBookCategory(locale, book.category);
  const binding = book.binding ? localizeBookBinding(locale, book.binding) : null;
  const editionMeta = [binding, book.year ? String(book.year) : null, !binding && !book.year ? book.language : null].filter(Boolean).join(" · ");
  const badge = book.badge ? localizeBookBadge(locale, book.badge) : unavailable ? t.unavailable : t.confirm;

  return (
    <article className="group relative flex min-w-0 flex-col rounded-[24px] border border-transparent p-2 transition duration-300 hover:border-[#e3e3ee] hover:bg-white hover:shadow-[0_24px_70px_rgba(39,42,72,.1)] max-sm:p-1.5">
      <Link
        href={href}
        className={cx(
          "relative flex items-center justify-center overflow-hidden rounded-[19px] bg-[#eceef6] p-5 transition duration-500 before:absolute before:inset-x-5 before:bottom-3 before:h-12 before:rounded-[50%] before:bg-[#7f8197]/15 before:blur-xl group-hover:bg-[#e8e6ff]",
          variant === "compact" ? "min-h-[300px] max-sm:min-h-[245px] max-sm:p-3" : "min-h-[365px] max-sm:min-h-[265px] max-sm:p-3",
        )}
      >
        <span className={cx("absolute left-3 top-3 z-20 max-w-[72%] rounded-full border border-white/70 bg-white/88 px-3 py-2 text-[7px] font-black uppercase tracking-[.08em] text-[#626575] shadow-sm backdrop-blur", unavailable && "bg-[#ffe8ec] text-[#b83d50]")}>{badge}</span>
        <span className="absolute bottom-3 right-3 z-20 grid size-9 place-items-center rounded-full bg-[#151722] text-sm text-white opacity-0 shadow-lg transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 max-sm:opacity-100">↗</span>
        <div className={cx("relative z-10 transition duration-500 group-hover:-translate-y-2 group-hover:scale-[1.035] group-hover:drop-shadow-[0_22px_18px_rgba(37,40,72,.2)]", variant === "compact" ? "scale-[.88] max-sm:scale-[.78]" : "scale-100 max-sm:scale-[.84]")}><BookCover book={book} /></div>
      </Link>

      <button
        type="button"
        className={cx("absolute right-5 top-5 z-30 grid size-9 place-items-center rounded-full border border-white/70 bg-white/90 text-lg text-[#626575] shadow-sm backdrop-blur transition hover:scale-105 hover:text-[#5147e2]", favorite && "border-[#6258ff] bg-[#6258ff] text-white hover:text-white")}
        onClick={() => toggleFavorite(book)}
        aria-label={favorite ? dictionary[locale].product.removeFavorite : dictionary[locale].product.favorite}
        aria-pressed={favorite}
      >
        {favorite ? "♥" : "♡"}
      </button>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-4">
        <div className="flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-[.07em] text-[#858897]">
          <span className="truncate">{category}</span>
          {book.rating !== undefined ? <span className="shrink-0 rounded-full bg-[#fff5dc] px-2 py-1 text-[#9a6500]">★ {book.rating}</span> : null}
        </div>
        <Link href={href} className={cx("mt-2 line-clamp-2 min-h-11 font-extrabold leading-[1.18] tracking-[-.035em] text-[#151722] transition hover:text-[#5147e2]", variant === "compact" ? "text-[16px] max-sm:text-[14px]" : "text-[18px] max-sm:text-[15px]")}>{book.title}</Link>
        <p className="mt-1.5 truncate text-[11px] text-[#747786]">{book.author}</p>
        <p className="mt-2 truncate text-[8px] font-bold uppercase tracking-[.07em] text-[#a0a2af]">{editionMeta}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <strong className="text-[17px] font-black tracking-[-.035em] text-[#151722]">{formatAmd(book.price)}</strong>
          <button
            type="button"
            disabled={unavailable}
            onClick={() => addToCart(book)}
            aria-label={t.add + ": " + book.title}
            className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#151722] px-3.5 text-[8px] font-black uppercase tracking-[.06em] text-white transition hover:-translate-y-0.5 hover:bg-[#6258ff] disabled:cursor-not-allowed disabled:bg-[#dedfe6] disabled:text-[#858897]"
          >
            <span className="max-sm:hidden">{unavailable ? t.unavailable : t.add}</span><b className="text-base leading-none">{unavailable ? "—" : "+"}</b>
          </button>
        </div>
      </div>
    </article>
  );
}
