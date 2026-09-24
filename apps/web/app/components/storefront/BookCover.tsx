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
          "relative isolate shrink-0 overflow-hidden rounded-[2px_5px_5px_2px] bg-white shadow-[-3px_3px_0_rgba(63,67,48,.1),0_12px_22px_rgba(37,45,32,.16)]",
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
        <span className="pointer-events-none absolute inset-y-0 left-0 w-[5px] bg-gradient-to-r from-black/12 to-transparent" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div
      className={cx(
        "relative isolate flex shrink-0 flex-col justify-between overflow-hidden [container-type:inline-size] rounded-[2px_5px_5px_2px] shadow-[-3px_3px_0_rgba(63,67,48,.1),0_12px_22px_rgba(37,45,32,.16)] before:absolute before:inset-y-0 before:left-0 before:w-1.5 before:border-r before:border-black/10 before:bg-black/5",
        accentClasses[book.accent],
        coverSizeClasses[size],
      )}
      aria-label={book.title}
      role="img"
    >
      <span className={cx("relative z-10 max-w-[90%] [overflow-wrap:anywhere] text-[8px] font-medium uppercase tracking-[0.13em]", size === "mini" && "text-[5px]")}>{book.category}</span>
      <strong className={cx(
        "font-display relative z-10 flex min-w-0 max-w-full flex-col [overflow-wrap:anywhere] text-[clamp(15px,20cqw,23px)] font-medium leading-[1.08] tracking-[-.025em]",
        size === "hero" && "text-[clamp(17px,19cqw,30px)]",
        size === "detail" && "text-[clamp(25px,15cqw,36px)]",
        size === "mini" && "text-[clamp(9px,21cqw,12px)]",
      )}>
        {book.coverLabel.split("\n").map((line) => <span className="min-w-0 max-w-full" key={line}>{line}</span>)}
      </strong>
      <small className={cx("relative z-10 [overflow-wrap:anywhere] text-[10px] font-medium", size === "detail" && "text-xs", size === "mini" && "text-[6px]")}>{book.author}</small>
      <i className="absolute -right-[25%] top-[25%] size-[90%] rounded-full border border-current opacity-20" />
      <i className="absolute -right-[37%] top-[34%] size-[90%] rounded-full border border-current opacity-15" />
    </div>
  );
}
