"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { brandName } from "../../lib/brand";
import type { Book, CatalogCategory } from "../../lib/types";
import { storefrontFacets } from "../../lib/catalog-data";
import { BookCard } from "./BookCard";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, type Locale } from "./i18n";
import { container, cx, eyebrow, primaryButton, sectionTitle } from "./ui";

const marketCopy = {
  ru: {
    bookStories: "Книги и истории",
    label: "Небольшая пауза. Большая история.",
    title: "Между делами", titleAccent: "— целый мир.",
    intro: "Книги, к которым хочется возвращаться. Найдите свою историю на армянском, русском или английском — мы привезём её по Еревану.",
    browse: "Найти свою книгу", explore: "Заглянуть на полку", note: "Для вашей\nследующей главы",
    selection: "Открывайте новое", shelf: "Ваша следующая история",
    shelfText: "Знакомые авторы, неожиданные открытия и книги для себя.",
    all: "Весь каталог", categories: "Что вам интересно?",
    categoryLabel: "Выбирайте по настроению", categoryLink: "Открыть раздел",
    giftLabel: "Больше, чем просто страницы", giftTitle: "Лучшие подарки\nначинаются с книги.",
    giftText: "Для близкого человека. Для нового увлечения. Или просто для себя — без особого повода.",
    giftCta: "Выбрать книгу в подарок", giftNote: "С любовью к хорошим историям",
    affordable: "Маленькие радости", affordableTitle: "Ещё немного книжного счастья",
    affordableText: "Начните с книг по доступной цене.",
    languages: "Три языка. Столько историй.", languageLabel: "Читайте на своём языке",
    publishers: "Издательства на нашей полке",
    stepsLabel: "Всё просто", stepsTitle: "Вы выбираете.\nМы привозим.",
    steps: [["Найдите свою книгу", "Выберите историю и добавьте её в корзину."], ["Оставьте пару деталей", "Имя, телефон и адрес в Ереване. Мы позвоним и подтвердим наличие."], ["Встречайте новые страницы", "Доставку согласуем по телефону. Оплата наличными при получении."]],
    service: [["Книги на трёх языках", "Հայերեն · Русский · English"], ["Доставка по Еревану", "1 000 ֏ за заказ"], ["Оплата при получении", "Наличными, после подтверждения"]],
    faq: "Есть вопросы?", faqText: "Всё важное перед первой покупкой.", contact: "Связаться с нами",
    questions: [["Когда подтвердят мой заказ?", "После оформления мы свяжемся с вами, уточним наличие книг и детали доставки."], ["Как узнать итоговую стоимость?", "Стоимость книг и доставка показаны в корзине до оформления. Если цена изменится, попросим подтвердить новую сумму."], ["Куда вы доставляете?", "Доставляем по Еревану за 1 000 ֏. Время доставки согласуем при подтверждении заказа."]],
    advanced: "Ищете конкретную книгу?", advancedText: "Найдите её по автору, названию или ISBN.", search: "Расширенный поиск",
  },
  hy: {
    bookStories: "Գրքեր և պատմություններ",
    label: "Փոքր դադար։ Մեծ պատմություն։",
    title: "Ձեր հաջորդ", titleAccent: "պատմությունը։",
    intro: "Գրքեր, որոնց ուզում ես վերադառնալ։ Գտեք ձեր պատմությունը հայերեն, ռուսերեն կամ անգլերեն․ մենք այն կառաքենք Երևանում։",
    browse: "Գտնել իմ գիրքը", explore: "Բացահայտել գրքերը", note: "Ձեր հաջորդ\nգլխի համար",
    selection: "Բացահայտեք նորը", shelf: "Ձեր հաջորդ պատմությունը",
    shelfText: "Սիրելի հեղինակներ, անսպասելի բացահայտումներ և գրքեր ձեզ համար։",
    all: "Ամբողջ կատալոգը", categories: "Ի՞նչն է ձեզ հետաքրքրում",
    categoryLabel: "Ընտրեք ըստ տրամադրության", categoryLink: "Բացել բաժինը",
    giftLabel: "Ավելին, քան պարզապես էջեր", giftTitle: "Լավագույն նվերները\nսկսվում են գրքից։",
    giftText: "Սիրելի մարդու համար։ Նոր հետաքրքրության համար։ Կամ պարզապես ձեզ համար՝ առանց առիթի։",
    giftCta: "Ընտրել գիրք նվերի համար", giftNote: "Լավ պատմությունների հանդեպ սիրով",
    affordable: "Փոքրիկ ուրախություններ", affordableTitle: "Եվս մի փոքր գրքային երջանկություն",
    affordableText: "Սկսեք մատչելի գրքերից։",
    languages: "Երեք լեզու։ Անթիվ պատմություններ։", languageLabel: "Կարդացեք ձեր լեզվով",
    publishers: "Հրատարակիչները մեր դարակում",
    stepsLabel: "Ամեն ինչ պարզ է", stepsTitle: "Դուք ընտրում եք։\nՄենք առաքում ենք։",
    steps: [["Գտեք ձեր գիրքը", "Ընտրեք պատմությունը և ավելացրեք զամբյուղ։"], ["Նշեք մի քանի տվյալ", "Անուն, հեռախոս և Երևանի հասցեն։ Կզանգենք՝ առկայությունը հաստատելու համար։"], ["Դիմավորեք նոր էջերը", "Առաքումը համաձայնեցնում ենք հեռախոսով։ Վճարումը՝ կանխիկ, ստանալիս։"]],
    service: [["Գրքեր երեք լեզվով", "Հայերեն · Ռուսերեն · Անգլերեն"], ["Առաքում Երևանում", "1 000 ֏ մեկ պատվերի համար"], ["Վճարում ստանալիս", "Կանխիկ՝ հաստատումից հետո"]],
    faq: "Հարցեր ունե՞ք", faqText: "Կարևորը՝ առաջին գնումից առաջ։", contact: "Կապվել մեզ հետ",
    questions: [["Ե՞րբ կհաստատվի իմ պատվերը", "Պատվերը ձևակերպելուց հետո կկապվենք ձեզ հետ՝ ճշտելու գրքերի առկայությունն ու առաքման մանրամասները։"], ["Ինչպե՞ս իմանալ վերջնական գումարը", "Գրքերի արժեքն ու առաքումը երևում են զամբյուղում՝ մինչև պատվիրելը։ Եթե գինը փոխվի, կխնդրենք հաստատել նոր գումարը։"], ["Որտե՞ղ եք առաքում", "Առաքում ենք Երևանում՝ 1 000 ֏ արժեքով։ Առաքման ժամը համաձայնեցնում ենք պատվերը հաստատելիս։"]],
    advanced: "Կոնկրետ գի՞րք եք փնտրում", advancedText: "Գտեք այն ըստ հեղինակի, անվանման կամ ISBN-ի։", search: "Ընդլայնված որոնում",
  },
  en: {
    bookStories: "Books & stories",
    label: "A little pause. A bigger world.",
    title: "Make room for", titleAccent: "a good story.",
    intro: "Books you'll want to come back to. Find your next read in Armenian, Russian or English — delivered to your door in Yerevan.",
    browse: "Find your next read", explore: "Explore the shelves", note: "For your\nnext chapter",
    selection: "Something to discover", shelf: "Your next chapter starts here",
    shelfText: "Familiar voices, unexpected discoveries and a little time for yourself.",
    all: "Browse all books", categories: "What are you curious about?",
    categoryLabel: "Follow your curiosity", categoryLink: "Explore category",
    giftLabel: "More than just pages", giftTitle: "The best gifts\nstart with a book.",
    giftText: "For someone you love. For a new curiosity. Or simply for yourself — no occasion needed.",
    giftCta: "Find a book to give", giftNote: "With love for a good story",
    affordable: "Little everyday joys", affordableTitle: "A little more book happiness",
    affordableText: "Good places to start, at an approachable price.",
    languages: "Three languages. Endless stories.", languageLabel: "Read in your own words",
    publishers: "Publishers on our shelves",
    stepsLabel: "Keep it simple", stepsTitle: "You choose.\nWe bring the books.",
    steps: [["Find your next read", "Choose a story and add it to your cart."], ["Share a few details", "Your name, phone and Yerevan address. We'll call to confirm availability."], ["Welcome a new chapter", "Delivery is arranged by phone. Pay in cash when your books arrive."]],
    service: [["Books in three languages", "Armenian · Russian · English"], ["Delivery in Yerevan", "1,000 ֏ per order"], ["Pay on arrival", "Cash, after confirmation"]],
    faq: "A few good questions", faqText: "The essentials before your first order.", contact: "Get in touch",
    questions: [["When is my order confirmed?", "After checkout, we contact you to confirm the books and delivery details."], ["Where can I see the final price?", "Book prices and delivery are shown in your cart before checkout. If a price changes, we'll ask you to confirm the new total."], ["Where do you deliver?", "We deliver across Yerevan for 1,000 ֏. Delivery time is agreed when we confirm your order."]],
    advanced: "Looking for a particular book?", advancedText: "Find it by title, author or ISBN.", search: "Advanced search",
  },
} as const;

