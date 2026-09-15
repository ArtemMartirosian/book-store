"use client";

import Link from "next/link";
import type { Book, CatalogCategory } from "../../lib/types";
import { books as fallbackBooks, storefrontFacets } from "../../lib/catalog-data";
import { BookCard } from "./BookCard";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, type Locale } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

const marketCopy: Record<Locale, {
  newBySection: string;
  topSections: string;
  topSectionsText: string;
  topPublishers: string;
  topPublishersText: string;
  publisherPicks: string;
  publisherPicksText: string;
  other: string;
  otherText: string;
  offers: string;
  offersText: string;
  recommended: string;
  recommendedText: string;
  journal: string;
  journalText: string;
  journalCards: Array<[string, string, string]>;
  read: string;
  faq: string;
  faqText: string;
  questions: Array<[string, string]>;
  advanced: string;
  advancedText: string;
  noPublisher: string;
}> = {
  ru: {
    newBySection: "Новинки по разделам",
    topSections: "Рейтинговые разделы",
    topSectionsText: "Широкая структура большого книжного каталога — быстрее, чище и удобнее на телефоне.",
    topPublishers: "Рейтинговые издательства",
    topPublishersText: "Издательства, представленные среди последних обновлений живого каталога.",
    publisherPicks: "Предложения издательств",
    publisherPicksText: "Свежие издания от представленных в каталоге издательств.",
    other: "Другие разделы",
    otherText: "Ещё больше направлений из полной иерархии книжного каталога.",
    offers: "Специальные предложения",
    offersText: "Книги с наиболее доступной текущей ценой — без выдуманных скидок и зачёркнутых цен.",
    recommended: "Рекомендуем",
    recommendedText: "Ещё несколько сильных книг из живого каталога.",
    journal: "Книжный журнал",
    journalText: "Гиды и идеи, которые помогают выбрать следующую книгу.",
    journalCards: [
      ["Гид по подаркам", "Как выбрать книгу в подарок и не ошибиться с изданием.", "01"],
      ["Новая полка", "На что обратить внимание среди последних поступлений.", "02"],
      ["Читаем вместе", "Три способа превратить чтение в устойчивую привычку.", "03"],
    ],
    read: "Смотреть подборку",
    faq: "Частые вопросы",
    faqText: "Коротко о заказе, наличии и доставке.",
    questions: [
      ["Цена и наличие окончательные?", "Наличие предварительное. Перед оформлением оператор сверяет издание и подтверждает итоговую сумму."],
      ["Как подтверждается заказ?", "Оператор проверит наличие, итоговую сумму и свяжется с вами."],
      ["Куда вы доставляете?", "Сейчас доставка работает по Еревану. Доступное время согласует оператор."],
    ],
    advanced: "Расширенный поиск",
    advancedText: "Название, автор, ISBN, штрих-код или код товара.",
    noPublisher: "Другие издательства",
  },
  hy: {
    newBySection: "Նորույթներ ըստ բաժինների",
    topSections: "Վարկանիշային բաժիններ",
    topSectionsText: "Մեծ գրախանութի ամբողջական կատալոգը՝ ավելի արագ, մաքուր և հարմար բջջային տարբերակով։",
    topPublishers: "Վարկանիշային հրատարակիչներ",
    topPublishersText: "Կատալոգի վերջին թարմացումներում ներկայացված հրատարակիչները։",
    publisherPicks: "Հրատարակիչների առաջարկներ",
    publisherPicksText: "Թարմ հրատարակություններ կատալոգում ներկայացված հրատարակիչներից։",
    other: "Այլ բաժիններ",
    otherText: "Ավելի շատ ուղղություններ գրքային կատալոգի ամբողջական կառուցվածքից։",
    offers: "Հատուկ առաջարկներ",
    offersText: "Առավել մատչելի ընթացիկ գներով գրքերը՝ առանց հորինված զեղչերի։",
    recommended: "Խորհուրդ ենք տալիս",
    recommendedText: "Եվս մի քանի ուշագրավ գիրք կենդանի կատալոգից։",
    journal: "Գրքային ամսագիր",
    journalText: "Ուղեցույցներ և գաղափարներ՝ հաջորդ գիրքն ընտրելու համար։",
    journalCards: [
      ["Նվերի ուղեցույց", "Ինչպես ընտրել գիրք նվերի համար և չսխալվել հրատարակության հարցում։", "01"],
      ["Նոր դարակ", "Ինչին ուշադրություն դարձնել վերջին համալրումներում։", "02"],
      ["Կարդում ենք միասին", "Ընթերցանությունը սովորություն դարձնելու երեք եղանակ։", "03"],
    ],
    read: "Դիտել ընտրանին",
    faq: "Հաճախ տրվող հարցեր",
    faqText: "Հակիրճ՝ պատվերի, առկայության և առաքման մասին։",
    questions: [
      ["Գինը և առկայությունը վերջնակա՞ն են", "Առկայությունը նախնական է։ Օպերատորը ստուգում է հրատարակությունը և հաստատում վերջնական գումարը։"],
      ["Ինչպե՞ս է հաստատվում պատվերը", "Օպերատորը կճշտի առկայությունն ու վերջնական գումարը և կկապվի ձեզ հետ։"],
      ["Որտե՞ղ եք առաքում", "Այս պահին առաքումն իրականացվում է Երևանում։ Ժամը համաձայնեցվում է օպերատորի հետ։"],
    ],
    advanced: "Ընդլայնված որոնում",
    advancedText: "Անվանում, հեղինակ, ISBN, շտրիխ կոդ կամ ապրանքի կոդ։",
    noPublisher: "Այլ հրատարակիչներ",
  },
  en: {
    newBySection: "New by department",
    topSections: "Top departments",
    topSectionsText: "The breadth of a full bookstore catalog, rebuilt to feel faster, calmer and easier on mobile.",
    topPublishers: "Top publishers",
    topPublishersText: "Publishers represented in the latest live catalog updates.",
    publisherPicks: "Publisher offers",
    publisherPicksText: "Recent editions from publishers represented in the catalog.",
    other: "Other departments",
    otherText: "More directions from the complete bookstore category structure.",
    offers: "Special offers",
    offersText: "Books with the most accessible current prices—without invented discounts or crossed-out prices.",
    recommended: "Recommended",
    recommendedText: "A few more strong books from the live catalog.",
    journal: "Book journal",
    journalText: "Guides and ideas to help you choose what to read next.",
    journalCards: [
      ["The gift guide", "How to choose a book as a gift and get the edition right.", "01"],
      ["The new shelf", "What to notice among the latest catalog arrivals.", "02"],
      ["Read together", "Three ways to turn reading into a lasting habit.", "03"],
    ],
    read: "View selection",
    faq: "Frequently asked",
    faqText: "The short version on orders, availability and delivery.",
    questions: [
      ["Are price and stock final?", "Availability is preliminary. An operator checks the edition and confirms the final total."],
      ["How is an order confirmed?", "An operator checks availability and the final total, then contacts you."],
      ["Where do you deliver?", "Delivery currently covers Yerevan. An operator agrees the available time with you."],
    ],
    advanced: "Advanced search",
    advancedText: "Title, author, ISBN, barcode or product code.",
    noPublisher: "Other publishers",
  },
};

