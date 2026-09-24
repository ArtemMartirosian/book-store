"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type KeyboardEvent, type ReactNode } from "react";
import { brandName } from "../../lib/brand";
import type { Book, CatalogCategory } from "../../lib/types";
import { BookCard } from "./BookCard";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { localized, type Locale } from "./i18n";
import { container, cx } from "./ui";

const marketCopy = {
  ru: {
    heroLabel: "Книжный интернет-магазин",
    hero: [
      { title: "Ваша следующая книга — здесь.", text: "На армянском, русском и английском. Выбирайте любимых авторов и открывайте новые имена.", cta: "Выбрать книгу" },
      { title: "Хороший подарок начинается с книги.", text: "Для близких, для нового увлечения или для себя. Найдите историю, которую захочется подарить.", cta: "Найти подарок" },
      { title: "Новые книги. Новые впечатления.", text: "Загляните в новинки каталога и найдите, что прочитать следующим.", cta: "Смотреть новинки" },
    ],
    previous: "Предыдущий баннер", next: "Следующий баннер", slide: "Баннер", carousel: "Предложения магазина",
    russian: "Книги на русском", english: "Книги на английском", languageHint: "Открыть каталог", all: "Смотреть всё", catalog: "Весь каталог", open: "Открыть раздел",
    newTitle: "Новые поступления", newText: "Новые издания, отмеченные в нашем каталоге.", newEmpty: "Новые поступления скоро появятся.",
    categoryNew: "Новинки по разделам", categoryNewText: "Выбирайте интересующую тему.", categoryNewEmpty: "В этом разделе пока нет новых поступлений.",
    topCategories: "Разделы каталога", categoryEmpty: "Разделы появятся вместе с книгами.", categoryEmptyHint: "А пока можно воспользоваться поиском по названию или автору.",
    armenianPromo: "Читайте на армянском", armenianText: "Любимые истории на родном языке.", giftPromo: "Книга — всегда хорошая идея", giftText: "Для чтения, вдохновения и подарка.",
    publishers: "Издательства", publisherEmpty: "Издательства появятся после добавления книг.", publisherPresents: "Книги издательств", publisherText: "Разные авторы, темы и издания — в одной подборке.",
    otherTitle: "Для любителей книг", otherText: "Закладки и книжные аксессуары.", otherEmpty: "Готовим этот раздел", otherHint: "Книжные аксессуары пока не добавлены в эту подборку. А пока можно выбрать новую книгу в каталоге.",
    discountTitle: "Скидки и предложения", discountEmpty: "Предложения со скидкой скоро появятся", discountHint: "Сейчас подтверждённых скидок нет. Актуальные цены на все книги указаны в каталоге.",
    specialTitle: "Специальная подборка", specialText: "Начните с книг по доступной цене.", specialLink: "Сначала недорогие",
    finalTitle: "Выбирайте книги. Мы привезём.", finalText: "Доставка по Еревану — 1 000 ֏. Наличие и время подтвердим по телефону. Оплата наличными при получении.", finalCta: "Как заказать", finalCatalog: "Перейти в каталог",
    empty: "Книги скоро появятся", emptyHint: "Сейчас в каталоге нет доступных книг. Загляните немного позже.", error: "Не удалось загрузить книги", errorHint: "Каталог временно недоступен. Попробуйте обновить страницу.", categoriesError: "Не удалось загрузить все разделы каталога.", showcaseError: "Не удалось загрузить часть подборок.", retry: "Попробовать снова", loading: "Обновляем…",
  },
  hy: {
    heroLabel: "Առցանց գրախանութ",
    hero: [
      { title: "Ձեր հաջորդ գիրքն այստեղ է։", text: "Հայերեն, ռուսերեն և անգլերեն։ Ընտրեք սիրելի հեղինակներին և բացահայտեք նոր անուններ։", cta: "Ընտրել գիրք" },
      { title: "Լավ նվերը սկսվում է գրքից։", text: "Սիրելիների, նոր հետաքրքրության կամ հենց ձեզ համար։ Գտեք պատմություն, որը կցանկանաք նվիրել։", cta: "Գտնել նվեր" },
      { title: "Նոր գրքեր։ Նոր տպավորություններ։", text: "Բացահայտեք կատալոգի նորույթները և ընտրեք ձեր հաջորդ ընթերցանությունը։", cta: "Դիտել նորույթները" },
    ],
    previous: "Նախորդ բաններ", next: "Հաջորդ բաններ", slide: "Բաններ", carousel: "Գրախանութի առաջարկներ",
    russian: "Գրքեր ռուսերեն", english: "Գրքեր անգլերեն", languageHint: "Բացել կատալոգը", all: "Դիտել բոլորը", catalog: "Ամբողջ կատալոգը", open: "Բացել բաժինը",
    newTitle: "Նոր գրքեր", newText: "Մեր կատալոգում որպես նոր նշված հրատարակություններ։", newEmpty: "Նոր գրքերը շուտով կհայտնվեն։",
    categoryNew: "Նոր գրքեր՝ ըստ բաժինների", categoryNewText: "Ընտրեք ձեզ հետաքրքրող թեման։", categoryNewEmpty: "Այս բաժնում դեռ նոր գրքեր չկան։",
    topCategories: "Կատալոգի բաժիններ", categoryEmpty: "Բաժինները կհայտնվեն գրքերի հետ միասին։", categoryEmptyHint: "Մինչ այդ կարող եք որոնել ըստ անվանման կամ հեղինակի։",
    armenianPromo: "Կարդացեք հայերեն", armenianText: "Սիրելի պատմություններ՝ մայրենի լեզվով։", giftPromo: "Գիրքը միշտ լավ միտք է", giftText: "Ընթերցելու, ոգեշնչվելու և նվիրելու համար։",
    publishers: "Հրատարակիչներ", publisherEmpty: "Հրատարակիչները կհայտնվեն գրքերն ավելացնելուց հետո։", publisherPresents: "Հրատարակիչների գրքերը", publisherText: "Տարբեր հեղինակներ, թեմաներ և հրատարակություններ՝ մեկ ընտրանիում։",
    otherTitle: "Գրքասերների համար", otherText: "Էջանիշեր և գրքային պարագաներ։", otherEmpty: "Պատրաստում ենք այս բաժինը", otherHint: "Այս ընտրանիում դեռ գրքային պարագաներ ավելացված չեն։ Մինչ այդ կարող եք կատալոգից ընտրել նոր գիրք։",
    discountTitle: "Զեղչեր և առաջարկներ", discountEmpty: "Զեղչային առաջարկները շուտով կհայտնվեն", discountHint: "Այս պահին հաստատված զեղչեր չկան։ Գրքերի ընթացիկ գները նշված են կատալոգում։",
    specialTitle: "Հատուկ ընտրանի", specialText: "Սկսեք մատչելի գրքերից։", specialLink: "Սկզբում՝ մատչելիները",
    finalTitle: "Դուք ընտրում եք։ Մենք առաքում ենք։", finalText: "Առաքում Երևանում՝ 1 000 ֏։ Առկայությունն ու ժամը կհաստատենք հեռախոսով։ Վճարումը՝ կանխիկ, ստանալիս։", finalCta: "Ինչպես պատվիրել", finalCatalog: "Բացել կատալոգը",
    empty: "Գրքերը շուտով կհայտնվեն", emptyHint: "Այս պահին կատալոգում հասանելի գրքեր չկան։ Այցելեք մի փոքր ուշ։", error: "Չհաջողվեց բեռնել գրքերը", errorHint: "Կատալոգը ժամանակավորապես հասանելի չէ։ Փորձեք թարմացնել էջը։", categoriesError: "Չհաջողվեց բեռնել կատալոգի բոլոր բաժինները։", showcaseError: "Չհաջողվեց բեռնել որոշ ընտրանիներ։", retry: "Կրկին փորձել", loading: "Թարմացնում ենք…",
  },
  en: {
    heroLabel: "Your online bookstore",
    hero: [
      { title: "Your next book starts here.", text: "In Armenian, Russian and English. Find your favorite authors and discover a new voice.", cta: "Find a book" },
      { title: "A good gift begins with a book.", text: "For someone you love, a new interest or a little time for yourself. Find a story worth sharing.", cta: "Find a gift" },
      { title: "New books. Fresh perspectives.", text: "Explore the latest additions to our catalog and choose your next read.", cta: "Explore new arrivals" },
    ],
    previous: "Previous banner", next: "Next banner", slide: "Banner", carousel: "Bookstore highlights",
    russian: "Books in Russian", english: "Books in English", languageHint: "Explore the catalog", all: "View all", catalog: "All books", open: "Explore category",
    newTitle: "New arrivals", newText: "Editions marked as new in our catalog.", newEmpty: "New arrivals will be here soon.",
    categoryNew: "New arrivals by category", categoryNewText: "Choose the topics you enjoy.", categoryNewEmpty: "No new arrivals in this category yet.",
    topCategories: "Explore categories", categoryEmpty: "Categories will appear alongside our books.", categoryEmptyHint: "In the meantime, try searching by title or author.",
    armenianPromo: "Read in Armenian", armenianText: "Favorite stories in your own language.", giftPromo: "A book is always a good idea", giftText: "For reading, inspiration and giving.",
    publishers: "Publishers", publisherEmpty: "Publishers will appear when books are added.", publisherPresents: "Books from our publishers", publisherText: "Different authors, subjects and editions in one collection.",
    otherTitle: "For book lovers", otherText: "Bookmarks and reading accessories.", otherEmpty: "This collection is on its way", otherHint: "Reading accessories have not been added to this selection yet. For now, discover your next book in the catalog.",
    discountTitle: "Discounts and offers", discountEmpty: "Discount offers will be here soon", discountHint: "There are no confirmed discounts right now. Current prices for every book are shown in the catalog.",
    specialTitle: "A special selection", specialText: "Start with books at an approachable price.", specialLink: "Lowest prices first",
    finalTitle: "You choose. We bring the books.", finalText: "Delivery across Yerevan costs 1,000 ֏. We confirm availability and timing by phone. Pay cash when your order arrives.", finalCta: "How to order", finalCatalog: "Explore the catalog",
    empty: "Books will be here soon", emptyHint: "There are no available books in the catalog right now. Please check back later.", error: "We could not load the books", errorHint: "The catalog is temporarily unavailable. Please try refreshing.", categoriesError: "Some catalog categories could not be loaded.", showcaseError: "Some book selections could not be loaded.", retry: "Try again", loading: "Refreshing…",
  },
} as const;

