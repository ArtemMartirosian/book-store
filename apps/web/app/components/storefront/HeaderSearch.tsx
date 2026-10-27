"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { catalogQueryString, isCatalogApiResponse, mapCatalogBook, publicApiBase } from "../../lib/catalog-api";
import { formatAmd } from "../../lib/catalog-data";
import type { Book, CatalogCategory } from "../../lib/types";
import { BookCover } from "./BookCover";
import { dictionary, localized, type Locale } from "./i18n";
import { cx } from "./ui";

type SearchResult = { key: string; status: "ready" | "error"; books: Book[] };

function SearchIcon({ className = "size-5" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>;
}

export function HeaderSearch({ locale, categories = [], mobile = false, suspended = false, onNavigate }: {
  locale: Locale;
  categories?: CatalogCategory[];
  mobile?: boolean;
  suspended?: boolean;
  onNavigate?: () => void;
}) {
  const t = dictionary[locale].header;
  const id = useId();
  const listId = `${id}-suggestions`;
  const formRef = useRef<HTMLFormElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const composingRef = useRef(false);
  const [value, setValue] = useState("");
  const [category, setCategory] = useState("");
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value.trim();
  const key = JSON.stringify([locale, category, query]);
  const open = focused && !dismissed && !suspended && !composing && query.length > 0;
  const current = result?.key === key ? result : null;
  const books = current?.status === "ready" ? current.books : [];
  const loading = open && !current;
  const searchParams = new URLSearchParams({ q: query });
  if (category) searchParams.set("category", category);
  const allResultsHref = `${localized(locale, "/catalog")}?${searchParams.toString()}`;

  const cancelRequest = useCallback(() => {
    generation.current += 1;
    request.current?.abort();
    request.current = null;
  }, []);
  const dismiss = useCallback(() => {
    cancelRequest();
    setDismissed(true);
    setActiveIndex(-1);
  }, [cancelRequest]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    request.current = controller;
    const version = ++generation.current;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${publicApiBase}/catalog/books?${catalogQueryString({ locale, q: query, category: category || undefined, offset: 0, limit: 5 })}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Search unavailable");
        const body: unknown = await response.json();
        if (!live || controller.signal.aborted || generation.current !== version) return;
        if (!isCatalogApiResponse(body)) throw new Error("Invalid search response");
        const seen = new Set<string>();
        const matches = body.items.filter((book) => {
          if (typeof book.id !== "string" || !book.id || seen.has(book.id) || typeof book.slug !== "string" || !book.slug.trim() || typeof book.title !== "string" || !book.title.trim() || typeof book.author !== "string" || !Number.isFinite(book.price.amount) || book.price.amount < 0 || !["hy", "ru", "en"].includes(book.locale) || !["hy", "ru", "en"].includes(book.language)) return false;
          seen.add(book.id);
          return true;
        }).slice(0, 5).map(mapCatalogBook);
        const next: SearchResult = { key, status: "ready", books: matches };
        setResult(next);
      } catch {
        if (live && !controller.signal.aborted && generation.current === version) {
          setResult({ key, status: "error", books: [] });
        }
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
      if (request.current === controller) request.current = null;
    };
  }, [open, key, locale, query, category, value]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !formRef.current?.contains(event.target)) { dismiss(); setFocused(false); }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, dismiss]);

  useEffect(() => {
    const popup = popupRef.current;
    if (!open || !popup || !window.innerHeight) return;
    const viewport = window.visualViewport;
    const fit = () => {
      const viewportTop = viewport?.offsetTop ?? 0;
      let bottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const navigation = mobile ? document.querySelector<HTMLElement>('[data-testid="mobile-bottom-navigation"]')?.getBoundingClientRect() : null;
      if (navigation && navigation.height > 0 && navigation.top < bottom && navigation.bottom > viewportTop) bottom = Math.min(bottom, navigation.top);
      const available = Math.max(0, bottom - popup.getBoundingClientRect().top - 8);
      popup.style.setProperty("--header-search-space", `${available}px`);
      // When a keyboard leaves very little room, prioritize the actual books.
      popup.dataset.searchCompact = String(available < 180);
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("scroll", fit, { passive: true });
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("scroll", fit);
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
    };
  }, [open, mobile]);

  const activate = (index: number) => {
    setActiveIndex(index);
    formRef.current?.querySelector<HTMLAnchorElement>(`[data-search-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && query) {
      onNavigate?.();
      setFocused(true);
      setDismissed(false);
      if (!books.length) return;
      event.preventDefault();
      activate(event.key === "ArrowDown" ? (activeIndex + 1) % books.length : (activeIndex <= 0 ? books.length : activeIndex) - 1);
    } else if (event.key === "Enter" && open && activeIndex >= 0 && books[activeIndex]) {
      event.preventDefault();
      formRef.current?.querySelector<HTMLAnchorElement>(`[data-search-index="${activeIndex}"]`)?.click();
    }
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    if (composingRef.current || (!query && !category)) { event.preventDefault(); return; }
    dismiss();
    onNavigate?.();
  };

  return (
    <form ref={formRef} data-testid={mobile ? "mobile-header-search" : "desktop-header-search"} role="search" aria-label={t.searchButton} method="get" action={localized(locale, "/catalog")} onSubmit={submit}
      className={cx("storefront-header-search relative focus-within:z-[60]", mobile
        ? "flex h-14 items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--paper)] p-1 transition focus-within:border-[var(--accent)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--accent)]/10"
        : "mx-auto hidden h-12 min-w-[180px] max-w-[610px] flex-1 items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] pl-4 pr-1 transition focus-within:border-[var(--accent)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--accent)]/10 md:flex")}
      onFocusCapture={() => onNavigate?.()}
      onBlurCapture={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) { dismiss(); setFocused(false); } }}>
      {!mobile && categories.length > 0 ? <select className="mr-3 hidden h-11 max-w-[135px] border-r border-[var(--line)] bg-transparent pr-3 text-xs text-[var(--muted)] outline-none focus-visible:text-[var(--accent)] 2xl:block" name="category" value={category} onChange={(event) => { cancelRequest(); setCategory(event.target.value); setActiveIndex(-1); setDismissed(false); }} aria-label={t.allCategories}><option value="">{t.allCategories}</option>{categories.map((item) => <option key={item.id} value={item.supplierCategoryId}>{item.name}</option>)}</select> : null}
      {!mobile ? <SearchIcon className="mr-3 size-[18px] shrink-0 text-[var(--muted)]" /> : null}
      <input className={mobile ? "h-11 min-w-0 flex-1 bg-transparent pl-3 pr-1 text-base leading-6 text-[var(--ink)] outline-none placeholder:text-[var(--muted)]" : "min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"}
        type="search" role="combobox" enterKeyHint="search" name="q" value={value} maxLength={120} autoComplete="off" spellCheck={false} placeholder={mobile ? t.mobileSearch : t.search} aria-label={t.search}
        aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-activedescendant={open && books[activeIndex] ? `${id}-book-${activeIndex}` : undefined}
        onFocus={() => { setFocused(true); setDismissed(false); }} onClick={() => { setFocused(true); setDismissed(false); }} onKeyDown={onKeyDown}
        onChange={(event) => { if (event.target.value !== value) cancelRequest(); setValue(event.target.value); setFocused(true); setActiveIndex(-1); setDismissed(false); onNavigate?.(); }}
        onCompositionStart={() => { cancelRequest(); composingRef.current = true; setComposing(true); setActiveIndex(-1); }}
        onCompositionEnd={(event) => { cancelRequest(); composingRef.current = false; setComposing(false); setValue(event.currentTarget.value); setFocused(true); setDismissed(false); }} />
      <button className={mobile ? "grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--accent)] text-white transition hover:bg-[var(--accent-deep)] active:scale-95" : "h-11 rounded-lg bg-[var(--accent)] px-5 text-xs font-semibold text-white transition hover:bg-[var(--accent-deep)]"} type="submit" aria-label={mobile ? t.searchButton : undefined}>{mobile ? <SearchIcon /> : t.searchButton}</button>
      {open ? <div ref={popupRef} data-testid="header-search-suggestions" className="group/search absolute inset-x-0 top-full z-[70] mt-2 flex max-h-[min(540px,var(--header-search-space,calc(100dvh-260px)))] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-[0_18px_50px_rgba(37,29,87,.16)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-4 py-3 group-data-[search-compact=true]/search:hidden"><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{t.searchSuggestions}</span><span className="text-[10px] text-[var(--muted)]">{t.searchButton} ↵</span></div>
        <div className="max-h-[430px] min-h-0 overflow-y-auto overscroll-contain p-1.5 group-data-[search-compact=true]/search:py-0">
          <ul id={listId} role="listbox" aria-label={t.searchSuggestions} aria-busy={loading} className="grid gap-0.5">
            {books.map((book, index) => <li key={book.id} role="presentation"><Link id={`${id}-book-${index}`} data-search-index={index} role="option" aria-selected={activeIndex === index} tabIndex={-1} prefetch={false} href={localized(locale, "/books/" + encodeURIComponent(book.slug))}
              className={cx("flex min-h-[80px] items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition", activeIndex === index ? "bg-[var(--paper)]" : "hover:bg-[var(--paper)]")}
              onPointerEnter={() => setActiveIndex(index)} onMouseDown={(event) => event.preventDefault()} onClick={() => { dismiss(); onNavigate?.(); }}>
              <div aria-hidden="true" className="shrink-0"><BookCover book={book} size="search" /></div>
              <div className="min-w-0 flex-1"><span className="line-clamp-2 break-words text-[13px] font-semibold leading-[1.4] text-[var(--ink)]">{book.title}</span>{book.author ? <span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{book.author}</span> : null}<strong className="mt-1 block text-xs font-bold text-[var(--accent)]">{formatAmd(book.price)}</strong></div>
              <span aria-hidden="true" className="shrink-0 text-sm text-[var(--accent)]/60">↗</span>
            </Link></li>)}
          </ul>
          <p role="status" aria-live="polite" className={books.length ? "sr-only" : "px-4 py-6 text-center text-sm text-[var(--muted)]"}>{loading ? t.searchLoading : current?.status === "error" ? t.searchError : books.length ? `${t.searchSuggestions}: ${books.length}` : t.searchEmpty}</p>
        </div>
        <Link className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--paper)]/60 px-4 py-3 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--paper)] group-data-[search-compact=true]/search:hidden" prefetch={false} href={allResultsHref} onMouseDown={(event) => event.preventDefault()} onClick={() => { dismiss(); onNavigate?.(); }}>{t.searchAll}<span aria-hidden="true">→</span></Link>
      </div> : null}
    </form>
  );
}
