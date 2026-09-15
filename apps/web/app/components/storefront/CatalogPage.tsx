"use client";

import { useEffect, useMemo, useState } from "react";
import {
  catalogQueryString,
  isCatalogCategoriesResponse,
  isCatalogApiResponse,
  mapCatalogBook,
  publicApiBase,
  type CatalogLanguage,
  type CatalogSort,
} from "../../lib/catalog-api";
import { catalogLanguageDefinitions } from "../../lib/catalog-data";
import type { Book, CatalogCategory } from "../../lib/types";
import { BookCard } from "./BookCard";
import { useStorefront } from "./StorefrontShell";
import { dictionary } from "./i18n";
import { container, cx } from "./ui";

const allValue = "all";
const pageSize = 24;
const supportedSorts: CatalogSort[] = ["popular", "new", "price-asc", "price-desc", "title"];
const languageCodes = new Set<CatalogLanguage>(["hy", "ru", "en"]);

const statusCopy = {
  ru: { loading: "Загружаем книги…", error: "Не удалось загрузить каталог.", retry: "Повторить", previous: "Назад", next: "Далее", page: "Страница", sections: "Разделы", allSections: "Все разделы" },
  hy: { loading: "Բեռնում ենք գրքերը…", error: "Չհաջողվեց բեռնել կատալոգը։", retry: "Կրկնել", previous: "Հետ", next: "Հաջորդը", page: "Էջ", sections: "Բաժիններ", allSections: "Բոլոր բաժինները" },
  en: { loading: "Loading books…", error: "Could not load the catalog.", retry: "Retry", previous: "Previous", next: "Next", page: "Page", sections: "Departments", allSections: "All departments" },
} as const;

