import type { Book } from "../../lib/types";
import { accentClasses, coverSizeClasses, cx } from "./ui";

export function BookCover({
  book,
  size = "card",
}: {
  book: Book;
  size?: "mini" | "card" | "hero" | "detail";
}) {
  return (
    <div
      className={cx(
        "relative isolate flex shrink-0 flex-col justify-between overflow-hidden rounded-[3px_7px_7px_3px] border border-black/10 shadow-[-4px_5px_0_rgba(11,12,16,.12),0_18px_32px_rgba(11,12,16,.18)] before:absolute before:inset-y-0 before:left-0 before:w-2 before:border-r before:border-black/15 before:bg-white/10",
        accentClasses[book.accent],
        coverSizeClasses[size],
      )}
      aria-label={book.title}
      role="img"
    >
      <span className={cx("relative z-10 max-w-[80%] text-[7px] font-black uppercase tracking-[0.12em]", size === "mini" && "text-[4px]")}>{book.category}</span>
      <strong className={cx(
        "relative z-10 flex flex-col text-2xl font-black uppercase leading-[.88] tracking-[-.065em] max-sm:text-base",
        size === "hero" && "text-3xl",
        size === "detail" && "text-[38px] max-sm:text-3xl",
        size === "mini" && "text-[10px]",
      )}>
        {book.coverLabel.split("\n").map((line) => <span key={line}>{line}</span>)}
      </strong>
      <small className={cx("relative z-10 text-[9px] font-bold", size === "detail" && "text-xs", size === "mini" && "text-[5px]")}>{book.author}</small>
      <i className="absolute -right-[12%] top-[35%] -z-0 h-[42%] w-[72%] rotate-[-12deg] border border-current opacity-20" />
      <i className="absolute -right-[20%] top-[46%] z-0 h-3 w-[90%] rotate-[-12deg] bg-current opacity-15" />
    </div>
  );
}
