import type { Book } from "../../lib/types";
import { accentClasses, coverSizeClasses, cx } from "./ui";

export function BookCover({
  book,
  size = "card",
}: {
  book: Book;
  size?: "mini" | "card" | "hero" | "detail";
}) {
  if (book.coverImageUrl) {
    return (
      <div
        className={cx(
          "relative isolate shrink-0 overflow-hidden rounded-[4px_10px_10px_4px] border border-black/8 bg-white shadow-[-5px_6px_0_rgba(46,48,72,.09),0_18px_34px_rgba(31,34,60,.18)]",
          coverSizeClasses[size],
        )}
      >
        {/* The crawler accepts only absolute HTTP(S) image URLs from a Books.am product page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={book.title}
          className="absolute inset-0 size-full object-contain"
          loading={size === "mini" || size === "card" ? "lazy" : "eager"}
          referrerPolicy="no-referrer"
          src={book.coverImageUrl}
        />
      </div>
    );
  }

  return (
    <div
      className={cx(
        "relative isolate flex shrink-0 flex-col justify-between overflow-hidden rounded-[4px_10px_10px_4px] border border-black/8 shadow-[-5px_6px_0_rgba(46,48,72,.09),0_18px_34px_rgba(31,34,60,.18)] before:absolute before:inset-y-0 before:left-0 before:w-2 before:border-r before:border-black/12 before:bg-white/10",
        accentClasses[book.accent],
        coverSizeClasses[size],
      )}
      aria-label={book.title}
      role="img"
    >
      <span className={cx("relative z-10 max-w-[80%] text-[7px] font-bold uppercase tracking-[0.12em]", size === "mini" && "text-[4px]")}>{book.category}</span>
      <strong className={cx(
        "relative z-10 flex flex-col text-2xl font-bold uppercase leading-[.88] tracking-[-.065em] max-sm:text-base",
        size === "hero" && "text-3xl",
        size === "detail" && "text-[38px] max-sm:text-3xl",
        size === "mini" && "text-[10px]",
      )}>
        {book.coverLabel.split("\n").map((line) => <span key={line}>{line}</span>)}
      </strong>
      <small className={cx("relative z-10 text-[9px] font-medium", size === "detail" && "text-xs", size === "mini" && "text-[5px]")}>{book.author}</small>
      <i className="absolute -right-[12%] top-[35%] -z-0 h-[42%] w-[72%] rotate-[-12deg] border border-current opacity-20" />
      <i className="absolute -right-[20%] top-[46%] z-0 h-3 w-[90%] rotate-[-12deg] bg-current opacity-15" />
    </div>
  );
}