export function CatalogPage() {
  const { locale } = useStorefront();
  const t = dictionary[locale].catalog;
  const status = statusCopy[locale];
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<CatalogLanguage | typeof allValue>(allValue);
  const [category, setCategory] = useState<string>(allValue);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [sort, setSort] = useState<CatalogSort>("new");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const incomingLanguage = params.get("language") as CatalogLanguage | null;
      const incomingCategory = params.get("category");
      const incomingSort = params.get("sort") as CatalogSort | null;
      const incomingPage = Number(params.get("page"));
      setQuery(params.get("q") ?? "");
      if (incomingLanguage && languageCodes.has(incomingLanguage)) setLanguage(incomingLanguage);
      if (incomingCategory && /^\d+$/u.test(incomingCategory)) setCategory(incomingCategory);
      if (incomingSort && supportedSorts.includes(incomingSort)) setSort(incomingSort);
      if (params.get("available") === "all") setAvailableOnly(false);
      if (Number.isSafeInteger(incomingPage) && incomingPage > 0) setPage(incomingPage);
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${publicApiBase}/catalog/categories?locale=${locale}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (isCatalogCategoriesResponse(body)) setCategories(body);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [locale]);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (language !== allValue) params.set("language", language);
    if (category !== allValue) params.set("category", category);
    if (sort !== "new") params.set("sort", sort);
    if (!availableOnly) params.set("available", "all");
    if (page > 1) params.set("page", String(page));
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [availableOnly, category, initialized, language, page, query, sort]);

  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const search = catalogQueryString({
          locale,
          q: query,
          language: language === allValue ? undefined : language,
          category: category === allValue ? undefined : category,
          available: availableOnly ? true : undefined,
          sort,
          offset: (page - 1) * pageSize,
          limit: pageSize,
        });
        const response = await fetch(`${publicApiBase}/catalog/books?${search}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body: unknown = await response.json();
        if (!isCatalogApiResponse(body)) throw new Error("Invalid catalog response");
        setItems(body.items.map(mapCatalogBook));
        setTotal(body.total);
        const lastPage = Math.max(1, Math.ceil(body.total / pageSize));
        if (page > lastPage) setPage(lastPage);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query.trim() ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [availableOnly, category, initialized, language, locale, page, query, reload, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visiblePages = useMemo(() => {
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    return Array.from({ length: Math.min(3, totalPages) }, (_, index) => start + index);
  }, [page, totalPages]);

  const changeQuery = (value: string) => { setQuery(value); setPage(1); };
  const changeLanguage = (value: CatalogLanguage | typeof allValue) => { setLanguage(value); setPage(1); };
  const changeCategory = (value: string) => { setCategory(value); setPage(1); };
  const changeSort = (value: CatalogSort) => { setSort(value); setPage(1); };
  const toggleAvailability = () => { setAvailableOnly((value) => !value); setPage(1); };
  const clearFilters = () => { setQuery(""); setLanguage(allValue); setCategory(allValue); setAvailableOnly(true); setPage(1); };
  const languageLabel = (value: CatalogLanguage | typeof allValue) =>
    value === allValue ? t.allLanguages : catalogLanguageDefinitions.find((item) => item.slug === value)?.value ?? value;
  const categoryLabel = category === allValue ? status.allSections : categories.find((item) => item.supplierCategoryId === category)?.name ?? category;
  const activeFilters = [query ? `${t.searchChip}: ${query}` : "", language !== allValue ? languageLabel(language) : "", category !== allValue ? categoryLabel : ""].filter(Boolean);

  return (
    <div className="min-h-[70vh] bg-[#f5f6fb]">
      <section className="lumi-grid bg-[#151722] text-white">
        <div className={cx(container, "grid grid-cols-[minmax(0,1fr)_minmax(320px,460px)] items-end gap-12 py-16 max-lg:grid-cols-1 max-lg:gap-7 max-sm:py-10")}>
          <div>
            <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-[.14em] text-[#d9ff69]"><span>LUMI</span><span>/</span><span>{t.overline}</span></div>
            <h1 className="mt-5 text-[clamp(3.2rem,6vw,6.2rem)] font-black leading-[.86] tracking-[-.08em]">{t.title} <em className="block pt-2 not-italic text-[#8d85ff]">{t.accent}</em></h1>
            <p className="mt-6 max-w-[650px] text-[12px] leading-6 text-white/55">{t.intro}</p>
            <small className="mt-2 block text-[8px] text-white/30">{t.fallback}</small>
          </div>
          <form className="flex h-14 items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 backdrop-blur focus-within:border-[#8d85ff] focus-within:bg-white/12" onSubmit={(event) => event.preventDefault()}>
            <span className="text-xl text-white/45" aria-hidden="true">⌕</span>
            <input className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-white/38" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
            {query && <button className="grid size-9 place-items-center rounded-xl bg-white/10 text-base" type="button" onClick={() => changeQuery("")} aria-label={t.clearSearch}>×</button>}
          </form>
        </div>
        <div className={cx(container, "book-rail flex items-center gap-2 overflow-x-auto pb-7")}>
          <button className={cx("shrink-0 rounded-full border px-4 py-2.5 text-[8px] font-black uppercase tracking-[.06em] transition", language === allValue ? "border-[#d9ff69] bg-[#d9ff69] text-[#151722]" : "border-white/15 bg-white/5 text-white/60 hover:border-white/40")} type="button" onClick={() => changeLanguage(allValue)}>{t.allCategories}</button>
          {catalogLanguageDefinitions.map((item) => <button className={cx("shrink-0 rounded-full border px-4 py-2.5 text-[8px] font-black uppercase tracking-[.06em] transition", language === item.slug ? "border-[#8d85ff] bg-[#8d85ff] text-white" : "border-white/15 bg-white/5 text-white/60 hover:border-white/40")} type="button" onClick={() => changeLanguage(item.slug)} key={item.slug}>{item.value}</button>)}
        </div>
      </section>

      <div className="border-b border-[#e2e4ed] bg-white">
        <div className={cx(container, "grid min-h-[76px] grid-cols-[270px_1fr_auto] items-center gap-8 max-md:grid-cols-[1fr_auto] max-md:gap-3")}>
          <button className="hidden min-h-11 items-center gap-2 rounded-xl border border-[#e0e2eb] bg-white px-4 text-[10px] font-black max-md:flex" onClick={() => setFiltersOpen(true)} type="button"><span aria-hidden="true">☷</span>{t.filters}{activeFilters.length > 0 && <b className="grid size-5 place-items-center rounded-full bg-[#6258ff] text-[8px] text-white">{activeFilters.length}</b>}</button>
          <p className="text-[10px] text-[#7c7f8d] max-md:hidden"><strong className="mr-2 text-[20px] font-black tracking-[-.04em] text-[#151722]">{total}</strong>{total === 1 ? t.countOne : t.countMany}</p>
          <label className="col-start-3 flex items-center text-[8px] font-black uppercase tracking-[.08em] text-[#858897] max-md:col-start-2 max-md:text-[0px]">{t.sort}<select className="ml-3 min-h-11 rounded-xl border border-[#e0e2eb] bg-[#f7f7fb] px-4 text-[9px] font-bold text-[#151722] outline-none focus:border-[#6258ff] max-md:ml-0" value={sort} onChange={(event) => changeSort(event.target.value as CatalogSort)}><option value="popular">{t.popular}</option><option value="new">{t.newest}</option><option value="price-asc">{t.cheaper}</option><option value="price-desc">{t.expensive}</option><option value="title">A–Z</option></select></label>
        </div>
      </div>

      <div className={cx(container, "grid grid-cols-[250px_minmax(0,1fr)] items-start gap-9 py-9 pb-20 max-md:grid-cols-1 max-md:gap-5")}>
        {filtersOpen && <button className="fixed inset-0 z-[60] hidden bg-[#1d2a23]/35 backdrop-blur-sm max-md:block" type="button" onClick={() => setFiltersOpen(false)} aria-label={t.filters} />}
        <aside className={cx("sticky top-28 rounded-[22px] border border-[#e2e4ed] bg-white p-5 shadow-[0_16px_45px_rgba(39,42,72,.06)] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-[70] max-md:max-h-[82vh] max-md:overflow-auto max-md:rounded-t-[24px] max-md:p-6 max-md:shadow-2xl", filtersOpen ? "max-md:block" : "max-md:hidden")}>
          <div className="flex items-center justify-between border-b border-[#cfcac0] pb-4"><strong className="font-display text-2xl font-semibold">{t.filters}</strong><button className="text-[9px] font-semibold text-[#a94728] underline underline-offset-4" type="button" onClick={clearFilters}>{t.reset}</button></div>
          <label className="grid gap-3 border-b border-[#dedbd2] py-5"><span className="text-[10px] font-bold uppercase tracking-[.08em]">{status.sections}</span><select className="min-h-11 w-full rounded-xl border border-[#e0e2eb] bg-[#f7f7fb] px-3 text-[10px] font-semibold outline-none focus:border-[#6258ff]" value={category} onChange={(event) => changeCategory(event.target.value)}><option value={allValue}>{status.allSections}</option>{categories.filter((item) => item.supplierCategoryId !== "7463").map((item) => <option value={item.supplierCategoryId} key={item.supplierCategoryId}>{item.name}</option>)}</select></label>
          <fieldset className="grid gap-3 border-0 border-b border-[#dedbd2] px-0 py-5"><legend className="mb-3 text-[10px] font-bold uppercase tracking-[.08em]">{t.language}</legend>{([allValue, ...catalogLanguageDefinitions.map((item) => item.slug)] as Array<CatalogLanguage | typeof allValue>).map((item) => <label className="flex min-h-8 cursor-pointer items-center gap-3 text-[11px] text-[#5f675f]" key={item}><input className="peer sr-only" type="radio" name="language" checked={language === item} onChange={() => changeLanguage(item)} /><span className="grid size-5 place-items-center rounded-full border border-[#aaa9a3] after:hidden after:size-2.5 after:rounded-full after:bg-[#c85f3a] after:content-[''] peer-checked:border-[#c85f3a] peer-checked:after:block" />{languageLabel(item)}</label>)}</fieldset>
          <div className="flex items-center justify-between border-b border-[#dedbd2] py-5"><div className="grid gap-1"><strong className="text-[11px] font-semibold">{t.available}</strong><small className="text-[9px] text-[#858b84]">{t.availableHint}</small></div><button className={cx("relative h-7 w-12 rounded-full bg-[#cacbc6] transition", availableOnly && "bg-[#466a55]")} type="button" onClick={toggleAvailability} aria-pressed={availableOnly}><i className={cx("absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition", availableOnly && "left-[24px]")} /></button></div>
          <button className="sticky bottom-0 mt-5 hidden min-h-12 w-full rounded-[9px] bg-[#c85f3a] text-[10px] font-bold uppercase text-white max-md:block" type="button" onClick={() => setFiltersOpen(false)}>{t.show} {total}</button>
        </aside>

        <section className="min-w-0" aria-live="polite" aria-busy={loading}>
          {activeFilters.length > 0 && <div className="book-rail mb-6 flex gap-2 overflow-x-auto">{activeFilters.map((filter) => <span className="whitespace-nowrap rounded-full border border-[#d8d4ca] bg-[#fffdf9] px-3 py-2 text-[9px] font-semibold" key={filter}>{filter}</span>)}<button className="whitespace-nowrap px-2 text-[9px] font-semibold text-[#a94728] underline underline-offset-4" type="button" onClick={clearFilters}>{t.clearAll} ×</button></div>}
          {loading && items.length === 0 ? <div className="grid min-h-[420px] place-items-center rounded-[26px] border border-[#e2e4ed] bg-white text-[12px] text-[#777d77] shadow-[0_16px_45px_rgba(39,42,72,.05)]">{status.loading}</div> : null}
          {error ? <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[18px] border border-[#ead1c8] bg-[#fffdf9] px-5 text-center"><h2 className="font-display text-3xl font-semibold">{status.error}</h2><p className="mt-2 text-[10px] text-[#9a6252]">{error}</p><button className="mt-5 text-[10px] font-bold text-[#a94728] underline underline-offset-4" type="button" onClick={() => setReload((value) => value + 1)}>{status.retry}</button></div> : null}
          {!error && items.length > 0 ? <div className={cx("grid grid-cols-3 gap-x-3 gap-y-8 transition max-xl:grid-cols-2 max-sm:gap-x-2 max-sm:gap-y-6", loading && "opacity-55")}>{items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div> : null}
          {!loading && !error && items.length === 0 ? <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[18px] border border-[#dedbd2] bg-[#fffdf9] px-5 text-center"><span className="text-4xl text-[#9ba099]">⌕</span><h2 className="font-display mt-5 text-3xl font-semibold">{t.nothing}</h2><p className="mt-2 text-[12px] text-[#777d77]">{t.nothingHint}</p><button className="mt-5 text-[10px] font-bold text-[#a94728] underline underline-offset-4" type="button" onClick={clearFilters}>{t.reset}</button></div> : null}
          {!error && totalPages > 1 ? <nav className="mt-12 flex items-center justify-center gap-2" aria-label={status.page}><button disabled={page === 1 || loading} type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-10 rounded-full border border-[#d8d4ca] bg-white px-4 text-[9px] font-bold disabled:opacity-40">← {status.previous}</button>{visiblePages.map((pageNumber) => <button aria-current={pageNumber === page ? "page" : undefined} className={cx("grid size-10 place-items-center rounded-full border border-[#d8d4ca] bg-white text-[10px] font-bold", pageNumber === page && "border-[#1d2a23] bg-[#1d2a23] text-white")} disabled={loading} key={pageNumber} onClick={() => setPage(pageNumber)} type="button">{pageNumber}</button>)}<button disabled={page === totalPages || loading} type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="min-h-10 rounded-full border border-[#d8d4ca] bg-white px-4 text-[9px] font-bold disabled:opacity-40">{status.next} →</button></nav> : null}
        </section>
      </div>
    </div>
  );
}
