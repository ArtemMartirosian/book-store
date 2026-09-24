"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { catalogStateSearch, defaultCatalogState, parseCatalogState, updateCatalogSearch, type CatalogState } from "../../lib/storefront-state";
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
// Next integrates native history updates with useSearchParams, including back/forward.
function updateLocation(patch: Partial<CatalogState>, replace = false) {
  const search = updateCatalogSearch(window.location.search, patch);
  const href = window.location.pathname + (search ? "?" + search : "");
  if (href === window.location.pathname + window.location.search) return;
  if (replace) window.history.replaceState(null, "", href);
  else window.history.pushState(null, "", href);
}

function CatalogSearchInput({ query, onChange, label }: { query: string; onChange: (value: string) => void; label: string }) {
  // Typing stays urgent while Next applies native history updates in a transition.
  const [draft, setDraft] = useState(query);
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) { setLastQuery(query); setDraft(query); }
  return <input className="min-w-0 flex-1 bg-transparent text-sm text-[#18192d] outline-none placeholder:text-[#727789]" maxLength={120} value={draft} onChange={(event) => { setDraft(event.target.value); onChange(event.target.value); }} placeholder={label} aria-label={label} />;
}

const facetCopy = {
  ru: { author: "Автор", publisher: "Издательство", series: "Серия", price: "Цена, ֏", from: "От", to: "До", apply: "Уточнить поиск", invalidRange: "Цена «до» должна быть не меньше цены «от».", cover: "С изображением обложки", newOnly: "Только новинки", recommendation: "Рекомендуемые", updated: "Обновления каталога" },
  hy: { author: "Հեղինակ", publisher: "Հրատարակչություն", series: "Մատենաշար", price: "Գին, ֏", from: "Սկսած", to: "Մինչև", apply: "Կիրառել", invalidRange: "Առավելագույն գինը չի կարող նվազագույնից փոքր լինել։", cover: "Շապիկի պատկերով", newOnly: "Միայն նորույթներ", recommendation: "Առաջարկվող", updated: "Կատալոգի թարմացումներ" },
  en: { author: "Author", publisher: "Publisher", series: "Series", price: "Price, ֏", from: "From", to: "To", apply: "Refine search", invalidRange: "Maximum price must not be less than minimum price.", cover: "With cover image", newOnly: "New arrivals only", recommendation: "Recommended", updated: "Catalog updates" },
} as const;

const statusCopy = {
  ru: { loading: "Загружаем книги…", error: "Не удалось загрузить каталог.", errorHint: "Попробуйте ещё раз через некоторое время.", retry: "Повторить", previous: "Назад", next: "Далее", page: "Страница", sections: "Разделы", allSections: "Все разделы" },
  hy: { loading: "Բեռնում ենք գրքերը…", error: "Չհաջողվեց բեռնել կատալոգը։", errorHint: "Խնդրում ենք մի փոքր ուշ կրկին փորձել։", retry: "Կրկնել", previous: "Հետ", next: "Հաջորդը", page: "Էջ", sections: "Բաժիններ", allSections: "Բոլոր բաժինները" },
  en: { loading: "Loading books…", error: "Could not load the catalog.", errorHint: "Please try again in a moment.", retry: "Retry", previous: "Previous", next: "Next", page: "Page", sections: "Departments", allSections: "All departments" },
} as const;

type CatalogPageProps = {
  initialData?: { items: Book[]; total: number };
  initialCategories?: CatalogCategory[];
};

