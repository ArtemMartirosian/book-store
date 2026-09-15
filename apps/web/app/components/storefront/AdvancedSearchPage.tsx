"use client";

import { type FormEvent, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const setField = (field: SearchField, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const hasCriteria = Object.values(values).some((value) => value.trim()) || language !== "all";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasCriteria) return;
    setLoading(true);
    setError(false);
    try {
      const query = catalogQueryString({
        locale,
        ...values,
        language: language === "all" ? undefined : language,
        available: true,
        sort: "new",
        limit: 100,
      });
      const response = await fetch(`${publicApiBase}/catalog/books?${query}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body: unknown = await response.json();
      if (!isCatalogApiResponse(body)) throw new Error("Invalid catalog response");
      setItems(body.items.map(mapCatalogBook));
      setTotal(body.total);
    } catch {
      setItems([]);
      setTotal(null);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setValues(emptySearch);
    setLanguage("all");
    setItems([]);
    setTotal(null);
    setError(false);
  };

  return (
    <main className="min-h-[72vh] bg-[#f5f6fb]">
      <section className="lumi-mesh lumi-grid text-white">
        <div className={cx(container, "grid grid-cols-[1fr_.72fr] items-end gap-12 py-16 max-lg:grid-cols-1 max-sm:py-10")}>
          <div><span className="inline-flex rounded-full bg-[#d9ff69] px-3 py-2 text-[8px] font-black uppercase tracking-[.14em] text-[#151722]">{t.overline}</span><h1 className="mt-6 text-[clamp(3.3rem,7vw,7rem)] font-black leading-[.84] tracking-[-.08em]">{t.title}<em className="block pt-2 not-italic text-[#d9ff69]">{t.accent}</em></h1></div>
          <p className="max-w-[520px] text-[12px] leading-6 text-white/62">{t.intro}</p>
        </div>
      </section>

      <section className={cx(container, "py-10 max-sm:py-6")}>
        <form className="rounded-[30px] border border-[#e1e2eb] bg-white p-7 shadow-[0_20px_65px_rgba(35,38,70,.07)] max-sm:rounded-[22px] max-sm:p-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
            {(Object.keys(t.fields) as SearchField[]).map((field) => <label className="group grid gap-2 rounded-2xl border border-[#e4e5ed] bg-[#f7f7fb] p-4 transition focus-within:border-[#6258ff] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(98,88,255,.08)]" key={field}><span className="text-[8px] font-black uppercase tracking-[.1em] text-[#858897]">{t.fields[field]}</span><input className="bg-transparent text-[13px] font-semibold outline-none placeholder:text-[#b1b3bf]" value={values[field]} onChange={(event) => setField(field, event.target.value)} maxLength={field === "description" ? 500 : field === "title" || field === "author" ? 500 : 256} /></label>)}
          </div>
          <label className="mt-3 flex min-h-16 items-center justify-between gap-5 rounded-2xl border border-[#e4e5ed] bg-[#f7f7fb] px-4"><span className="text-[9px] font-black uppercase tracking-[.09em] text-[#858897]">{t.language}</span><select className="min-h-11 rounded-xl border border-[#dfe0e8] bg-white px-4 text-[10px] font-bold outline-none focus:border-[#6258ff]" value={language} onChange={(event) => setLanguage(event.target.value as CatalogLanguage | "all")}><option value="all">{t.all}</option><option value="hy">Հայերեն</option><option value="ru">Русский</option><option value="en">English</option></select></label>
          <div className="mt-5 flex gap-3 max-sm:flex-col"><button className="flex min-h-14 flex-1 items-center justify-between rounded-2xl bg-[#6258ff] px-6 text-[9px] font-black uppercase tracking-[.09em] text-white transition hover:-translate-y-0.5 hover:bg-[#151722] disabled:cursor-not-allowed disabled:opacity-45" type="submit" disabled={!hasCriteria || loading}>{loading ? t.searching : t.search}<span className="text-lg">↗</span></button><button className="min-h-14 rounded-2xl border border-[#dfe0e8] px-6 text-[9px] font-black uppercase tracking-[.09em] text-[#737685]" type="button" onClick={reset}>{t.reset}</button></div>
        </form>
      </section>

      {error ? <section className={cx(container, "pb-20")}><div className="rounded-[24px] bg-[#ffe7eb] p-8 text-[13px] font-bold text-[#a9364a]">{t.error}</div></section> : null}
      {total !== null && !error ? <section className={cx(container, "pb-20 pt-5")} aria-live="polite"><div className="mb-8 flex items-end justify-between gap-6"><div><span className={eyebrow}>{t.found} · {total}</span><h2 className={cx(sectionTitle, "mt-4")}>{total > 0 ? t.found : t.empty}</h2></div>{total === 0 ? <p className="max-w-[420px] text-[11px] leading-5 text-[#737685]">{t.hint}</p> : null}</div>{items.length > 0 ? <div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">{items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div> : null}</section> : null}
    </main>
  );
}