function BookShelf({ overline, title, text, items, allLabel, allHref, muted = false }: {
  overline: string;
  title: string;
  text: string;
  items: Book[];
  allLabel: string;
  allHref: string;
  muted?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <section className={cx("py-20 max-sm:py-12", muted ? "bg-[#f5f6fb]" : "bg-white")}>
      <div className={container}>
        <div className="mb-10 grid grid-cols-[minmax(0,1fr)_minmax(280px,420px)] items-end gap-10 max-md:grid-cols-1 max-md:gap-5">
          <div><span className={eyebrow}>{overline}</span><h2 className={cx(sectionTitle, "mt-5 max-w-[760px]")}>{title}</h2></div>
          <div><p className="text-[12px] leading-6 text-[#737685]">{text}</p><Link className="mt-5 inline-flex items-center gap-3 text-[9px] font-black uppercase tracking-[.09em] text-[#5147e2]" href={allHref}>{allLabel}<span className="grid size-7 place-items-center rounded-full bg-[#ebe9ff]">↗</span></Link></div>
        </div>
        <div className="book-rail grid grid-cols-4 gap-3 max-lg:grid-cols-3 max-md:grid-cols-2 max-sm:grid-flow-col max-sm:grid-cols-none max-sm:auto-cols-[76%] max-sm:overflow-x-auto max-sm:pb-4">
          {items.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}
        </div>
      </div>
    </section>
  );
}

