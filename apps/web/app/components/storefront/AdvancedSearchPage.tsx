"use client";

import { type FormEvent, useEffect, useState } from "react";
import { createLatestRequestGate, mergeSearchPage } from "../../lib/storefront-state";
import {
  catalogQueryString,
  isCatalogApiResponse,
  mapCatalogBook,
  publicApiBase,
  type CatalogLanguage,
} from "../../lib/catalog-api";
import type { Book } from "../../lib/types";
import { BookCard } from "./BookCard";
import { useStorefront } from "./StorefrontShell";
import type { Locale } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

type SearchField = "title" | "author" | "description" | "productCode" | "barcode" | "isbn" | "publisher" | "series";
type SearchValues = Record<SearchField, string>;
type SubmittedSearch = { values: SearchValues; language: CatalogLanguage | "all"; locale: Locale };
const pageSize = 24;

const emptySearch: SearchValues = {
  title: "",
  author: "",
  description: "",
  productCode: "",
  barcode: "",
  isbn: "",
  publisher: "",
  series: "",
};

const copy: Record<Locale, {
  overline: string;
  title: string;
  accent: string;
  intro: string;
  search: string;
  searching: string;
  reset: string;
  language: string;
  all: string;
  found: string;
  empty: string;
  hint: string;
  error: string;
  more: string;
  shown: string;
  of: string;
  retry: string;
  fields: Record<SearchField, string>;
}> = {
  ru: {
    overline: "Точный поиск",
    title: "Найдите именно",
    accent: "своё издание.",
    intro: "Найдите нужную книгу по названию, автору, ISBN или издательству. Заполните одно поле или уточните поиск сразу по нескольким.",
    search: "Найти книги",
    searching: "Ищем…",
    reset: "Очистить",
    language: "Язык издания",
    all: "Все языки",
    found: "Найдено",
    empty: "Ничего не найдено",
    hint: "Попробуйте убрать часть условий или проверить написание.",
    error: "Не удалось выполнить поиск. Попробуйте ещё раз через некоторое время.",
    more: "Показать ещё", shown: "Показано", of: "из", retry: "Повторить",
    fields: { title: "Название", author: "Автор", description: "Описание", productCode: "Код товара", barcode: "Штрих-код", isbn: "ISBN", publisher: "Издательство", series: "Серия" },
  },
  hy: {
    overline: "Ճշգրիտ որոնում",
    title: "Գտեք հենց ձեր",
    accent: "հրատարակությունը։",
    intro: "Գտեք անհրաժեշտ գիրքը ըստ անվանման, հեղինակի, ISBN-ի կամ հրատարակչի։ Լրացրեք մեկ դաշտ կամ մի քանի պայմանով ճշգրտեք որոնումը։",
    search: "Գտնել գրքերը",
    searching: "Որոնում ենք…",
    reset: "Մաքրել",
    language: "Հրատարակության լեզու",
    all: "Բոլոր լեզուները",
    found: "Գտնվել է",
    empty: "Ոչինչ չի գտնվել",
    hint: "Փորձեք հեռացնել պայմաններից մի քանիսը կամ ստուգել գրությունը։",
    error: "Որոնումը չհաջողվեց։ Խնդրում ենք մի փոքր ուշ կրկին փորձել։",
    more: "Ցույց տալ ավելին", shown: "Ցուցադրված է", of: "/", retry: "Կրկնել",
    fields: { title: "Անվանում", author: "Հեղինակ", description: "Նկարագրություն", productCode: "Ապրանքի կոդ", barcode: "Շտրիխ կոդ", isbn: "ISBN", publisher: "Հրատարակիչ", series: "Շարք" },
  },
  en: {
    overline: "Precise search",
    title: "Find the exact",
    accent: "edition.",
    intro: "Find a book by title, author, ISBN or publisher. Fill in one field or combine several to narrow your search.",
    search: "Find books",
    searching: "Searching…",
    reset: "Clear",
    language: "Edition language",
    all: "All languages",
    found: "Found",
    empty: "No matches found",
    hint: "Remove one of the conditions or check the spelling and try again.",
    error: "We could not complete your search. Please try again in a moment.",
    more: "Show more", shown: "Showing", of: "of", retry: "Retry",
    fields: { title: "Title", author: "Author", description: "Description", productCode: "Product code", barcode: "Barcode", isbn: "ISBN", publisher: "Publisher", series: "Series" },
  },
};