function Arrow({ className = "" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" className={cx("size-5 shrink-0", className)} aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function BookShelf({ overline, title, text, items, allLabel, allHref, id }: {
  overline: string; title: string; text: string; items: Book[]; allLabel: string; allHref: string; id?: string;
}) {
  if (items.length === 0) return null;
  return <section id={id} className={cx(container, "scroll-mt-40 xl:scroll-mt-44 py-16 sm:py-20")}>
    <div className="mb-8 flex items-end justify-between gap-5 sm:mb-10">
      <div><span className={eyebrow}>{overline}</span><h2 className={cx(sectionTitle, "mt-4")}>{title}</h2><p className="mt-3 max-w-lg text-sm leading-6 text-[#626e64]">{text}</p></div>
      <Link href={allHref} className="hidden min-h-11 shrink-0 items-center gap-4 border-b border-[#243e35] text-sm font-medium text-[#243e35] sm:inline-flex">{allLabel}<Arrow /></Link>
    </div>
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-6">
      {items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}
    </div>
    <Link href={allHref} className="mt-8 flex min-h-12 items-center justify-center gap-4 rounded-full border border-[#c8d0c3] text-sm font-medium sm:hidden">{allLabel}<Arrow /></Link>
  </section>;
}

const catalogStatusCopy = {
  ru: { empty: "Книги скоро появятся", emptyHint: "Сейчас в каталоге нет доступных книг. Загляните немного позже.", error: "Не удалось загрузить книги", errorHint: "Каталог временно недоступен. Попробуйте обновить страницу.", categories: "Не удалось загрузить все разделы каталога.", retry: "Попробовать снова", loading: "Обновляем…" },
  hy: { empty: "Գրքերը շուտով կհայտնվեն", emptyHint: "Այս պահին կատալոգում հասանելի գրքեր չկան։ Այցելեք մի փոքր ուշ։", error: "Չհաջողվեց բեռնել գրքերը", errorHint: "Կատալոգը ժամանակավորապես հասանելի չէ։ Փորձեք թարմացնել էջը։", categories: "Չհաջողվեց բեռնել կատալոգի բոլոր բաժինները։", retry: "Կրկին փորձել", loading: "Թարմացնում ենք…" },
  en: { empty: "Books will be here soon", emptyHint: "There are no available books in the catalog right now. Please check back later.", error: "We could not load the books", errorHint: "The catalog is temporarily unavailable. Please try refreshing.", categories: "Some catalog categories could not be loaded.", retry: "Try again", loading: "Refreshing…" },
} as const;