const sectionHeading = "text-xl font-bold leading-snug tracking-[-.025em] text-[var(--ink)] sm:text-2xl";
const textLink = "inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--accent)] transition hover:opacity-75";
const actionLink = "inline-flex min-h-11 items-center justify-center gap-3 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]";

function Arrow({ reverse = false }: { reverse?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" className={cx("size-4 shrink-0", reverse && "rotate-180")} aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function OpenBook({ className = "size-8" }: { className?: string }) {
  return <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M24 39V11C18 6 10 6 4 8v28c7-2 14-1 20 3Zm0 0V11c6-5 14-5 20-3v28c-7-2-14-1-20 3ZM10 15l8 2m-8 5 8 2m12-7 8-2m-8 9 8-2" /></svg>;
}

function SectionHeader({ title, description, href, linkLabel }: { title: string; description?: string; href?: string; linkLabel?: string }) {
  return <div className="mb-5 flex flex-wrap items-end justify-between gap-x-5 gap-y-2">
    <div><h2 className={sectionHeading}>{title}</h2>{description && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>}</div>
    {href && linkLabel && <Link className={textLink} href={href}>{linkLabel}<Arrow /></Link>}
  </div>;
}

function EmptyCollection({ title, hint, href, label, children }: { title: string; hint?: string; href: string; label: string; children?: ReactNode }) {
  return <div className="flex min-h-32 flex-wrap items-center gap-5 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper-strong)] p-6">
    <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><OpenBook /></span>
    <div className="min-w-0 flex-1 basis-48"><h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>{hint && <p className="mt-1.5 max-w-2xl text-sm leading-6 text-[var(--muted)]">{hint}</p>}{children}</div>
    <Link href={href} className={textLink}>{label}<Arrow /></Link>
  </div>;
}

function BookShelf({ id, title, description, items, href, linkLabel, emptyTitle, emptyHint }: {
  id: string; title: string; description?: string; items: Book[]; href: string; linkLabel: string; emptyTitle: string; emptyHint?: string;
}) {
  return <section id={id} data-home-section={id} className="scroll-mt-40 py-7 sm:py-9">
    <SectionHeader title={title} description={description} href={href} linkLabel={linkLabel} />
    {items.length ? <div className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3 xl:grid-cols-4 xl:gap-x-6">{items.map(book => <BookCard book={book} variant="compact" key={book.id} />)}</div>
      : <EmptyCollection title={emptyTitle} hint={emptyHint} href={href} label={linkLabel} />}
  </section>;
}

function uniqueBooks(items: Book[]) {
  return items.filter((book, index, all) => all.findIndex(item => item.id === book.id) === index);
}

export type HomePageProps = {
  books: Book[];
  categories?: CatalogCategory[];
  catalogLoadFailed?: boolean;
  categoryLoadFailed?: boolean;
  newBooks?: Book[];
  affordableBooks?: Book[];
  showcaseLoadFailed?: boolean;
};

export function HomePage({ books, categories = [], catalogLoadFailed = false, categoryLoadFailed = false, newBooks, affordableBooks, showcaseLoadFailed = false }: HomePageProps) {
  const { locale } = useStorefront();
  const copy = marketCopy[locale];
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [activeSlide, setActiveSlide] = useState(0);
  const retry = () => startRefresh(() => router.refresh());
  const liveBooks = uniqueBooks(books);
  // New arrivals require the real catalog flag, not merely a recent sort position.
  const newest = uniqueBooks(newBooks ?? liveBooks).filter(book => book.isNew === true);
  const offers = uniqueBooks(affordableBooks ?? liveBooks).sort((a, b) => a.price - b.price).slice(0, 4);
  const allBooks = uniqueBooks([...liveBooks, ...newest, ...offers]);
  const heroBooks = allBooks.slice(0, 3);
  const publisherNames = [...new Set(allBooks.map(book => book.publisher?.trim()).filter((name): name is string => Boolean(name)))].slice(0, 6);
  const publisherBooks = allBooks.filter(book => Boolean(book.publisher?.trim())).slice(0, 24);
  const catalogHref = localized(locale, "/catalog");
  const newHref = catalogHref + "?isNew=true";
  const combinedCategories = [...categories, ...allBooks.flatMap(book => book.categories ?? [])]
    .filter((category, index, all) => all.findIndex(item => item.supplierCategoryId === category.supplierCategoryId) === index);
  const byCategoryId = new Map(combinedCategories.map(category => [category.supplierCategoryId, category]));
  const bookInCategory = (book: Book, categoryId: string) => (book.categories ?? []).some(category => {
    let current: CatalogCategory | undefined = category;
    const visited = new Set<string>();
    while (current && !visited.has(current.supplierCategoryId)) {
      if (current.supplierCategoryId === categoryId) return true;
      visited.add(current.supplierCategoryId);
      current = current.parentSupplierCategoryId ? byCategoryId.get(current.parentSupplierCategoryId) : undefined;
    }
    return false;
  });
  const featuredCategories = combinedCategories.filter(category => category.supplierCategoryId !== "7463");
  const categoriesWithNewBooks = featuredCategories.filter(category => newest.some(book => bookInCategory(book, category.supplierCategoryId)));
  const newCategories = (categoriesWithNewBooks.length ? categoriesWithNewBooks : featuredCategories).slice(0, 4);
  const rootCategories = combinedCategories.filter(category => !category.parentSupplierCategoryId);
  const topCategories = (rootCategories.length ? rootCategories : combinedCategories).slice(0, 3);
  const accessories = allBooks.filter(book => /էջանիշ|էջանշան|заклад|bookmark|аксессуар|accessor|գրքային պարագա/iu.test([book.category, ...(book.categories ?? []).map(category => category.name)].join(" "))).slice(0, 4);
  const slide = copy.hero[activeSlide];
  const moveSlide = (direction: number) => setActiveSlide(current => (current + direction + copy.hero.length) % copy.hero.length);
  const handleSliderKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowRight") { event.preventDefault(); moveSlide(1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); moveSlide(-1); }
  };
  const categoryHref = (category: CatalogCategory, onlyNew = false) => catalogHref + "?category=" + encodeURIComponent(category.supplierCategoryId) + (onlyNew ? "&isNew=true" : "");
  const languageCards: Array<{ language: Locale; title: string; letter: string; className: string }> = [
    { language: "ru", title: copy.russian, letter: "Я", className: "bg-[#eef2ff] text-[#38316d]" },
    { language: "en", title: copy.english, letter: "A", className: "bg-[#fff1e6] text-[#69432c]" },
  ];

  return <div className={cx(container, "pb-10 pt-5 sm:pt-7")}>
    <section data-home-section="hero" className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
      <section className="relative flex min-h-[340px] min-w-0 flex-col overflow-hidden rounded-3xl border border-[#e2defb] bg-[#f0edff] p-6 sm:min-h-[360px] sm:p-8" aria-label={copy.carousel}>
        <div className="relative z-10 grid flex-1 items-center gap-5 sm:grid-cols-[1.2fr_.8fr]">
          <div id="home-promotion-content" aria-live="polite" aria-atomic="true">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.08em] text-[var(--accent)]">{brandName(locale)} · {copy.heroLabel}</span>
            <h1 className="mt-4 max-w-xl text-[clamp(1.8rem,3.2vw,2.7rem)] font-bold leading-[1.12] tracking-[-.04em] text-[#292343]">{slide.title}</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-[#625b7c]">{slide.text}</p>
            <Link href={activeSlide === 2 ? newHref : catalogHref} className={cx(actionLink, "mt-5")}>{slide.cta}<Arrow /></Link>
          </div>
          <div className="relative hidden h-60 min-w-0 items-center justify-center sm:flex" aria-hidden="true">
            <span className="absolute inset-x-0 bottom-4 h-7 rounded-[50%] bg-[#6258ff]/10 blur-lg" />
            {heroBooks.length ? heroBooks.map((book, index) => <div key={book.id} className={cx("absolute w-[110px] drop-shadow-xl md:w-[120px]", index === 0 ? "z-20 -rotate-6" : index === 1 ? "right-0 z-10 rotate-12 translate-y-4" : "left-0 rotate-[-16deg] translate-y-5")}><BookCover book={book} size="hero" /></div>)
              : <OpenBook className="relative size-40 -rotate-6 text-[var(--accent)] opacity-70" />}
          </div>
        </div>
        <div className="relative z-10 mt-6 flex items-center justify-between">
          <div className="flex gap-1.5" aria-label={copy.carousel}>{copy.hero.map((item, index) => <button key={item.title} type="button" onKeyDown={handleSliderKey} className="grid min-h-11 min-w-9 place-items-center rounded-lg focus-visible:outline-2 focus-visible:outline-[var(--accent)]" aria-label={copy.slide + " " + (index + 1) + ": " + item.title} aria-controls="home-promotion-content" aria-pressed={activeSlide === index} onClick={() => setActiveSlide(index)}><span className={cx("h-1.5 rounded-full transition-all", activeSlide === index ? "w-7 bg-[var(--accent)]" : "w-2 bg-[#b8b0dc]")} /></button>)}</div>
          <div className="flex gap-2"><button type="button" onKeyDown={handleSliderKey} onClick={() => moveSlide(-1)} className="grid size-11 place-items-center rounded-full border border-white bg-white/80 text-[var(--accent)] hover:bg-white" aria-label={copy.previous}><Arrow reverse /></button><button type="button" onKeyDown={handleSliderKey} onClick={() => moveSlide(1)} className="grid size-11 place-items-center rounded-full border border-white bg-white/80 text-[var(--accent)] hover:bg-white" aria-label={copy.next}><Arrow /></button></div>
        </div>
      </section>
      <div id="languages" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        {languageCards.map(item => <Link href={catalogHref + "?language=" + item.language} key={item.language} className={cx("group relative flex min-h-36 items-center justify-between gap-4 overflow-hidden rounded-3xl border border-black/[.03] p-6 lg:min-h-0", item.className)}>
          <div className="relative z-10 max-w-[190px]"><span className="text-[10px] font-bold uppercase tracking-[.12em] opacity-60">{item.language === "ru" ? "Русский" : "English"}</span><h2 className="mt-2 text-xl font-bold leading-tight tracking-tight">{item.title}</h2><span className="mt-4 flex items-center gap-2 text-xs font-semibold">{copy.languageHint}<Arrow /></span></div>
          <span className="select-none text-8xl font-black leading-none opacity-15 transition group-hover:rotate-6" aria-hidden="true">{item.letter}</span>
        </Link>)}
      </div>
    </section>

    {(!allBooks.length || catalogLoadFailed || categoryLoadFailed || showcaseLoadFailed) && <section className="mt-6 rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-5" role="status" aria-live="polite" aria-busy={refreshing}>
      {(!allBooks.length || catalogLoadFailed) && <><h2 className="text-base font-semibold">{catalogLoadFailed ? copy.error : copy.empty}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{catalogLoadFailed ? copy.errorHint : copy.emptyHint}</p></>}
      {categoryLoadFailed && <p className="mt-1 text-sm text-[var(--muted)]">{copy.categoriesError}</p>}
      {showcaseLoadFailed && <p className="mt-1 text-sm text-[var(--muted)]">{copy.showcaseError}</p>}
      <button type="button" onClick={retry} disabled={refreshing} className={cx(textLink, "mt-1 disabled:opacity-50")}>{refreshing ? copy.loading : copy.retry}<span aria-hidden="true">↻</span></button>
    </section>}

    <BookShelf id="new-arrivals" title={copy.newTitle} description={copy.newText} items={newest.slice(0, 4)} href={newHref} linkLabel={copy.all} emptyTitle={copy.newEmpty} />
    <section data-home-section="new-by-category" className="py-7 sm:py-9">
      <SectionHeader title={copy.categoryNew} description={copy.categoryNewText} href={newHref} linkLabel={copy.all} />
      {newCategories.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{newCategories.map(category => {
        const previews = newest.filter(book => bookInCategory(book, category.supplierCategoryId)).slice(0, 4);
        return <article key={category.supplierCategoryId} className="rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-5">
          <Link href={categoryHref(category, true)} className="flex min-h-11 items-start justify-between gap-3 text-sm font-bold leading-5 hover:text-[var(--accent)]"><h3>{category.name}</h3><Arrow /></Link>
          {previews.length ? <div className="mt-4 grid grid-cols-2 justify-items-center gap-3">{previews.map(book => <Link href={localized(locale, "/books/" + book.slug)} key={book.id} aria-label={book.title} className="rounded-lg p-1 transition hover:-translate-y-1"><BookCover book={book} size="mini" /></Link>)}</div>
            : <div className="mt-4 flex min-h-28 items-center gap-3 rounded-xl bg-[var(--accent-soft)] p-4 text-xs leading-5 text-[var(--muted)]"><OpenBook className="size-7 shrink-0 text-[var(--accent)]" />{copy.categoryNewEmpty}</div>}
        </article>;
      })}</div> : <EmptyCollection title={copy.categoryEmpty} hint={copy.categoryEmptyHint} href={localized(locale, "/search")} label={copy.open} />}
    </section>

    <section data-home-section="top-categories" className="py-7 sm:py-9">
      <SectionHeader title={copy.topCategories} href={catalogHref} linkLabel={copy.catalog} />
      {topCategories.length ? <div className="grid gap-4 sm:grid-cols-3">{topCategories.map((category, index) => <Link key={category.supplierCategoryId} href={categoryHref(category)} className={cx("group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-2xl border border-black/[.03] p-6", ["bg-[#efedff]", "bg-[#e9f4ff]", "bg-[#fff1e7]"][index])}>
        <span className="text-xs font-semibold text-[var(--muted)]">0{index + 1}</span><OpenBook className="absolute -right-3 top-3 size-28 rotate-12 text-[var(--accent)] opacity-10 transition group-hover:rotate-6" />
        <div className="relative mt-6 flex items-end justify-between gap-4"><h3 className="max-w-[230px] text-lg font-bold leading-snug">{category.name}</h3><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/80 text-[var(--accent)]"><Arrow /></span></div>
      </Link>)}</div> : <EmptyCollection title={copy.categoryEmpty} hint={copy.categoryEmptyHint} href={catalogHref} label={copy.catalog} />}
    </section>

    <section data-home-section="promotions" className="grid gap-4 py-7 sm:grid-cols-2 sm:py-9" aria-label={copy.carousel}>
      {[
        { title: copy.armenianPromo, text: copy.armenianText, href: catalogHref + "?language=hy", letter: "Ա", className: "bg-[#6258ff] text-white" },
        { title: copy.giftPromo, text: copy.giftText, href: catalogHref, letter: "↗", className: "bg-[#e9edff] text-[#32295e]" },
      ].map(promo => <Link href={promo.href} className={cx("group relative min-h-48 overflow-hidden rounded-3xl p-7", promo.className)} key={promo.title}>
        <div className="relative z-10 max-w-[75%]"><h2 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{promo.title}</h2><p className="mt-3 text-sm leading-6 opacity-75">{promo.text}</p><span className="mt-5 inline-flex min-h-10 items-center gap-3 text-sm font-semibold">{copy.open}<Arrow /></span></div>
        <span className="absolute -bottom-5 right-4 select-none text-[170px] font-black leading-none opacity-15 transition group-hover:-rotate-6" aria-hidden="true">{promo.letter}</span>
      </Link>)}
    </section>

    <section id="publishers" data-home-section="publishers" className="scroll-mt-40 py-7 sm:py-9">
      <SectionHeader title={copy.publishers} />
      {publisherNames.length ? <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{publisherNames.map(publisher => <Link key={publisher} href={catalogHref + "?publisher=" + encodeURIComponent(publisher)} className="flex min-h-24 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] px-4 py-5 text-center text-base font-bold leading-snug tracking-tight text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">{publisher}</Link>)}</div>
        : <EmptyCollection title={copy.publisherEmpty} href={catalogHref} label={copy.catalog} />}
    </section>

    <BookShelf id="publisher-books" title={copy.publisherPresents} description={copy.publisherText} items={publisherBooks} href={catalogHref} linkLabel={copy.all} emptyTitle={copy.publisherEmpty} />
    <BookShelf id="other-products" title={copy.otherTitle} description={copy.otherText} items={accessories} href={catalogHref} linkLabel={copy.catalog} emptyTitle={copy.otherEmpty} emptyHint={copy.otherHint} />
    <section data-home-section="discounts" className="py-7 sm:py-9">
      <SectionHeader title={copy.discountTitle} />
      <EmptyCollection title={copy.discountEmpty} hint={copy.discountHint} href={catalogHref} label={copy.catalog} />
    </section>
    <BookShelf id="special-selection" title={copy.specialTitle} description={copy.specialText} items={offers} href={catalogHref + "?sort=price-asc"} linkLabel={copy.specialLink} emptyTitle={copy.empty} emptyHint={copy.emptyHint} />

    <section id="delivery" data-home-section="delivery-promotion" className="mt-7 flex scroll-mt-40 flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-[#26213d] p-7 text-white sm:mt-9 sm:p-9">
      <div className="max-w-2xl"><span className="text-xs font-semibold uppercase tracking-[.1em] text-[#b8b0ff]">{brandName(locale)}</span><h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{copy.finalTitle}</h2><p className="mt-3 max-w-xl text-sm leading-7 text-white/65">{copy.finalText}</p></div>
      <div className="flex flex-wrap gap-3"><Link className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-white px-5 text-sm font-semibold text-[#352b60] hover:bg-[#f0edff]" href={localized(locale, "/information")}>{copy.finalCta}<Arrow /></Link><Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/25 px-5 text-sm font-semibold hover:bg-white/10" href={catalogHref}>{copy.finalCatalog}</Link></div>
    </section>
  </div>;
}