export function CatalogPage({ initialData, initialCategories = [] }: CatalogPageProps = {}) {
  const { locale } = useStorefront();
  const t = dictionary[locale].catalog;
  const status = statusCopy[locale];
  const facets = facetCopy[locale];
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { query, author, publisher, series, minPrice, maxPrice, hasCover, isNew, language, category, sort, availableOnly, page } = parseCatalogState(searchParams.toString());
  const [categories, setCategories] = useState<CatalogCategory[]>(initialCategories);
  const [items, setItems] = useState<Book[]>(initialData?.items ?? []);
  const [total, setTotal] = useState(initialData?.total ?? 0);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filtersReset, setFiltersReset] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${publicApiBase}/catalog/categories?locale=${locale}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!controller.signal.aborted && isCatalogCategoriesResponse(body)) setCategories(body);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [locale]);

  useEffect(() => {
    const controller = new AbortController();
    const requestedSearch = catalogStateSearch({ query, author, publisher, series, minPrice, maxPrice, hasCover, isNew, language, category, sort, availableOnly, page });
    const isCurrent = () => !controller.signal.aborted && window.location.pathname === pathname && catalogStateSearch(parseCatalogState(window.location.search)) === requestedSearch;
    const timer = window.setTimeout(async () => {
      if (!isCurrent()) return;
      setLoading(true);
      setError(null);
      try {
        const search = catalogQueryString({
          locale,
          q: query,
          author, publisher, series, minPrice, maxPrice, hasCover, isNew,
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
        if (!isCurrent()) return;
        const lastPage = Math.max(1, Math.ceil(body.total / pageSize));
        if (page > lastPage) { updateLocation({ page: lastPage }, true); return; }
        setItems(body.items.map(mapCatalogBook));
        setTotal(body.total);
      } catch (cause) {
        if (!isCurrent()) return;
        setItems([]);
        setTotal(0);
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (isCurrent()) setLoading(false);
      }
    }, query.trim() ? 300 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [author, publisher, series, minPrice, maxPrice, hasCover, isNew, availableOnly, category, language, locale, page, pathname, query, reload, sort]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const visiblePages = useMemo(() => {
    const start = Math.max(1, Math.min(page - 1, totalPages - 2));
    return Array.from({ length: Math.min(3, totalPages) }, (_, index) => start + index);
  }, [page, totalPages]);

  const changeQuery = (value: string) => updateLocation({ query: value }, true);
  const changeLanguage = (value: CatalogLanguage | typeof allValue) => updateLocation({ language: value });
  const changeCategory = (value: string) => updateLocation({ category: value });
  const changeSort = (value: CatalogSort) => updateLocation({ sort: value });
  const toggleAvailability = () => updateLocation({ availableOnly: !availableOnly });
  const clearFilters = () => {
    // Remount draft inputs even when there are no applied URL filters to clear.
    setFiltersReset((value) => value + 1);
    updateLocation(defaultCatalogState);
  };
  const pageHref = (pageNumber: number) => {
    const search = updateCatalogSearch(searchParams.toString(), { page: pageNumber });
    return pathname + (search ? `?${search}` : "");
  };
  const languageLabel = (value: CatalogLanguage | typeof allValue) =>
    value === allValue ? t.allLanguages : catalogLanguageDefinitions.find((item) => item.slug === value)?.value ?? value;
  const categoryLabel = category === allValue ? status.allSections : categories.find((item) => item.supplierCategoryId === category)?.name ?? category;
  const activeFilters = [query ? `${t.searchChip}: ${query}` : "", author ? `${facets.author}: ${author}` : "", publisher ? `${facets.publisher}: ${publisher}` : "", series ? `${facets.series}: ${series}` : "", minPrice !== undefined || maxPrice !== undefined ? `${facets.price} ${minPrice ?? 0}–${maxPrice ?? "∞"}` : "", hasCover === true ? facets.cover : hasCover === false ? `${facets.cover}: −` : "", isNew === true ? facets.newOnly : isNew === false ? `${facets.newOnly}: −` : "", language !== allValue ? languageLabel(language) : "", category !== allValue ? categoryLabel : "", availableOnly ? t.available : ""].filter(Boolean);

  return (
    <div className="min-h-[70vh] bg-[#f7f8fc] text-[#18192d]">
      <section className="border-b border-[#e3e5ef]">
        <div className={cx(container, "grid grid-cols-[minmax(0,1fr)_minmax(300px,390px)] items-end gap-12 pb-8 pt-12 max-lg:grid-cols-1 max-lg:gap-6 max-sm:pb-6 max-sm:pt-8")}>
          <div>
            <p className="text-xs font-medium uppercase tracking-[.15em] text-[#727789]">{t.overline}</p>
            <h1 className="font-display mt-4 text-[clamp(2.3rem,4.2vw,3.8rem)] font-bold leading-[1.06] tracking-[-.045em]">{t.title}<br /><em className="font-bold not-italic text-[#6258ff]">{t.accent}</em></h1>
            <p className="mt-5 max-w-[570px] text-sm leading-6 text-[#727789]">{t.intro}</p>
          </div>
          <div>
            <form className="flex min-h-14 items-center gap-3 rounded-xl border border-[#e3e5ef] bg-white/70 px-4 transition focus-within:border-[#6258ff] focus-within:bg-white" onSubmit={(event) => event.preventDefault()}>
              <svg className="size-5 shrink-0 text-[#6258ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
              <CatalogSearchInput query={query} onChange={changeQuery} label={t.search} />
              {query && <button className="grid size-11 shrink-0 place-items-center rounded-full text-xl text-[#727789] transition hover:bg-[#f0eeff]" type="button" onClick={() => changeQuery("")} aria-label={t.clearSearch}>×</button>}
            </form>
            <p className="mt-3 text-xs leading-5 text-[#727789]">{t.fallback}</p>
          </div>
        </div>
        <div className={cx(container, "book-rail flex items-center gap-2 overflow-x-auto pb-7")}>
          <button className={cx("min-h-11 shrink-0 rounded-full border px-4 text-sm transition", language === allValue ? "border-[#6258ff] bg-[#6258ff] text-white" : "border-[#e3e5ef] bg-transparent text-[#62687d] hover:border-[#6258ff]")} type="button" onClick={() => changeLanguage(allValue)}>{t.allLanguages}</button>
          {catalogLanguageDefinitions.map((item) => <button className={cx("min-h-11 shrink-0 rounded-full border px-4 text-sm transition", language === item.slug ? "border-[#6258ff] bg-[#6258ff] text-white" : "border-[#e3e5ef] bg-transparent text-[#62687d] hover:border-[#6258ff]")} type="button" onClick={() => changeLanguage(item.slug)} key={item.slug}>{item.value}</button>)}
        </div>
      </section>

      <div className={cx(container, "grid min-h-[88px] grid-cols-[230px_1fr_auto] items-center gap-10 max-md:grid-cols-[1fr_auto] max-md:gap-3")}>
        <button className="hidden min-h-11 items-center gap-2 rounded-xl border border-[#e3e5ef] px-4 text-sm max-md:flex" onClick={() => setFiltersOpen(true)} type="button"><svg className="size-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><path d="M7 3v4M13 8v4M8 13v4"/></svg>{t.filters}{activeFilters.length > 0 && <b className="grid size-5 place-items-center rounded-full bg-[#6258ff] text-xs font-medium text-white">{activeFilters.length}</b>}</button>
        <p className="text-sm text-[#727789] max-md:hidden"><strong className="mr-1.5 font-medium text-[#18192d]">{total}</strong>{total === 1 ? t.countOne : t.countMany}</p>
        <label className="col-start-3 flex items-center text-sm text-[#727789] max-md:col-start-2"><span className="max-sm:sr-only">{t.sort}</span><select className="ml-3 min-h-11 max-w-[210px] rounded-xl border border-[#e3e5ef] bg-[#f7f8fc] px-3 text-sm text-[#18192d] outline-none focus:border-[#6258ff] max-md:ml-0 max-sm:max-w-[180px]" value={sort} onChange={(event) => changeSort(event.target.value as CatalogSort)}><option value="popular">{facets.recommendation}</option><option value="new">{facets.updated}</option><option value="price-asc">{t.cheaper}</option><option value="price-desc">{t.expensive}</option><option value="title">A–Z</option></select></label>
      </div>

      <div className={cx(container, "grid grid-cols-[230px_minmax(0,1fr)] items-start gap-10 pb-20 max-md:grid-cols-1 max-md:gap-5")}>
        {filtersOpen && <button className="fixed inset-0 z-[60] hidden bg-[#18192d]/35 backdrop-blur-sm max-md:block" type="button" onClick={() => setFiltersOpen(false)} aria-label={t.filters} />}
        <aside className={cx("sticky top-28 border-r xl:top-[164px] border-[#e3e5ef] pr-7 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-[70] max-md:max-h-[82vh] max-md:overflow-auto max-md:rounded-t-2xl max-md:border-0 max-md:bg-[#f7f8fc] max-md:p-6 max-md:shadow-2xl", filtersOpen ? "max-md:block" : "max-md:hidden")}>
          <div className="flex min-h-11 items-center justify-between gap-3 pb-5"><strong className="font-display text-[25px] font-semibold">{t.filters}</strong><button className="min-h-11 text-xs text-[#727789] underline underline-offset-4 transition hover:text-[#6258ff]" type="button" onClick={clearFilters}>{t.reset}</button></div>
          <label className="grid gap-3 border-b border-[#e3e5ef] pb-6"><span className="text-sm font-medium">{status.sections}</span><select className="min-h-11 w-full rounded-lg border border-[#e3e5ef] bg-transparent px-3 text-sm outline-none focus:border-[#6258ff]" value={category} onChange={(event) => changeCategory(event.target.value)}><option value={allValue}>{status.allSections}</option>{categories.filter((item) => item.supplierCategoryId !== "7463").map((item) => <option value={item.supplierCategoryId} key={item.supplierCategoryId}>{item.name}</option>)}</select></label>
          <fieldset className="m-0 grid gap-0 border-0 border-b border-[#e3e5ef] px-0 pb-5 pt-6"><legend className="float-left mb-3 w-full text-sm font-medium">{t.language}</legend>{([allValue, ...catalogLanguageDefinitions.map((item) => item.slug)] as Array<CatalogLanguage | typeof allValue>).map((item) => <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#62687d]" key={item}><input className="peer sr-only" type="radio" name="language" checked={language === item} onChange={() => changeLanguage(item)} /><span className="grid size-[18px] place-items-center rounded-full border border-[#a7aac0] after:hidden after:size-2 after:rounded-full after:bg-[#6258ff] after:content-[''] peer-checked:border-[#6258ff] peer-checked:after:block peer-focus-visible:ring-2 peer-focus-visible:ring-[#6258ff] peer-focus-visible:ring-offset-2" />{languageLabel(item)}</label>)}</fieldset>
          <form key={JSON.stringify([filtersReset, author, publisher, series, minPrice, maxPrice])} className="grid gap-4 border-b border-[#e3e5ef] py-6" onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const values = new FormData(form);
            const lower = String(values.get("minPrice") ?? "");
            const upper = String(values.get("maxPrice") ?? "");
            const maximumInput = form.elements.namedItem("maxPrice") as HTMLInputElement;
            maximumInput.setCustomValidity(lower && upper && Number(upper) < Number(lower) ? facets.invalidRange : "");
            if (!form.reportValidity()) return;
            updateLocation({ author: String(values.get("author") ?? "").trim(), publisher: String(values.get("publisher") ?? "").trim(), series: String(values.get("series") ?? "").trim(), minPrice: lower ? Number(lower) : undefined, maxPrice: upper ? Number(upper) : undefined });
          }}>
            {(["publisher", "author", "series"] as const).map((field) => <label className="grid gap-2 text-sm font-medium" key={field}>{facets[field]}<input name={field} type="text" maxLength={field === "author" ? 500 : 256} defaultValue={{ author, publisher, series }[field]} className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e5ef] bg-transparent px-3 font-normal outline-none focus:border-[#6258ff]" /></label>)}
            <fieldset className="min-w-0 border-0 p-0"><legend className="mb-3 text-sm font-medium">{facets.price}</legend><div className="grid grid-cols-2 gap-2">{(["minPrice", "maxPrice"] as const).map((field) => <label className="grid min-w-0 gap-2 text-xs text-[#727789]" key={field}>{field === "minPrice" ? facets.from : facets.to}<input name={field} type="number" inputMode="numeric" min={0} max={2147483647} step={1} defaultValue={field === "minPrice" ? minPrice ?? "" : maxPrice ?? ""} onInput={(event) => { const form = event.currentTarget.form; const upper = form?.elements.namedItem("maxPrice") as HTMLInputElement | null; upper?.setCustomValidity(""); }} className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e5ef] bg-transparent px-3 text-sm text-[#18192d] outline-none focus:border-[#6258ff]" /></label>)}</div></fieldset>
            <button type="submit" className="min-h-11 rounded-lg border border-[#6258ff] px-3 text-sm text-[#6258ff] transition hover:bg-[#f0eeff]">{facets.apply}</button>
          </form>
          <div className="grid gap-2 border-b border-[#e3e5ef] py-5">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#62687d]"><input type="checkbox" checked={hasCover === true} onChange={(event) => updateLocation({ hasCover: event.target.checked ? true : undefined })} className="size-4 shrink-0 accent-[#6258ff]" />{facets.cover}</label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-[#62687d]"><input type="checkbox" checked={isNew === true} onChange={(event) => updateLocation({ isNew: event.target.checked ? true : undefined })} className="size-4 shrink-0 accent-[#6258ff]" />{facets.newOnly}</label>
          </div>
          <div className="flex items-center justify-between gap-3 py-6"><div className="grid gap-1"><strong className="text-sm font-medium">{t.available}</strong><small className="text-xs leading-5 text-[#727789]">{t.availableHint}</small></div><button className="grid min-h-11 w-11 shrink-0 place-items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6258ff]" type="button" onClick={toggleAvailability} aria-label={t.available} aria-pressed={availableOnly}><span className={cx("relative h-6 w-10 rounded-full transition", availableOnly ? "bg-[#6258ff]" : "bg-[#c6cdc1]")}><i className={cx("absolute left-1 top-1 size-4 rounded-full bg-white shadow-sm transition-transform", availableOnly && "translate-x-4")} /></span></button></div>
          <button className="sticky bottom-0 mt-3 hidden min-h-12 w-full rounded-xl bg-[#6258ff] px-4 text-sm font-medium text-white max-md:block" type="button" onClick={() => setFiltersOpen(false)}>{t.show} {total}</button>
        </aside>

        <section className="min-w-0" aria-live="polite" aria-busy={loading}>
          {activeFilters.length > 0 && <div className="book-rail mb-6 flex gap-2 overflow-x-auto">{activeFilters.map((filter) => <span className="whitespace-nowrap rounded-full bg-[#f0eeff] px-3 py-2.5 text-xs text-[#62687d]" key={filter}>{filter}</span>)}<button className="min-h-11 whitespace-nowrap px-2 text-xs text-[#6258ff] underline underline-offset-4" type="button" onClick={clearFilters}>{t.clearAll} ×</button></div>}
          {loading && items.length === 0 ? <div className="grid min-h-[420px] place-items-center rounded-2xl bg-[#eeeee7] text-sm text-[#727789]">{status.loading}</div> : null}
          {error ? <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-[#e4d7c9] bg-[#fbfaf7] px-5 text-center"><h2 className="font-display text-3xl font-normal">{status.error}</h2><p className="mt-3 text-sm text-[#727789]">{status.errorHint}</p><button className="mt-5 min-h-11 rounded-full border border-[#e3e5ef] px-5 text-sm text-[#6258ff] transition hover:bg-[#f0eeff]" type="button" onClick={() => setReload((value) => value + 1)}>{status.retry}</button></div> : null}
          {!error && items.length > 0 ? <div className={cx("grid grid-cols-3 gap-x-6 gap-y-10 transition max-xl:grid-cols-2 max-sm:gap-x-3 max-sm:gap-y-7", loading && "opacity-55")}>{items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div> : null}
          {!loading && !error && items.length === 0 ? <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl bg-[#eeeee7] px-5 text-center"><svg className="size-10 text-[#a0aa9b]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><h2 className="font-display mt-5 text-3xl font-normal">{t.nothing}</h2><p className="mt-3 text-sm text-[#727789]">{t.nothingHint}</p><button className="mt-5 min-h-11 rounded-full border border-[#cbd4c6] px-5 text-sm text-[#6258ff] transition hover:bg-[#f0eeff]" type="button" onClick={clearFilters}>{t.reset}</button></div> : null}
          {!error && totalPages > 1 ? <nav className="mt-12 flex items-center justify-center gap-2 max-sm:gap-1" aria-label={status.page}>
            {page > 1 ? <Link prefetch={false} href={pageHref(page - 1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#e3e5ef] px-4 text-sm transition hover:bg-[#f0eeff] max-sm:px-3"><span aria-hidden="true">←</span><span className="max-sm:sr-only"> {status.previous}</span></Link> : <span aria-disabled="true" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#e3e5ef] px-4 text-sm opacity-40 max-sm:px-3"><span aria-hidden="true">←</span><span className="max-sm:sr-only"> {status.previous}</span></span>}
            {visiblePages.map((pageNumber) => <Link prefetch={false} href={pageHref(pageNumber)} aria-current={pageNumber === page ? "page" : undefined} aria-label={`${status.page} ${pageNumber}`} className={cx("grid size-11 place-items-center rounded-full border border-[#e3e5ef] text-sm transition hover:bg-[#f0eeff]", pageNumber === page && "border-[#6258ff] bg-[#6258ff] text-white hover:bg-[#304e41]")} key={pageNumber}>{pageNumber}</Link>)}
            {page < totalPages ? <Link prefetch={false} href={pageHref(page + 1)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#e3e5ef] px-4 text-sm transition hover:bg-[#f0eeff] max-sm:px-3"><span className="max-sm:sr-only">{status.next} </span><span aria-hidden="true">→</span></Link> : <span aria-disabled="true" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[#e3e5ef] px-4 text-sm opacity-40 max-sm:px-3"><span className="max-sm:sr-only">{status.next} </span><span aria-hidden="true">→</span></span>}
          </nav> : null}
        </section>
      </div>
    </div>
  );
}