export type HomePageProps = {
  books: Book[];
  categories?: CatalogCategory[];
  catalogLoadFailed?: boolean;
  categoryLoadFailed?: boolean;
};

export function HomePage({ books, categories = [], catalogLoadFailed = false, categoryLoadFailed = false }: HomePageProps) {
  const { locale } = useStorefront();
  const copy = marketCopy[locale];
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const status = catalogStatusCopy[locale];
  const retry = () => startRefresh(() => router.refresh());
  const liveBooks = books;
  const heroBooks = liveBooks.slice(0, 3);
  const newest = liveBooks.slice(0, 4);
  const offers = [...liveBooks].sort((a, b) => a.price - b.price).slice(0, 4);
  const publisherNames = [...new Set(liveBooks.map((book) => book.publisher?.trim()).filter((name): name is string => Boolean(name)))].slice(0, 6);
  const featuredCategories = [...liveBooks.flatMap((book) => book.categories ?? []), ...categories]
    .filter((category, index, all) => category.supplierCategoryId !== "7463" && all.findIndex((item) => item.supplierCategoryId === category.supplierCategoryId) === index)
    .slice(0, 4);
  const catalogHref = localized(locale, "/catalog");
  const languageNames: Record<Locale, string> = { hy: "Հայերեն", ru: "Русский", en: "English" };

  return <>
    <section className="editorial-hero">
      <div className={cx(container, "grid items-center gap-10 pb-12 pt-10 lg:grid-cols-[1.02fr_1fr] lg:gap-16 lg:pb-16 lg:pt-12")}>
        <div className="relative z-10 max-w-[650px]">
          <span className={eyebrow}>{copy.label}</span>
          <h1 className={cx("font-display mt-6 tracking-[-.055em]", locale === "hy" ? "text-[clamp(2.5rem,4.2vw,4.5rem)] leading-[1.12]" : "text-[clamp(3.1rem,5.8vw,5.8rem)] leading-[1.02]")}>{copy.title}<em className="mt-1 block font-normal text-[#66816b]">{copy.titleAccent}</em></h1>
          <p className="mt-6 max-w-[420px] text-[15px] leading-7 text-[#626e64]">{copy.intro}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
            <Link className={primaryButton} href={catalogHref}>{copy.browse}<Arrow /></Link>
            <a className="inline-flex min-h-12 items-center gap-2 text-sm font-medium text-[#243e35]" href={newest.length ? "#on-the-shelf" : "#languages"}>{copy.explore}<span aria-hidden="true">↓</span></a>
          </div>
          <div className="mt-9 flex items-center gap-3 text-xs tracking-wide max-sm:hidden text-[#626e64]">
            <span className="inline-flex -space-x-1.5" aria-hidden="true">{["Ա", "Я", "A"].map((letter) => <i key={letter} className="font-display grid size-8 place-items-center rounded-full border-2 border-[#f7f5f0] bg-[#e3e8db] text-sm not-italic text-[#526449]">{letter}</i>)}</span>
            <span>Հայերեն · Русский · English</span>
          </div>
        </div>
        <div className="relative min-w-0 lg:pl-2">
          <div className="reading-stage">
            {heroBooks.map((book, index) => <Link href={localized(locale, "/books/" + book.slug)} key={book.id} className={cx("hero-book", ["hero-book-center", "hero-book-left", "hero-book-right"][index])}><BookCover book={book} size="hero" /></Link>)}
            {heroBooks.length === 0 && <svg className="absolute inset-0 m-auto w-[65%] text-[#718367]" viewBox="0 0 320 240" fill="none" aria-hidden="true"><path d="M160 199V63M160 63C123 29 77 28 33 41v140c45-13 89-11 127 18 38-29 82-31 127-18V41c-44-13-90-12-127 22Z" stroke="currentColor" strokeWidth="2" /><path d="m50 59 91 22m-91 3 91 23m-91 4 91 22m38-52 91-22m-91 48 91-23m-91 49 91-22" stroke="currentColor" opacity=".5" /><path d="M215 21v98l19-17 17 10V17" fill="#e9bf71" /></svg>}
            <span className="absolute bottom-5 left-6 z-10 text-[10px] font-medium uppercase tracking-[.12em] text-[#655e4a]">{brandName(locale)} · {copy.bookStories}</span>
          </div>
          <div className="reading-note flex size-[104px] items-center justify-center rounded-full bg-[#e9bf71] p-3 text-center text-[11px] font-medium leading-4 text-[#3d4635] shadow-[0_8px_20px_#3d463515] sm:size-[112px]"><span className="whitespace-pre-line">{copy.note}<span className="mt-1 block text-lg" aria-hidden="true">✳</span></span></div>
        </div>
      </div>
    </section>

    <section className="border-b border-[#dedfd5] bg-[#f0f0e8]">
      <div className={cx(container, "grid gap-5 py-6 sm:grid-cols-3 sm:gap-8")}>
        {copy.service.map(([title, subtitle], index) => <div key={title} className="flex items-center gap-4 sm:justify-center">
          <svg className="size-8 shrink-0 text-[#66816b]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">{index === 0 ? <><path d="M16 25V9C11 5 6 5 3 6v18c4-1 8-1 13 1Zm0 0V9c5-4 10-4 13-3v18c-4-1-8-1-13 1Z" /></> : index === 1 ? <><path d="M2 8h17v16H2V8Zm17 5h6l5 6v5H19" /><circle cx="8" cy="25" r="3" fill="#f0f0e8" /><circle cx="24" cy="25" r="3" fill="#f0f0e8" /></> : <><rect x="3" y="6" width="26" height="20" rx="3" /><path d="M3 12h26m-19 7h7" /></>}</svg>
          <div><h2 className="text-sm font-medium">{title}</h2><p className="mt-1 text-xs text-[#626e64]">{subtitle}</p></div>
        </div>)}
      </div>
    </section>

    {(books.length === 0 || catalogLoadFailed || categoryLoadFailed) && <section className={cx(container, "pt-10")} aria-live="polite" aria-busy={refreshing}>
      <div className="flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#dedfd5] bg-[#fffefa] p-6">
        <div>{books.length === 0 || catalogLoadFailed ? <><h2 className="font-display text-2xl">{catalogLoadFailed ? status.error : status.empty}</h2><p className="mt-2 text-sm leading-6 text-[#626e64]">{catalogLoadFailed ? status.errorHint : status.emptyHint}</p></> : null}{categoryLoadFailed && <p className="mt-2 text-sm text-[#626e64]">{status.categories}</p>}</div>
        <button type="button" disabled={refreshing} onClick={retry} className={primaryButton}>{refreshing ? status.loading : status.retry}</button>
      </div>
    </section>}

    <BookShelf id="on-the-shelf" overline={copy.selection} title={copy.shelf} text={copy.shelfText} items={newest} allLabel={copy.all} allHref={catalogHref} />

    {featuredCategories.length > 0 && <section className={cx(container, "pb-16 sm:pb-20")}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><span className={eyebrow}>{copy.categoryLabel}</span><h2 className={cx(sectionTitle, "mt-4")}>{copy.categories}</h2></div><Link className="inline-flex min-h-11 items-center gap-3 text-sm font-medium" href={catalogHref}>{copy.all}<Arrow /></Link></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {featuredCategories.map((category, index) => <Link key={category.supplierCategoryId} href={catalogHref + "?category=" + encodeURIComponent(category.supplierCategoryId)} className="category-tile flex min-h-[176px] flex-col rounded-2xl border border-[#dedfd5] bg-[#f0f0e8] p-5">
          <span className="flex items-center justify-between text-xs text-[#626e64]"><span>0{index + 1}</span><Arrow className="-rotate-45" /></span>
          <h3 className="font-display mt-auto pt-6 text-[23px] leading-[1.15] tracking-tight">{category.name}</h3>
          <span className="mt-3 text-xs text-[#626e64]">{copy.categoryLink}</span>
        </Link>)}
      </div>
    </section>}

    <section id="about" className={cx(container, "scroll-mt-40 xl:scroll-mt-44 pb-5 pt-7")}>
      <div className="gift-display relative grid overflow-hidden rounded-[22px] text-[#fff8e8] md:grid-cols-[1.15fr_.85fr]">
        <div className="relative z-10 px-7 py-10 sm:px-12 sm:py-14">
          <span className="editorial-rule text-xs uppercase tracking-[.14em] text-[#c1cdbb]">{copy.giftLabel}</span>
          <h2 className="font-display mt-6 whitespace-pre-line text-[clamp(2.4rem,4.4vw,4.1rem)] leading-[1.07] tracking-[-.04em]">{copy.giftTitle}</h2>
          <p className="mt-5 max-w-[370px] text-sm leading-7 text-[#c1cdbb]">{copy.giftText}</p>
          <Link className="mt-7 inline-flex min-h-12 items-center justify-center gap-5 rounded-full bg-[#e9bf71] px-6 text-sm font-medium text-[#243e35] transition hover:bg-[#f1cc89]" href={catalogHref}>{copy.giftCta}<Arrow /></Link>
        </div>
        <div className="relative flex min-h-[260px] items-center justify-center px-8 pb-10 md:pb-0" aria-hidden="true">
          {heroBooks.length ? <div className="relative w-[170px] rotate-[10deg] drop-shadow-[12px_18px_18px_#12241c60] sm:w-[190px]">
            <BookCover book={heroBooks[1] ?? heroBooks[0]} size="hero" />
            <span className="absolute -inset-x-2 top-[43%] h-[36px] -rotate-[1deg] bg-[#ede4ca]/95 shadow-sm" />
            <span className="absolute bottom-[-16px] left-[-38px] w-[150px] -rotate-[18deg] rounded-sm bg-[#fff8e8] px-4 py-3 text-center font-display text-sm text-[#243e35] shadow-md">{copy.giftNote}</span>
          </div> : <span className="font-display text-[180px] italic leading-none text-[#e9bf71]">Aa</span>}
        </div>
      </div>
    </section>

    <BookShelf id="news" overline={copy.affordable} title={copy.affordableTitle} text={copy.affordableText} items={offers} allLabel={copy.all} allHref={catalogHref + "?sort=price-asc"} />

    <section id="languages" className="scroll-mt-40 xl:scroll-mt-44 border-y border-[#dedfd5] bg-[#eeeede]">
      <div className={cx(container, "py-12 sm:py-16")}>
        <div className="mb-8 text-center"><span className="text-xs uppercase tracking-[.16em] text-[#626e64]">{copy.languageLabel}</span><h2 className={cx(sectionTitle, "mt-3")}>{copy.languages}</h2></div>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">{storefrontFacets.slice(0, 3).map((facet, index) => <Link className="group flex min-h-[105px] items-center justify-between gap-4 rounded-xl border border-[#d3d8c8] bg-[#f7f5f0]/65 px-6 py-5 transition hover:bg-[#fffefa]" key={facet.slug} href={catalogHref + "?language=" + facet.slug}>
          <span className="flex items-center gap-4"><span className="font-display text-5xl text-[#8c9a7a]">{["Ա", "Я", "A"][index]}</span><span className="text-base font-medium">{languageNames[facet.slug as Locale]}</span></span><Arrow className="transition group-hover:translate-x-1" />
        </Link>)}</div>
      </div>
    </section>

    {publisherNames.length > 0 && <section className={cx(container, "border-b border-[#dedfd5] py-10")}><h2 className="text-center text-xs uppercase tracking-[.15em] text-[#626e64]">{copy.publishers}</h2><div className="mt-6 flex flex-wrap justify-center gap-x-12 gap-y-4">{publisherNames.map((publisher) => <Link key={publisher} href={catalogHref + "?q=" + encodeURIComponent(publisher)} className="font-display inline-flex min-h-11 items-center text-2xl text-[#697362] transition hover:text-[#243e35]">{publisher}</Link>)}</div></section>}

    <section id="delivery" className={cx(container, "grid scroll-mt-40 xl:scroll-mt-44 gap-10 py-16 lg:grid-cols-[.85fr_1.15fr] lg:gap-20 sm:py-20")}>
      <div><span className={eyebrow}>{copy.stepsLabel}</span><h2 className={cx(sectionTitle, "mt-5 whitespace-pre-line")}>{copy.stepsTitle}</h2><Link href={localized(locale, "/information")} className="mt-7 inline-flex min-h-11 items-center gap-4 text-sm font-medium underline underline-offset-8">{dictionary[locale].footer.information}<Arrow /></Link></div>
      <div>{copy.steps.map(([title, text], index) => <article className="flex gap-6 border-b border-[#dedfd5] py-6 first:pt-0 last:border-0 last:pb-0" key={title}><span className="font-display text-3xl text-[#99a48a]">0{index + 1}</span><div><h3 className="text-base font-medium">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-[#626e64]">{text}</p></div></article>)}</div>
    </section>

    <section id="faq" className="scroll-mt-40 xl:scroll-mt-44 border-t border-[#dedfd5] bg-[#f0f0e8]">
      <div className={cx(container, "grid gap-8 py-14 lg:grid-cols-[.85fr_1.15fr] lg:gap-20")}>
        <div><h2 className={sectionTitle}>{copy.faq}</h2><p className="mt-4 text-sm leading-6 text-[#626e64]">{copy.faqText}</p><Link href={localized(locale, "/contacts")} className="mt-6 inline-flex min-h-11 items-center gap-4 text-sm font-medium">{copy.contact}<Arrow /></Link></div>
        <div>{copy.questions.map(([question, answer]) => <details className="group border-b border-[#d9ddd0] py-5 first:pt-0 last:border-0" key={question}><summary className="flex min-h-11 list-none items-center justify-between gap-5 text-[15px] font-medium [&::-webkit-details-marker]:hidden">{question}<span className="text-xl font-light transition group-open:rotate-45" aria-hidden="true">+</span></summary><p className="max-w-xl pb-2 pt-4 text-sm leading-7 text-[#626e64]">{answer}</p></details>)}</div>
      </div>
    </section>

    <section id="contacts" className={cx(container, "flex flex-wrap items-center justify-between gap-6 py-10")}>
      <div><h2 className="font-display text-2xl tracking-tight">{copy.advanced}</h2><p className="mt-2 text-sm text-[#626e64]">{copy.advancedText}</p></div><Link className="inline-flex min-h-12 items-center gap-4 rounded-full border border-[#bcc6b5] px-6 text-sm font-medium" href={localized(locale, "/search")}>{copy.search}<Arrow /></Link>
    </section>
  </>;
}