export function AdvancedSearchPage() {
  const { locale } = useStorefront();
  const t = copy[locale];
  const [values, setValues] = useState<SearchValues>(emptySearch);
  const [language, setLanguage] = useState<CatalogLanguage | "all">("all");
  const [items, setItems] = useState<Book[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedSearch | null>(null);
  const [requests] = useState(createLatestRequestGate);
  const [viewLocale, setViewLocale] = useState(locale);
  if (viewLocale !== locale) {
    setViewLocale(locale);
    setSubmitted(null);
    setPending(false);
  }
  const currentSearch = submitted?.locale === locale;
  const loading = currentSearch && pending;

  useEffect(() => () => requests.cancel(), [locale, requests]);

  const clearResults = () => {
    requests.cancel();
    setItems([]); setTotal(null); setError(false); setPending(false);
    setNextOffset(0); setHasMore(false); setSubmitted(null);
  };
  const setField = (field: SearchField, value: string) => {
    clearResults();
    setValues((current) => ({ ...current, [field]: value }));
  };
  const hasCriteria = Object.values(values).some((value) => value.trim()) || language !== "all";

  const loadPage = async (search: SubmittedSearch, offset: number) => {
    const request = requests.begin();
    setSubmitted(search);
    setPending(true);
    setError(false);
    if (offset === 0) { setItems([]); setTotal(null); setHasMore(false); setNextOffset(0); }
    try {
      const query = catalogQueryString({
        locale: search.locale,
        ...search.values,
        language: search.language === "all" ? undefined : search.language,
        available: true,
        sort: "new",
        offset,
        limit: pageSize,
      });
      const response = await fetch(publicApiBase + "/catalog/books?" + query, { cache: "no-store", signal: request.signal });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const body: unknown = await response.json();
      if (!isCatalogApiResponse(body)) throw new Error("Invalid catalog response");
      if (!request.isCurrent()) return;
      const page = mergeSearchPage(items, body.items.map(mapCatalogBook), offset, body.total);
      setItems(page.items); setTotal(page.total); setNextOffset(page.nextOffset); setHasMore(page.hasMore);
    } catch {
      if (request.isCurrent()) setError(true);
    } finally {
      if (request.isCurrent()) setPending(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCriteria || loading) return;
    void loadPage({ values: { ...values }, language, locale }, 0);
  };
  const reset = () => { clearResults(); setValues(emptySearch); setLanguage("all"); };

  return (
    <main className="min-h-[72vh] bg-[#f7f5f0] text-[#202c28]">
      <section className="border-b border-[#dedfd5]">
        <div className={cx(container, "grid grid-cols-[1fr_.72fr] items-end gap-8 py-14 max-lg:grid-cols-1 max-sm:py-9")}>
          <div><span className="inline-flex text-xs font-medium uppercase tracking-[.16em] text-[#243e35]">{t.overline}</span><h1 className="font-display mt-5 text-[clamp(2.7rem,5.5vw,4.75rem)] font-normal leading-[1.06] tracking-[-.03em]">{t.title}<em className="block pt-1 font-normal italic text-[#243e35]">{t.accent}</em></h1></div>
          <p className="max-w-[520px] pb-1 text-base leading-8 text-[#626e64]">{t.intro}</p>
        </div>
      </section>

      <section className={cx(container, "py-10 max-sm:py-6")}>
        <form className="rounded-[20px] border border-[#dedfd5] bg-[#fffdf8] p-7 shadow-[0_20px_65px_rgba(36,62,53,.025)] max-sm:rounded-[20px] max-sm:p-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
            {(Object.keys(t.fields) as SearchField[]).map((field) => <label className="group grid gap-2 rounded-2xl border border-[#dedfd5] bg-[#f7f5f0] p-4 transition focus-within:border-[#243e35] focus-within:bg-[#fffdf8] focus-within:shadow-[0_0_0_4px_rgba(36,62,53,.08)]" key={field}><span className="text-sm font-medium text-[#637064]">{t.fields[field]}</span><input className="min-h-11 min-w-0 bg-transparent text-base font-normal text-[#202c28] outline-none placeholder:text-[#969e94]" value={values[field]} onChange={(event) => setField(field, event.target.value)} maxLength={field === "description" ? 500 : field === "title" || field === "author" ? 500 : 256} /></label>)}
          </div>
          <label className="mt-4 flex min-h-20 items-center justify-between gap-4 rounded-2xl border border-[#dedfd5] bg-[#f7f5f0] p-4 max-sm:flex-col max-sm:items-stretch"><span className="text-sm font-medium text-[#637064]">{t.language}</span><select className="min-h-12 min-w-0 rounded-xl border border-[#dedfd5] bg-[#fffdf8] px-4 text-base font-normal outline-none focus:border-[#243e35]" value={language} onChange={(event) => { clearResults(); setLanguage(event.target.value as CatalogLanguage | "all"); }}><option value="all">{t.all}</option><option value="hy">Հայերեն</option><option value="ru">Русский</option><option value="en">English</option></select></label>
          <div className="mt-5 flex gap-3 max-sm:flex-col"><button className="flex min-h-13 flex-1 items-center justify-between rounded-xl bg-[#243e35] px-6 text-sm font-medium text-white transition hover:bg-[#345446] disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={!hasCriteria || loading}>{loading ? t.searching : t.search}<span className="text-lg">↗</span></button><button className="min-h-13 rounded-xl border border-[#dedfd5] px-6 text-sm font-medium text-[#637064] transition hover:bg-[#e8ede5]" type="button" onClick={reset}>{t.reset}</button></div>
        </form>
      </section>

      {currentSearch && error ? <section className={cx(container, "pb-8")}><div className="rounded-[20px] bg-[#ffe7eb] p-6 text-sm text-[#a9364a]" role="alert"><p>{t.error}</p><button className="mt-4 min-h-11 rounded-xl border border-current px-5 font-bold disabled:opacity-50" disabled={loading} type="button" onClick={() => submitted && void loadPage(submitted, nextOffset)}>{loading ? t.searching : t.retry}</button></div></section> : null}
      {currentSearch && total !== null ? <section className={cx(container, "pb-20 pt-5")} aria-live="polite" aria-busy={loading}>
        <div className="mb-8 flex items-end justify-between gap-6 max-sm:flex-col max-sm:items-start"><div><span className={eyebrow}>{t.found} · {total}</span><h2 className={cx(sectionTitle, "mt-4")}>{total > 0 ? t.found : t.empty}</h2><p className="mt-4 text-sm text-[#626e64]">{t.shown} {items.length} {t.of} {total}</p></div>{total === 0 ? <p className="max-w-[420px] text-sm leading-6 text-[#626e64]">{t.hint}</p> : null}</div>
        {items.length > 0 ? <div className="grid grid-cols-4 gap-x-6 gap-y-10 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:gap-x-4">{items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div> : null}
        {hasMore && !error ? <div className="mt-10 flex justify-center"><button type="button" disabled={loading} onClick={() => submitted && void loadPage(submitted, nextOffset)} className="min-h-12 rounded-xl bg-[#243e35] px-8 text-sm font-medium text-white transition hover:bg-[#345446] disabled:opacity-50">{loading ? t.searching : t.more}</button></div> : null}
      </section> : null}
    </main>
  );
}
