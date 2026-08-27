"use client";

import { useEffect, useMemo, useState } from "react";
import { books, catalogCategoryDefinitions, catalogLanguageDefinitions } from "../../lib/catalog-data";
import { BookCard } from "./BookCard";
import { useStorefront } from "./StorefrontShell";
import { dictionary } from "./i18n";
import { container, cx, eyebrow } from "./ui";

const allValue = "all";

export function CatalogPage() {
  const { locale } = useStorefront();
  const t = dictionary[locale].catalog;
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<string>(allValue);
  const [category, setCategory] = useState<string>(allValue);
  const [sort, setSort] = useState("popular");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const incomingQuery = params.get("q");
      const incomingLanguage = params.get("language");
      const incomingCategory = params.get("category");
      const languageDefinition = catalogLanguageDefinitions.find((item) => item.slug === incomingLanguage || item.value === incomingLanguage);
      const categoryDefinition = catalogCategoryDefinitions.find((item) => item.slug === incomingCategory || item.value === incomingCategory);

      if (incomingQuery) setQuery(incomingQuery);
      if (languageDefinition) setLanguage(languageDefinition.value);
      if (incomingCategory === "Հայերեն") setLanguage("Հայերեն");
      if (incomingCategory === "Художественная литература") setCategory("classics");
      else if (categoryDefinition) setCategory(categoryDefinition.slug);
      if (["popular", "new", "price-asc", "price-desc"].includes(params.get("sort") ?? "")) setSort(params.get("sort") ?? "popular");
      if (params.get("available") === "all") setAvailableOnly(false);
      setInitialized(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams();
    const languageDefinition = catalogLanguageDefinitions.find((item) => item.value === language);
    if (query.trim()) params.set("q", query.trim());
    if (languageDefinition) params.set("language", languageDefinition.slug);
    if (category !== allValue) params.set("category", category);
    if (sort !== "popular") params.set("sort", sort);
    if (!availableOnly) params.set("available", "all");
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [availableOnly, category, initialized, language, query, sort]);

  const filteredBooks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru");
    const categoryDefinition = catalogCategoryDefinitions.find((item) => item.slug === category);
    return books.filter((book) => {
      const queryMatch = !normalized || [book.title, book.author, book.isbn, book.category].join(" ").toLocaleLowerCase("ru").includes(normalized);
      const languageMatch = language === allValue || book.language === language;
      const categoryMatch = !categoryDefinition || book.category === categoryDefinition.value;
      return queryMatch && languageMatch && categoryMatch && (!availableOnly || book.availability !== "unavailable");
    }).sort((a, b) => sort === "price-asc" ? a.price - b.price : sort === "price-desc" ? b.price - a.price : sort === "new" ? b.year - a.year || b.rating - a.rating : b.rating * Math.log10(b.reviews + 10) - a.rating * Math.log10(a.reviews + 10));
  }, [query, language, category, sort, availableOnly]);

  const clearFilters = () => { setQuery(""); setLanguage(allValue); setCategory(allValue); setAvailableOnly(true); };
  const languageLabel = (value: string) => value === allValue ? t.allLanguages : value;
  const categoryLabel = (value: string) => value === allValue ? t.allCategories : t.categories[catalogCategoryDefinitions.findIndex((item) => item.slug === value)] ?? value;
  const activeFilters = [query ? `${t.searchChip}: ${query}` : "", language !== allValue ? languageLabel(language) : "", category !== allValue ? categoryLabel(category) : ""].filter(Boolean);

  return (
    <div className="min-h-[70vh] bg-[#f1f2f4]">
      <section className="border-b-2 border-black bg-[#0b0c10] text-white">
        <div className={cx(container, "grid grid-cols-[1fr_minmax(360px,570px)] items-end gap-12 py-14 max-lg:grid-cols-1 max-lg:gap-8 max-sm:py-10")}>
          <div>
            <span className={cx(eyebrow, "text-[#c9ff3d]")}>{t.overline}</span>
            <h1 className="mt-4 text-[clamp(3.2rem,7vw,7.5rem)] font-black leading-[.8] tracking-[-.085em]">{t.title} <em className="not-italic text-[#8f85ff]">{t.accent}</em></h1>
            <p className="mt-6 max-w-[650px] text-[12px] font-medium leading-6 text-white/52">{t.intro}</p>
            <small className="mt-2 block text-[9px] font-bold uppercase tracking-[.08em] text-white/28">{t.fallback}</small>
          </div>
          <form className="flex h-16 items-center gap-4 rounded-[16px] border-2 border-white bg-white px-5 text-[#0b0c10] shadow-[8px_8px_0_#6558ff]" onSubmit={(event) => event.preventDefault()}>
            <span className="text-2xl font-black" aria-hidden="true">⌕</span>
            <input className="min-w-0 flex-1 bg-transparent text-[12px] font-bold outline-none placeholder:text-black/38" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} aria-label={t.search} />
            {query && <button className="grid size-9 place-items-center rounded-[10px] bg-[#e9ebef] text-lg font-black" type="button" onClick={() => setQuery("")} aria-label={t.clearSearch}>×</button>}
          </form>
        </div>
        <div className={cx(container, "flex items-center gap-2 overflow-x-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")}>
          <button className={cx("shrink-0 rounded-[11px] border px-4 py-3 text-[9px] font-black uppercase transition", category === allValue && language === allValue ? "border-[#c9ff3d] bg-[#c9ff3d] text-[#0b0c10]" : "border-white/18 bg-white/[.06] text-white hover:bg-white/10")} type="button" onClick={() => { setCategory(allValue); setLanguage(allValue); }}>{t.allCategories}</button>
          {catalogLanguageDefinitions.map((item) => <button className={cx("shrink-0 rounded-[11px] border px-4 py-3 text-[9px] font-black uppercase transition", language === item.value ? "border-[#6558ff] bg-[#6558ff] text-white" : "border-white/18 bg-white/[.06] text-white hover:bg-white/10")} type="button" onClick={() => { setLanguage(item.value); setCategory(allValue); }} key={item.slug}>{item.value}</button>)}
          {catalogCategoryDefinitions.slice(0, 5).map((item, index) => <button className={cx("shrink-0 rounded-[11px] border px-4 py-3 text-[9px] font-black uppercase transition", category === item.slug ? "border-[#6558ff] bg-[#6558ff] text-white" : "border-white/18 bg-white/[.06] text-white hover:bg-white/10")} type="button" onClick={() => { setCategory(item.slug); setLanguage(allValue); }} key={item.slug}>{t.categories[index]}</button>)}
        </div>
      </section>

      <div className={cx(container, "grid min-h-[76px] grid-cols-[250px_1fr_auto] items-center border-b-2 border-black max-md:grid-cols-[1fr_auto]")}>
        <button className="hidden items-center gap-2 text-[10px] font-black uppercase max-md:flex" onClick={() => setFiltersOpen((value) => !value)} type="button"><span>☷</span>{t.filters}{activeFilters.length > 0 && <b className="grid size-5 place-items-center rounded-[7px] bg-[#6558ff] text-[8px] text-white">{activeFilters.length}</b>}</button>
        <p className="text-[10px] font-bold text-black/45 max-md:hidden"><strong className="mr-2 text-[18px] font-black text-[#0b0c10]">{filteredBooks.length}</strong>{filteredBooks.length === 1 ? t.countOne : t.countMany}</p>
        <label className="col-start-3 text-[9px] font-bold uppercase text-black/45 max-md:col-start-2 max-md:text-[0px]">{t.sort}<select className="ml-3 rounded-[11px] border-2 border-black bg-white px-4 py-2.5 text-[10px] font-black text-[#0b0c10] outline-none focus:border-[#6558ff]" value={sort} onChange={(event) => setSort(event.target.value)}><option value="popular">{t.popular}</option><option value="new">{t.newest}</option><option value="price-asc">{t.cheaper}</option><option value="price-desc">{t.expensive}</option></select></label>
      </div>

      <div className={cx(container, "grid grid-cols-[230px_minmax(0,1fr)] items-start gap-8 py-8 pb-24 max-md:grid-cols-1 max-md:gap-5")}>
        <aside className={cx("sticky top-36 rounded-[20px] border-2 border-black bg-white p-5 shadow-[5px_5px_0_#0b0c10] max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:z-[60] max-md:hidden max-md:max-h-[82vh] max-md:overflow-auto max-md:rounded-b-none max-md:p-6 max-md:shadow-2xl", filtersOpen && "max-md:block")}>
          <div className="flex items-center justify-between border-b-2 border-black pb-4"><strong className="text-xl font-black tracking-[-.04em]">{t.filters}</strong><button className="border-b border-black/35 bg-transparent pb-0.5 text-[9px] font-bold text-black/45" type="button" onClick={clearFilters}>{t.reset}</button></div>
          <fieldset className="grid gap-3 border-0 border-b border-black/12 px-0 py-5"><legend className="mb-3 text-[9px] font-black uppercase tracking-wider">{t.language}</legend>{[allValue, ...catalogLanguageDefinitions.map((item) => item.value)].map((item) => <label className="flex cursor-pointer items-center gap-3 text-[10px] font-bold text-black/62" key={item}><input className="peer sr-only" type="radio" name="language" checked={language === item} onChange={() => setLanguage(item)} /><span className="grid size-5 place-items-center rounded-[7px] border-2 border-black/30 after:hidden after:size-2.5 after:rounded-[3px] after:bg-[#6558ff] after:content-[''] peer-checked:border-[#6558ff] peer-checked:after:block" />{languageLabel(item)}</label>)}</fieldset>
          <fieldset className="grid gap-3 border-0 border-b border-black/12 px-0 py-5"><legend className="mb-3 text-[9px] font-black uppercase tracking-wider">{t.category}</legend>{[allValue, ...catalogCategoryDefinitions.map((item) => item.slug)].map((item) => <label className="flex cursor-pointer items-center gap-3 text-[10px] font-bold text-black/62" key={item}><input className="peer sr-only" type="radio" name="category" checked={category === item} onChange={() => setCategory(item)} /><span className="grid size-5 place-items-center rounded-[7px] border-2 border-black/30 after:hidden after:size-2.5 after:rounded-[3px] after:bg-[#6558ff] after:content-[''] peer-checked:border-[#6558ff] peer-checked:after:block" />{categoryLabel(item)}</label>)}</fieldset>
          <div className="flex items-center justify-between py-5"><div className="grid gap-1"><strong className="text-[10px] font-black">{t.available}</strong><small className="text-[8px] font-medium text-black/45">{t.availableHint}</small></div><button className={cx("relative h-6 w-11 rounded-[8px] bg-[#c8cbd1] transition", availableOnly && "bg-[#6558ff]")} type="button" onClick={() => setAvailableOnly((value) => !value)} aria-pressed={availableOnly}><i className={cx("absolute left-1 top-1 size-4 rounded-[5px] bg-white transition", availableOnly && "left-[24px]")} /></button></div>
          <button className="sticky bottom-0 hidden h-12 w-full rounded-[12px] bg-[#0b0c10] text-[10px] font-black uppercase text-white max-md:block" type="button" onClick={() => setFiltersOpen(false)}>{t.show} {filteredBooks.length}</button>
        </aside>

        <section className="min-w-0" aria-live="polite">
          {activeFilters.length > 0 && <div className="mb-5 flex flex-wrap gap-2 overflow-auto max-sm:flex-nowrap">{activeFilters.map((filter) => <span className="whitespace-nowrap rounded-[10px] border border-black/12 bg-white px-3 py-2 text-[9px] font-black" key={filter}>{filter}</span>)}<button className="whitespace-nowrap bg-transparent text-[9px] font-bold text-black/45 underline" type="button" onClick={clearFilters}>{t.clearAll} ×</button></div>}
          {filteredBooks.length > 0 ? <div className="grid grid-cols-4 gap-4 max-xl:grid-cols-3 max-lg:grid-cols-2 max-sm:gap-2.5">{filteredBooks.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div> : <div className="flex min-h-[460px] flex-col items-center justify-center rounded-[24px] border-2 border-black bg-white text-center"><span className="text-5xl font-black">⌕</span><h2 className="mt-5 text-3xl font-black tracking-[-.05em]">{t.nothing}</h2><p className="mt-2 text-[11px] font-medium text-black/45">{t.nothingHint}</p><button className="mt-5 border-b-2 border-black bg-transparent pb-1 text-[10px] font-black" type="button" onClick={clearFilters}>{t.reset}</button></div>}
        </section>
      </div>
    </div>
  );
}