const tileColors = [
  "bg-[#d9ff69] text-[#151722]",
  "bg-[#6258ff] text-white",
  "bg-[#151722] text-white",
  "bg-[#dfe6ff] text-[#151722]",
  "bg-[#ffd9cd] text-[#151722]",
  "bg-[#e6e3ff] text-[#151722]",
];

export function HomePage({ books, categories = [] }: { books: Book[]; categories?: CatalogCategory[] }) {
  const { locale } = useStorefront();
  const t = dictionary[locale].home;
  const copy = marketCopy[locale];
  const liveBooks = books.length > 0 ? books : fallbackBooks;
  const [heroBook, companionBook, thirdHeroBook] = liveBooks;
  const newest = liveBooks.slice(0, 4);
  const publisherNames = [...new Set(liveBooks.map((book) => book.publisher?.trim()).filter((value): value is string => Boolean(value)))];
  const featuredPublisher = publisherNames[0];
  const publisherBooks = featuredPublisher ? liveBooks.filter((book) => book.publisher === featuredPublisher).slice(0, 4) : liveBooks.slice(4, 8);
  const offers = [...liveBooks].sort((left, right) => left.price - right.price).slice(0, 4);
  const recommended = liveBooks.slice(12, 16).length > 0 ? liveBooks.slice(12, 16) : liveBooks.slice(4, 8);
  const usedCategoryIds = new Set<string>();
  const bookCategories = liveBooks.flatMap((book) => book.categories ?? []).filter((category) => {
    if (category.supplierCategoryId === "7463" || usedCategoryIds.has(category.supplierCategoryId)) return false;
    usedCategoryIds.add(category.supplierCategoryId);
    return true;
  });
  const fallbackCategories = categories.filter((category) => category.supplierCategoryId !== "7463" && ["7463", "7464", "7481"].includes(category.parentSupplierCategoryId ?? ""));
  const featuredCategories = [...bookCategories, ...fallbackCategories]
    .filter((category, index, all) => all.findIndex((item) => item.supplierCategoryId === category.supplierCategoryId) === index)
    .slice(0, 6);
  const categoryHref = (category: CatalogCategory) => `${localized(locale, "/catalog")}?category=${category.supplierCategoryId}`;
  const facetHref = (facet: (typeof storefrontFacets)[number]) => localized(locale, "/catalog") + "?language=" + facet.slug;

  return (
    <>
      <section className="bg-[#f5f6fb] pb-7 pt-6 max-sm:pb-4 max-sm:pt-3">
        <div className={cx(container, "grid grid-cols-[minmax(0,1.55fr)_minmax(290px,.65fr)] gap-4 max-lg:grid-cols-1")}>
          <div className="lumi-mesh lumi-grid relative min-h-[590px] overflow-hidden rounded-[34px] px-[clamp(1.7rem,4.8vw,4.5rem)] py-[clamp(2rem,5vw,4.2rem)] text-white max-sm:min-h-[650px] max-sm:rounded-[26px]">
            <div className="relative z-20 flex h-full max-w-[62%] flex-col max-md:max-w-full">
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[8px] font-black uppercase tracking-[.13em] backdrop-blur"><i className="size-1.5 rounded-full bg-[#d9ff69]" />{t.heroBadge}</span>
              <h1 className={cx("mt-8 max-w-[800px] text-[clamp(3.5rem,7.2vw,7rem)] font-black leading-[.83] tracking-[-.085em]", locale === "hy" && "text-[clamp(2.9rem,5.7vw,5.7rem)]")}>{t.heroTitle} <em className="block pt-2 not-italic text-[#d9ff69]">{t.heroAccent}</em></h1>
              <p className="mt-7 max-w-[520px] text-[13px] leading-6 text-white/68">{t.heroText}</p>
              <div className="mt-auto flex flex-wrap items-center gap-4 pt-8 max-sm:mb-[235px]">
                <Link className="inline-flex min-h-14 items-center gap-8 rounded-2xl bg-white px-6 text-[9px] font-black uppercase tracking-[.09em] text-[#5147e2] shadow-xl transition hover:-translate-y-1" href={localized(locale, "/catalog")}>{t.shopNow}<span className="text-lg">↗</span></Link>
                <Link className="inline-flex min-h-14 items-center rounded-2xl border border-white/18 bg-white/[.07] px-5 text-[9px] font-black uppercase tracking-[.08em] text-white backdrop-blur" href={localized(locale, "/search")}>{copy.advanced}</Link>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 top-0 w-[42%] max-md:top-auto max-md:h-[255px] max-md:w-full">
              <div className="absolute -bottom-28 -right-20 size-[480px] rounded-full border-[70px] border-white/[.07] max-sm:-bottom-32 max-sm:-right-32" />
              {thirdHeroBook ? <div className="lumi-float-delayed absolute bottom-11 right-[58%] w-[122px] opacity-70 [--book-rotation:-9deg] max-sm:bottom-5 max-sm:right-[65%] max-sm:w-[86px]"><BookCover book={thirdHeroBook} size="hero" /></div> : null}
              {companionBook ? <div className="lumi-float absolute bottom-8 right-[31%] z-10 w-[154px] opacity-90 [--book-rotation:6deg] max-sm:bottom-3 max-sm:right-[35%] max-sm:w-[108px]"><BookCover book={companionBook} size="hero" /></div> : null}
              {heroBook ? <div className="lumi-float-delayed absolute bottom-7 right-[3%] z-20 w-[195px] drop-shadow-[0_30px_25px_rgba(20,15,70,.35)] [--book-rotation:-1deg] max-sm:bottom-2 max-sm:right-[4%] max-sm:w-[132px]"><BookCover book={heroBook} size="hero" /></div> : null}
            </div>
          </div>

          <div className="grid min-h-[590px] grid-rows-[1fr_1fr_auto] gap-4 max-lg:min-h-0 max-lg:grid-cols-2 max-lg:grid-rows-[1fr_auto] max-sm:grid-cols-1">
            {storefrontFacets.slice(0, 2).map((facet, index) => {
              const book = liveBooks.find((item) => item.language === facet.value) ?? liveBooks[index];
              return <Link className={cx("group relative min-h-[230px] overflow-hidden rounded-[28px] p-6 transition hover:-translate-y-1", index === 0 ? "bg-[#d9ff69]" : "bg-[#151722] text-white")} href={facetHref(facet)} key={facet.slug}>
                <span className={cx("text-[8px] font-black uppercase tracking-[.13em]", index === 0 ? "text-[#5c681f]" : "text-white/45")}>{t.facets[index][1]}</span>
                <h2 className="mt-3 max-w-[62%] text-[30px] font-black leading-[.92] tracking-[-.055em]">{t.facets[index][0]}</h2>
                <span className={cx("absolute bottom-5 left-5 grid size-10 place-items-center rounded-full transition group-hover:rotate-45", index === 0 ? "bg-[#151722] text-white" : "bg-[#d9ff69] text-[#151722]")}>↗</span>
                {book ? <div className="absolute -bottom-8 right-3 w-[126px] rotate-[10deg] transition duration-500 group-hover:-translate-y-2 group-hover:rotate-[6deg]"><BookCover book={book} size="hero" /></div> : null}
              </Link>;
            })}
            <Link className="col-span-full flex min-h-24 items-center justify-between gap-4 rounded-[24px] bg-[#e8e6ff] p-5 transition hover:bg-white" href={localized(locale, "/search")}>
              <div><small className="text-[8px] font-black uppercase tracking-[.13em] text-[#756fe0]">{copy.advanced}</small><strong className="mt-1 block max-w-[300px] text-[13px] font-bold tracking-[-.02em]">{copy.advancedText}</strong></div><span className="grid size-11 place-items-center rounded-full bg-white text-[#5147e2] shadow-sm">↗</span>
            </Link>
          </div>
        </div>
        <nav className={cx(container, "book-rail mt-4 flex gap-3 overflow-x-auto pb-1")} aria-label={t.categoryMenu}>
          {storefrontFacets.slice(0, 3).map((facet, index) => <Link className="flex min-h-14 min-w-[240px] flex-1 items-center justify-between rounded-2xl border border-[#e2e4ed] bg-white px-5 text-[10px] font-bold transition hover:border-[#aaa3ff] hover:text-[#5147e2]" href={facetHref(facet)} key={facet.slug}><span className="flex items-center gap-3"><small className="text-[8px] text-[#a0a2af]">0{index + 1}</small>{t.facets[index][0]}</span><span>↗</span></Link>)}
        </nav>
      </section>

      <section className="border-y border-[#e4e5ed] bg-white"><div className={cx(container, "grid grid-cols-4 max-md:grid-cols-2 max-sm:grid-cols-1")}>
        {t.values.map(([title, subtitle], index) => <div className="group flex min-h-28 gap-4 border-r border-[#e8e9f0] px-5 py-6 last:border-r-0 max-sm:border-b max-sm:border-r-0" key={title}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0efff] text-[9px] font-black text-[#5147e2] transition group-hover:bg-[#6258ff] group-hover:text-white">0{index + 1}</span><div><strong className="block text-[13px] font-extrabold tracking-[-.02em]">{title}</strong><small className="mt-1.5 block text-[9px] leading-4 text-[#7f8290]">{subtitle}</small></div></div>)}
      </div></section>

      <BookShelf overline={t.newOverline} title={copy.newBySection} text={t.newText} items={newest} allLabel={t.browseAll} allHref={localized(locale, "/catalog") + "?sort=new"} />

      {featuredCategories.length > 0 ? <section className="bg-[#151722] py-20 text-white max-sm:py-12" id="sections"><div className={container}>
        <div className="grid grid-cols-[.85fr_1.15fr] items-end gap-12 max-lg:grid-cols-1 max-lg:gap-5"><div><span className={cx(eyebrow, "bg-white/8 text-[#d9ff69]")}>LUMI catalog</span><h2 className="mt-5 text-[clamp(2.8rem,5vw,5rem)] font-black leading-[.9] tracking-[-.07em]">{copy.topSections}</h2></div><p className="max-w-[600px] text-[12px] leading-6 text-white/48">{copy.topSectionsText}</p></div>
        <div className="mt-10 grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">{featuredCategories.map((category, index) => {
          const preview = liveBooks.find((book) => book.categories?.some((item) => item.supplierCategoryId === category.supplierCategoryId));
          return <Link className={cx("group relative min-h-[220px] overflow-hidden rounded-[26px] p-6 transition hover:-translate-y-1", tileColors[index % tileColors.length])} href={categoryHref(category)} key={category.supplierCategoryId}><small className="text-[8px] font-black uppercase tracking-[.14em] opacity-50">0{index + 1}</small><h3 className="mt-5 max-w-[75%] text-[clamp(1.5rem,2.4vw,2.4rem)] font-black leading-[.95] tracking-[-.055em]">{category.name}</h3><span className="absolute bottom-5 left-5 grid size-10 place-items-center rounded-full bg-white/18 transition group-hover:rotate-45">↗</span>{preview ? <div className="absolute -bottom-12 -right-1 w-[118px] rotate-[9deg] opacity-85 transition duration-500 group-hover:-translate-y-3"><BookCover book={preview} size="hero" /></div> : <span className="absolute -bottom-8 -right-3 text-[116px] font-black leading-none opacity-[.07]">Aa</span>}</Link>;
        })}</div>
      </div></section> : null}

      <section className="bg-white py-20 max-sm:py-12" id="publishers"><div className={container}>
        <div className="grid grid-cols-[.75fr_1.25fr] gap-12 max-lg:grid-cols-1 max-lg:gap-7"><div><span className={eyebrow}>{copy.topPublishers}</span><h2 className={cx(sectionTitle, "mt-5")}>{copy.publisherPicks}</h2><p className="mt-5 max-w-[430px] text-[12px] leading-6 text-[#737685]">{copy.topPublishersText}</p></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{(publisherNames.length > 0 ? publisherNames.slice(0, 6) : [copy.noPublisher]).map((publisher, index) => <Link className="group flex min-h-28 flex-col justify-between rounded-[22px] border border-[#e4e5ed] bg-[#f7f7fb] p-5 transition hover:-translate-y-1 hover:border-[#aaa3ff] hover:bg-[#f0efff]" href={`${localized(locale, "/catalog")}?q=${encodeURIComponent(publisher)}`} key={publisher}><span className="text-[8px] font-black text-[#aaa6c9]">0{index + 1}</span><strong className="line-clamp-2 text-[15px] font-black tracking-[-.035em] group-hover:text-[#5147e2]">{publisher}</strong></Link>)}</div></div>
      </div></section>

      <BookShelf muted overline={featuredPublisher ?? copy.topPublishers} title={copy.publisherPicks} text={copy.publisherPicksText} items={publisherBooks} allLabel={t.browseAll} allHref={`${localized(locale, "/catalog")}?q=${encodeURIComponent(featuredPublisher ?? "")}`} />
      {featuredCategories.length > 0 ? <section className="bg-white px-0 py-12"><div className={cx(container, "grid grid-cols-[.7fr_1.3fr] items-center gap-10 rounded-[30px] bg-[#e9e7ff] p-8 max-lg:grid-cols-1 max-sm:p-5")}><div><span className={eyebrow}>{copy.other}</span><h2 className="mt-4 text-[clamp(2rem,4vw,3.8rem)] font-black leading-[.92] tracking-[-.06em]">{copy.other}</h2><p className="mt-4 max-w-[420px] text-[11px] leading-5 text-[#737685]">{copy.otherText}</p></div><nav className="grid grid-cols-3 gap-2 max-md:grid-cols-1">{featuredCategories.slice(0, 3).map((category) => <Link className="flex min-h-28 flex-col justify-between rounded-[20px] bg-white p-5 text-[12px] font-black tracking-[-.025em] transition hover:-translate-y-1 hover:text-[#5147e2]" href={categoryHref(category)} key={category.supplierCategoryId}><span className="line-clamp-2">{category.name}</span><span>↗</span></Link>)}</nav></div></section> : null}
      <BookShelf overline={copy.offers} title={copy.offers} text={copy.offersText} items={offers} allLabel={t.browseAll} allHref={localized(locale, "/catalog") + "?sort=price-asc"} />
      <BookShelf muted overline={copy.recommended} title={copy.recommended} text={copy.recommendedText} items={recommended} allLabel={t.browseAll} allHref={localized(locale, "/catalog") + "?sort=popular"} />

      <section className="bg-white py-20 max-sm:py-12" id="news"><div className={container}>
        <div className="mb-10 flex items-end justify-between gap-8 max-md:flex-col max-md:items-start"><div><span className={eyebrow}>{copy.journal}</span><h2 className={cx(sectionTitle, "mt-5")}>{copy.journal}</h2></div><p className="max-w-[430px] text-[12px] leading-6 text-[#737685]">{copy.journalText}</p></div>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">{copy.journalCards.map(([title, text, number], index) => <article className={cx("group flex min-h-[300px] flex-col overflow-hidden rounded-[28px] p-7", index === 0 ? "bg-[#6258ff] text-white" : index === 1 ? "bg-[#d9ff69]" : "bg-[#151722] text-white")} key={title}><span className="text-[9px] font-black uppercase tracking-[.14em] opacity-50">LUMI journal · {number}</span><h3 className="mt-auto text-[clamp(1.8rem,3vw,3rem)] font-black leading-[.92] tracking-[-.06em]">{title}</h3><p className="mt-4 max-w-[360px] text-[10px] leading-5 opacity-60">{text}</p><Link className="mt-6 inline-flex w-fit items-center gap-3 text-[8px] font-black uppercase tracking-[.09em]" href={localized(locale, "/catalog")}>{copy.read}<span className="transition group-hover:rotate-45">↗</span></Link></article>)}</div>
      </div></section>

      <section className="bg-[#151722] py-20 text-white max-sm:py-12" id="about"><div className={cx(container, "grid grid-cols-[1fr_.9fr] items-start gap-16 max-lg:grid-cols-1 max-lg:gap-9")}>
        <div className="sticky top-32 max-lg:static"><span className={cx(eyebrow, "bg-white/8 text-[#d9ff69]")}>{t.aboutOverline}</span><h2 className="mt-6 max-w-[680px] text-[clamp(2.8rem,5.5vw,5.5rem)] font-black leading-[.88] tracking-[-.075em]">{t.aboutTitle}</h2><p className="mt-6 max-w-[560px] text-[12px] leading-6 text-white/48">{t.aboutText}</p></div>
        <div className="grid gap-3">{t.benefits.map(([title, text], index) => <article className="grid grid-cols-[52px_1fr_auto] items-center gap-5 rounded-[24px] border border-white/10 bg-white/[.045] p-5 max-sm:grid-cols-[44px_1fr]" key={title}><span className="grid size-12 place-items-center rounded-2xl bg-[#d9ff69] text-[10px] font-black text-[#151722] max-sm:size-10">0{index + 1}</span><div><strong className="text-[15px] font-extrabold">{title}</strong><p className="mt-1.5 text-[10px] leading-5 text-white/48">{text}</p></div><span className="text-xl text-white/25 max-sm:hidden">↗</span></article>)}</div>
      </div></section>

      <section className="border-t border-[#e4e5ed] bg-[#f5f6fb] py-20 max-sm:py-12" id="delivery"><div className={cx(container, "grid grid-cols-[.7fr_1.3fr] gap-12 max-lg:grid-cols-1")}>
        <div><span className={eyebrow}>{t.deliveryOverline}</span><h2 className={cx(sectionTitle, "mt-5 whitespace-pre-line")}>{t.deliveryTitle}</h2><p className="mt-6 max-w-[420px] text-[12px] leading-6 text-[#737685]">{t.deliveryText}</p><div className="mt-8 inline-flex items-baseline gap-3 rounded-2xl bg-[#151722] px-5 py-4 text-white"><strong className="text-2xl font-black">1 000 ֏</strong><small className="text-[8px] uppercase tracking-[.1em] text-white/45">{t.fixed}</small></div></div>
        <ol className="grid gap-3">{t.steps.map(([title, text], index) => <li className="grid grid-cols-[48px_1fr_auto] items-center gap-5 rounded-[22px] border border-[#e1e3ec] bg-white p-5 shadow-[0_12px_35px_rgba(39,42,72,.04)] max-sm:grid-cols-[42px_1fr]" key={title}><span className="grid size-12 place-items-center rounded-2xl bg-[#ebe9ff] text-[10px] font-black text-[#5147e2] max-sm:size-10">0{index + 1}</span><div><strong className="text-[14px] font-extrabold">{title}</strong><p className="mt-1 text-[10px] leading-5 text-[#7c7f8d]">{text}</p></div><span className="rounded-full bg-[#f5f6fb] px-3 py-2 text-[8px] font-black uppercase tracking-[.08em] text-[#8c8f9e] max-sm:hidden">{t.deliveryYerevan}</span></li>)}</ol>
      </div></section>

      <section className="bg-white py-20 max-sm:py-12" id="faq"><div className={cx(container, "grid grid-cols-[.72fr_1.28fr] gap-16 max-lg:grid-cols-1 max-lg:gap-8")}>
        <div><span className={eyebrow}>FAQ</span><h2 className={cx(sectionTitle, "mt-5")}>{copy.faq}</h2><p className="mt-5 text-[12px] leading-6 text-[#737685]">{copy.faqText}</p></div>
        <div className="border-t border-[#dfe0e8]">{copy.questions.map(([question, answer], index) => <details className="group border-b border-[#dfe0e8] py-5" key={question}><summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-[15px] font-extrabold tracking-[-.02em]"><span><small className="mr-4 text-[8px] text-[#aaa6c9]">0{index + 1}</small>{question}</span><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f0efff] text-[#5147e2] transition group-open:rotate-45">+</span></summary><p className="max-w-[650px] pb-1 pl-9 pt-4 text-[11px] leading-6 text-[#737685]">{answer}</p></details>)}</div>
      </div></section>

      <section className="bg-white pb-20 max-sm:pb-12" id="contacts"><div className={cx(container, "lumi-mesh lumi-grid grid grid-cols-[1fr_auto] items-end gap-10 overflow-hidden rounded-[34px] p-[clamp(2rem,6vw,5rem)] text-white max-md:grid-cols-1")}>
        <div><span className="inline-flex rounded-full bg-[#d9ff69] px-3 py-2 text-[8px] font-black uppercase tracking-[.14em] text-[#151722]">LUMI · Yerevan</span><blockquote className="mt-6 max-w-[790px] text-[clamp(2.5rem,5.5vw,5.7rem)] font-black leading-[.88] tracking-[-.075em]">“{t.quote}”</blockquote></div><Link className="inline-flex min-h-14 shrink-0 items-center gap-8 rounded-2xl bg-white px-6 text-[9px] font-black uppercase tracking-[.08em] text-[#5147e2]" href={localized(locale, "/catalog")}>{t.shopNow}<span>↗</span></Link>
      </div></section>
    </>
  );
}
