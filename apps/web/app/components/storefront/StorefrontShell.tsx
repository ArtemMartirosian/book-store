"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { isCatalogCategoriesResponse, publicApiBase } from "../../lib/catalog-api";
import type { Book, CatalogCategory } from "../../lib/types";
import { dictionary, localized, type Locale } from "./i18n";
import { container, cx } from "./ui";

export type CartLine = { book: Book; quantity: number };

type StorefrontContextValue = {
  locale: Locale;
  cart: CartLine[];
  favorites: Book[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (book: Book, quantity?: number) => void;
  setQuantity: (bookId: string, quantity: number) => void;
  removeFromCart: (bookId: string) => void;
  clearCart: () => void;
  toggleFavorite: (book: Book) => void;
  isFavorite: (bookId: string) => boolean;
  notice: string;
};

const StorefrontContext = createContext<StorefrontContextValue | null>(null);

export function useStorefront() {
  const value = useContext(StorefrontContext);
  if (!value) throw new Error("useStorefront must be used within StorefrontShell");
  return value;
}

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-3 text-[#151722]", inverse && "text-white")}>
      <span className={cx("relative grid size-11 place-items-center overflow-hidden rounded-[15px] bg-[#6258ff] text-white shadow-[0_10px_28px_rgba(98,88,255,.3)]", inverse && "bg-white text-[#151722] shadow-none")} aria-hidden="true">
        <svg className="size-5" viewBox="0 0 24 24" fill="none">
          <path d="M5 5.8c2.8-.6 5 .2 7 2.2v10c-2-2-4.2-2.8-7-2.2v-10Zm14 0c-2.8-.6-5 .2-7 2.2v10c2-2 4.2-2.8 7-2.2v-10Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        <i className="absolute -right-1 -top-1 size-4 rounded-full bg-[#d9ff69]" />
      </span>
      <span className="grid leading-none">
        <strong className="text-[20px] font-black tracking-[-.07em]">LUMI</strong>
        <small className="mt-1.5 text-[7px] font-black uppercase tracking-[.28em] opacity-45">bookstore</small>
      </span>
    </span>
  );
}

type IconName = "search" | "grid" | "user" | "heart" | "cart" | "menu" | "close" | "chevron";

function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
    grid: <><rect x="4" y="4" width="5" height="5" rx="1" /><rect x="15" y="4" width="5" height="5" rx="1" /><rect x="4" y="15" width="5" height="5" rx="1" /><rect x="15" y="15" width="5" height="5" rx="1" /></>,
    user: <><circle cx="12" cy="8" r="3.5" /><path d="M5.5 20c.7-4 2.9-6 6.5-6s5.8 2 6.5 6" /></>,
    heart: <path d="M20.7 5.8c-1.8-2-5-1.6-6.7.5L12 8.7l-2-2.4C8.3 4.2 5.1 3.8 3.3 5.8c-1.9 2.1-1.6 5.4.4 7.3L12 21l8.3-7.9c2-1.9 2.3-5.2.4-7.3Z" />,
    cart: <><path d="M3 4h2l1.7 10.2h10.8L20 7H6" /><circle cx="9" cy="19" r="1.3" /><circle cx="17" cy="19" r="1.3" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
  } as const;
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function StorefrontProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);
  const favoritesLoaded = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("lumi-cart");
        if (saved) {
          const restored = (JSON.parse(saved) as CartLine[])
            .filter((line) => line?.book?.id && Number.isFinite(line.quantity) && line.quantity > 0)
            .map((line) => ({ ...line, quantity: Math.min(10, Math.trunc(line.quantity)) }));
          setCart(restored);
        }
      } catch { /* The cart still works in memory. */ }
      try {
        const savedFavorites = window.localStorage.getItem("lumi-favorites");
        if (savedFavorites) {
          const restored = (JSON.parse(savedFavorites) as Book[]).filter((book) => book?.id && book?.slug);
          setFavorites(restored);
        }
      } catch { /* Favorites still work in memory. */ }
      loaded.current = true;
      favoritesLoaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try { window.localStorage.setItem("lumi-cart", JSON.stringify(cart)); } catch { /* No-op. */ }
  }, [cart]);

  useEffect(() => {
    if (!favoritesLoaded.current) return;
    try { window.localStorage.setItem("lumi-favorites", JSON.stringify(favorites)); } catch { /* No-op. */ }
  }, [favorites]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const addToCart = (book: Book, quantity = 1) => {
    setCart((current) => {
      const exists = current.some((line) => line.book.id === book.id);
      return exists
        ? current.map((line) => line.book.id === book.id ? { ...line, quantity: Math.min(10, line.quantity + quantity) } : line)
        : [...current, { book, quantity: Math.min(10, Math.max(1, quantity)) }];
    });
    setNotice(`«${book.title}» ${dictionary[locale].cartNotice}`);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 2400);
  };

  const setQuantity = (bookId: string, quantity: number) => {
    setCart((current) => quantity < 1
      ? current.filter((line) => line.book.id !== bookId)
      : current.map((line) => line.book.id === bookId ? { ...line, quantity: Math.min(10, quantity) } : line));
  };

  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartSubtotal = cart.reduce((sum, line) => sum + line.book.price * line.quantity, 0);

  const value: StorefrontContextValue = {
    locale,
    cart,
    favorites,
    cartCount,
    cartSubtotal,
    addToCart,
    setQuantity,
    removeFromCart: (bookId) => setCart((current) => current.filter((line) => line.book.id !== bookId)),
    clearCart: () => setCart([]),
    toggleFavorite: (book) => setFavorites((current) => current.some((item) => item.id === book.id)
      ? current.filter((item) => item.id !== book.id)
      : [...current, book]),
    isFavorite: (bookId) => favorites.some((book) => book.id === bookId),
    notice,
  };

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { locale, cartCount, favorites } = useStorefront();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [activeCatalogPath, setActiveCatalogPath] = useState<string[]>([]);
  const catalogCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = dictionary[locale].header;
  const serviceLabels = {
    ru: { about: "О нас", offers: "Предложения", news: "Журнал", delivery: "Как заказать", faq: "FAQ", contacts: "Контакты", advanced: "Расширенный поиск" },
    hy: { about: "Մեր մասին", offers: "Առաջարկներ", news: "Ամսագիր", delivery: "Ինչպես պատվիրել", faq: "ՀՏՀ", contacts: "Կապ", advanced: "Ընդլայնված որոնում" },
    en: { about: "About", offers: "Offers", news: "Journal", delivery: "How to order", faq: "FAQ", contacts: "Contacts", advanced: "Advanced search" },
  }[locale];
  const serviceLinks = [
    [serviceLabels.about, localized(locale) + "#about"],
    [serviceLabels.offers, localized(locale, "/catalog") + "?sort=price-asc"],
    [serviceLabels.news, localized(locale) + "#news"],
    [serviceLabels.delivery, localized(locale) + "#delivery"],
    [serviceLabels.faq, localized(locale) + "#faq"],
    [serviceLabels.contacts, localized(locale) + "#contacts"],
  ];
  const categoryNav = [
    { href: localized(locale, "/catalog") + "?sort=new", label: t.new },
    { href: localized(locale, "/catalog") + "?sort=popular", label: t.bestsellers },
    { href: localized(locale, "/catalog") + "?language=hy", label: t.armenian },
    { href: localized(locale, "/catalog") + "?language=ru", label: { hy: "Ռուսերեն գրքեր", ru: "Книги на русском", en: "Russian books" }[locale] },
    { href: localized(locale, "/catalog") + "?language=en", label: t.english },
  ];
  const localePath = (next: Locale) => {
    const nextPath = pathname.replace(/^\/(ru|hy|en)(?=\/|$)/, "/" + next) || "/" + next;
    const query = searchParams.toString();
    return nextPath + (query ? "?" + query : "");
  };
  const languageOptions: Array<{ value: Locale; flag: string; label: string }> = [
    { value: "hy", flag: "🇦🇲", label: "Հայերեն" },
    { value: "ru", flag: "🇷🇺", label: "Русский" },
    { value: "en", flag: "🇬🇧", label: "English" },
  ];
  const languageLabel = { hy: "Լեզու", ru: "Язык", en: "Language" }[locale];
  const changeLocale = (next: Locale) => window.location.assign(localePath(next));
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    if (!String(new FormData(event.currentTarget).get("q") ?? "").trim()) event.preventDefault();
  };
  const cancelCatalogClose = () => {
    if (!catalogCloseTimer.current) return;
    clearTimeout(catalogCloseTimer.current);
    catalogCloseTimer.current = null;
  };
  const openCatalog = () => {
    cancelCatalogClose();
    setCatalogOpen(true);
  };
  const closeCatalogSoon = () => {
    cancelCatalogClose();
    catalogCloseTimer.current = setTimeout(() => {
      setCatalogOpen(false);
      catalogCloseTimer.current = null;
    }, 180);
  };
  const closeMenus = () => {
    cancelCatalogClose();
    setMobileOpen(false);
    setCatalogOpen(false);
  };

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${publicApiBase}/catalog/categories?locale=${locale}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!isCatalogCategoriesResponse(result)) return;
        setCatalogCategories(result);
        setActiveCatalogPath([]);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [locale]);

  useEffect(() => () => cancelCatalogClose(), []);

  const catalogChildren = new Map<string, CatalogCategory[]>();
  for (const category of catalogCategories) {
    const parentId = category.parentSupplierCategoryId ?? "root";
    const children = catalogChildren.get(parentId) ?? [];
    children.push(category);
    catalogChildren.set(parentId, children);
  }
  const catalogColumns: Array<{
    label: string;
    items: CatalogCategory[];
    selectedId: string;
  }> = [];
  let catalogParentId = "7463";
  let catalogColumnLabel: string = t.allCategories;
  for (let level = 0; level < 6; level += 1) {
    const items = catalogChildren.get(catalogParentId) ?? [];
    if (items.length === 0) break;
    const selected = items.find(({ supplierCategoryId }) => supplierCategoryId === activeCatalogPath[level]) ?? items[0]!;
    catalogColumns.push({ label: catalogColumnLabel, items, selectedId: selected.supplierCategoryId });
    catalogParentId = selected.supplierCategoryId;
    catalogColumnLabel = selected.name;
  }
  const activateCatalogCategory = (level: number, supplierCategoryId: string) => {
    setActiveCatalogPath((current) => current[level] === supplierCategoryId
      ? current
      : [...current.slice(0, level), supplierCategoryId]);
  };

  return (
    <>
      <div className="bg-[#12131d] text-white max-sm:hidden">
        <div className={cx(container, "flex min-h-9 items-center justify-between gap-5 text-[9px] font-semibold")}>
          <span className="flex items-center gap-2 text-white/65"><i className="size-1.5 rounded-full bg-[#d9ff69]" />{t.announcement}</span>
          <div className="flex items-center gap-5 text-white/55">
            <nav className="hidden items-center gap-4 xl:flex" aria-label={t.menu}>{serviceLinks.map(([label, href]) => <a className="transition hover:text-[#d9ff69]" href={href} key={href}>{label}</a>)}</nav>
            <span className="max-lg:hidden">{t.city} · 10:00–20:00</span>
            <span className="font-black text-white">AMD</span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-[#e6e7ef] bg-white/88 shadow-[0_12px_40px_rgba(35,38,70,.07)] backdrop-blur-2xl" onPointerLeave={(event) => { if (event.pointerType === "mouse") { cancelCatalogClose(); setCatalogOpen(false); } }}>
        <div className={cx(container, "flex min-h-[78px] items-center gap-6 max-sm:min-h-[66px] max-sm:gap-3")}>
          <Link href={localized(locale)} aria-label="LUMI Books" onClick={closeMenus}><Logo /></Link>

          <nav className="hidden items-center gap-1 xl:flex" aria-label={t.menu}>
            <button className="flex h-11 items-center gap-2 rounded-xl px-3.5 text-[10px] font-black uppercase tracking-[.07em] text-[#272938] transition hover:bg-[#f0efff] hover:text-[#5147e2]" type="button" aria-expanded={catalogOpen} aria-controls="desktop-catalog-menu" onMouseEnter={openCatalog} onFocus={openCatalog} onBlur={closeCatalogSoon} onKeyDown={(event) => { if (event.key === "Escape") closeMenus(); }} onClick={openCatalog}><Icon name="grid" className="size-4" />{t.catalog}<Icon name="chevron" className={cx("size-3 transition", catalogOpen && "rotate-90")} /></button>
            <Link className="rounded-xl px-3.5 py-3 text-[10px] font-black uppercase tracking-[.07em] text-[#727584] transition hover:bg-[#f0efff] hover:text-[#5147e2]" href={localized(locale, "/catalog") + "?sort=new"}>{t.new}</Link>
            <Link className="rounded-xl px-3.5 py-3 text-[10px] font-black uppercase tracking-[.07em] text-[#727584] transition hover:bg-[#f0efff] hover:text-[#5147e2]" href={localized(locale, "/catalog") + "?sort=popular"}>{t.bestsellers}</Link>
          </nav>

          <form className="ml-auto flex h-12 min-w-[220px] max-w-[390px] flex-1 items-center rounded-2xl border border-[#e0e2eb] bg-[#f5f6fb] px-1.5 pl-4 transition focus-within:border-[#6258ff] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(98,88,255,.09)] max-md:hidden" action={localized(locale, "/catalog")} onSubmit={submitSearch}>
            <Icon name="search" className="mr-2 size-[18px] shrink-0 text-[#777a8a]" />
            <input className="min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-[#9699a8]" name="q" placeholder={t.search} aria-label={t.search} />
            <button className="h-9 rounded-xl bg-[#151722] px-4 text-[8px] font-black uppercase tracking-[.08em] text-white transition hover:bg-[#6258ff]" type="submit">{t.searchButton}</button>
          </form>
          <Link className="hidden shrink-0 text-[8px] font-black uppercase tracking-[.07em] text-[#6258ff] underline decoration-[#c9c5ff] underline-offset-4 2xl:block" href={localized(locale, "/search")}>{serviceLabels.advanced}</Link>

          <div className="flex shrink-0 items-center gap-1">
            <label className="relative mr-1 flex h-11 items-center rounded-xl border border-[#e0e2eb] bg-[#f5f6fb] text-[10px] font-bold max-xl:hidden">
              <span className="sr-only">{languageLabel}</span>
              <select className="h-full cursor-pointer appearance-none rounded-xl bg-transparent py-0 pl-3 pr-9 outline-none transition hover:bg-white focus:bg-white" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label={languageLabel}>
                {languageOptions.map((item) => <option value={item.value} key={item.value}>{item.flag} {item.label}</option>)}
              </select>
              <Icon name="chevron" className="pointer-events-none absolute right-3 size-3 rotate-90 text-[#858897]" />
            </label>
            <Link className="grid size-11 place-items-center rounded-xl text-[#565968] transition hover:bg-[#f0efff] hover:text-[#5147e2] max-sm:hidden" href={localized(locale, "/account")} aria-label={t.account}><Icon name="user" /></Link>
            <Link className="relative grid size-11 place-items-center rounded-xl text-[#565968] transition hover:bg-[#f0efff] hover:text-[#5147e2] max-sm:hidden" href={localized(locale, "/favorites")} aria-label={t.favorites}><Icon name="heart" />{favorites.length > 0 ? <b className="absolute right-0 top-0 grid size-4 place-items-center rounded-full bg-[#6258ff] text-[7px] font-black text-white">{favorites.length}</b> : null}</Link>
            <Link className="relative grid size-11 place-items-center rounded-xl bg-[#151722] text-white transition hover:-translate-y-0.5 hover:bg-[#6258ff]" href={localized(locale, "/cart")} aria-label={t.cart + ": " + cartCount}>
              <Icon name="cart" />
              <b className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full border-2 border-white bg-[#d9ff69] text-[8px] font-black text-[#151722]">{cartCount}</b>
            </Link>
            <button className="ml-1 hidden size-11 place-items-center rounded-xl border border-[#e0e2eb] bg-white max-xl:grid" type="button" aria-label={t.menu} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
              <Icon name={mobileOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>

        <div className={cx(container, "hidden pb-3 max-md:block")}>
          <form className="flex h-11 items-center rounded-xl border border-[#e0e2eb] bg-[#f5f6fb] px-1.5 pl-3" action={localized(locale, "/catalog")} onSubmit={submitSearch}><Icon name="search" className="mr-2 size-4 text-[#777a8a]" /><input className="min-w-0 flex-1 bg-transparent text-[11px] outline-none" name="q" placeholder={t.search} aria-label={t.search} /><button className="h-8 rounded-lg bg-[#6258ff] px-3 text-[8px] font-black uppercase text-white" type="submit">{t.searchButton}</button></form>
        </div>

        {catalogOpen && (
          <div id="desktop-catalog-menu" className="absolute inset-x-0 top-full border-b border-[#e4e5ed] bg-white/95 shadow-[0_28px_70px_rgba(35,38,70,.14)] backdrop-blur-2xl max-xl:hidden">
            <div className={cx(container, "py-5")}>
              <div className="mb-4 flex items-center justify-between gap-5">
                <div><span className="text-[8px] font-black uppercase tracking-[.14em] text-[#8a8d9d]">{t.catalog}</span><strong className="mt-1 block text-xl font-black tracking-[-.035em] text-[#151722]">{t.allCategories}</strong></div>
                <Link className="inline-flex min-h-10 items-center gap-3 rounded-xl bg-[#151722] px-4 text-[9px] font-black uppercase tracking-[.08em] text-white transition hover:bg-[#6258ff]" href={localized(locale, "/catalog")} onClick={closeMenus}>{t.allCategories}<span>↗</span></Link>
              </div>
              {catalogColumns.length > 0 ? (
                <div className="grid h-[min(62vh,520px)] grid-flow-col auto-cols-[minmax(220px,1fr)] overflow-x-auto rounded-[22px] border border-[#e2e4ed] bg-[#f7f7fb]">
                  {catalogColumns.map((column, level) => (
                    <section className="min-w-0 overflow-y-auto border-r border-[#e2e4ed] bg-white/55 p-3 last:border-r-0" key={level}>
                      <h3 className="sticky top-0 z-10 mb-2 bg-[#f9f9fc]/95 px-2 py-2 text-[8px] font-black uppercase tracking-[.11em] text-[#8a8d9d] backdrop-blur">{column.label}</h3>
                      <nav className="grid gap-1" aria-label={column.label}>
                        {column.items.map((category) => {
                          const hasChildren = (catalogChildren.get(category.supplierCategoryId)?.length ?? 0) > 0;
                          const active = column.selectedId === category.supplierCategoryId;
                          return <Link className={cx("flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-[10px] font-bold leading-4 transition", active ? "bg-[#6258ff] text-white shadow-[0_8px_22px_rgba(98,88,255,.2)]" : "text-[#454857] hover:bg-[#eceaff] hover:text-[#5147e2]")} href={`${localized(locale, "/catalog")}?category=${category.supplierCategoryId}`} onMouseEnter={() => { if (!active) activateCatalogCategory(level, category.supplierCategoryId); }} onFocus={() => { if (!active) activateCatalogCategory(level, category.supplierCategoryId); }} onClick={closeMenus} key={category.supplierCategoryId}><span>{category.name}</span>{hasChildren ? <Icon name="chevron" className="size-3 shrink-0" /> : <span className="text-[11px] opacity-35">↗</span>}</Link>;
                        })}
                      </nav>
                    </section>
                  ))}
                </div>
              ) : (
                <nav className="grid grid-cols-3 gap-3" aria-label={t.catalog}>
                  {categoryNav.map((item, index) => <Link className="flex min-h-16 items-center justify-between rounded-2xl border border-[#e4e5ed] bg-[#f7f7fb] px-4 text-[11px] font-bold transition hover:border-[#aaa3ff] hover:bg-[#f0efff] hover:text-[#5147e2]" href={item.href} onClick={closeMenus} key={item.href}><span><small className="mr-2 text-[8px] text-[#999cab]">0{index + 1}</small>{item.label}</span><Icon name="chevron" className="size-3" /></Link>)}
                </nav>
              )}
            </div>
          </div>
        )}

        {mobileOpen && (
          <div className="absolute inset-x-0 top-full max-h-[calc(100vh-108px)] overflow-auto border-b border-[#e4e5ed] bg-white p-4 shadow-2xl xl:hidden">
            <Link className="flex min-h-14 items-center justify-between rounded-2xl bg-[#6258ff] px-5 text-[11px] font-black text-white" href={localized(locale, "/catalog")} onClick={closeMenus}>{t.allCategories}<span className="text-lg">↗</span></Link>
            <nav className="mt-3 grid gap-1" aria-label={t.menu}>
              {categoryNav.map((item) => <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-[12px] font-bold hover:bg-[#f0efff]" href={item.href} onClick={closeMenus} key={item.href}>{item.label}<Icon name="chevron" className="size-4 text-[#9a9f99]" /></Link>)}
              <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-[12px] font-bold text-[#5147e2] hover:bg-[#f0efff]" href={localized(locale, "/search")} onClick={closeMenus}>{serviceLabels.advanced}<Icon name="search" className="size-4" /></Link>
              <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-[12px] font-bold hover:bg-[#f0efff]" href={localized(locale, "/favorites")} onClick={closeMenus}>{t.favorites}<Icon name="heart" className="size-4" /></Link>
              <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-[12px] font-bold hover:bg-[#f0efff]" href={localized(locale, "/account")} onClick={closeMenus}>{t.account}<Icon name="user" className="size-4" /></Link>
            </nav>
            <label className="mt-4 grid gap-2 rounded-2xl bg-[#f4f5fa] p-3">
              <span className="px-1 text-[8px] font-black uppercase tracking-[.1em] text-[#858897]">{languageLabel}</span>
              <span className="relative flex items-center">
                <select className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[#e0e2eb] bg-white px-4 pr-10 text-[12px] font-bold outline-none focus:border-[#6258ff]" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label={languageLabel}>
                  {languageOptions.map((item) => <option value={item.value} key={item.value}>{item.flag} {item.label}</option>)}
                </select>
                <Icon name="chevron" className="pointer-events-none absolute right-4 size-4 rotate-90 text-[#858897]" />
              </span>
            </label>
          </div>
        )}
      </header>
    </>
  );
}

function Footer() {
  const { locale } = useStorefront();
  const t = dictionary[locale].footer;
  return (
    <footer className="bg-[#12131d] text-white">
      <div className={cx(container, "border-b border-white/10 py-10 sm:py-14")}>
        <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
          <h2 className="max-w-[760px] text-[clamp(2.4rem,6vw,5.6rem)] font-black leading-[.9] tracking-[-.075em]">{t.about}</h2>
          <Link className="inline-flex min-h-14 shrink-0 items-center gap-7 rounded-2xl bg-[#d9ff69] px-6 text-[10px] font-black uppercase tracking-[.08em] text-[#151722] transition hover:-translate-y-1" href={localized(locale, "/catalog")}>{t.catalog}<span className="text-lg">↗</span></Link>
        </div>
      </div>
      <div className={cx(container, "grid grid-cols-[1.35fr_.7fr_.7fr_.8fr] gap-14 py-12 max-lg:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-9")}>
        <div className="max-w-[360px]">
          <Link href={localized(locale)}><Logo inverse /></Link>
          <p className="mt-5 text-[11px] leading-6 text-white/48">{t.reply}</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[.04] px-3 py-2 text-[9px] font-semibold text-white/65"><i className="size-1.5 rounded-full bg-[#d9ff69]" />Yerevan · 10:00–20:00</span>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-[#d9ff69]">{t.buyers}</h3>
          <Link className="text-[12px] text-white/72 transition hover:text-white" href={localized(locale, "/catalog")}>{t.catalog}</Link>
          <Link className="text-[12px] text-white/72 transition hover:text-white" href={localized(locale) + "#delivery"}>{t.delivery}</Link>
          <Link className="text-[12px] text-white/72 transition hover:text-white" href={localized(locale, "/account")}>{t.orders}</Link>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="mb-2 text-[9px] font-black uppercase tracking-[.16em] text-[#d9ff69]">{t.lumi}</h3>
          <Link className="text-[12px] text-white/72 transition hover:text-white" href={localized(locale) + "#about"}>{t.how}</Link>
          <Link className="text-[12px] text-white/72 transition hover:text-white" href={localized(locale) + "#delivery"}>{t.delivery}</Link>
          <Link className="text-[12px] text-white/72 transition hover:text-white" href={localized(locale, "/account")}>{t.orders}</Link>
        </div>
        <div>
          <span className="text-[9px] font-black uppercase tracking-[.16em] text-[#d9ff69]">{t.daily}</span>
          <strong className="mt-3 block text-3xl font-black tracking-[-.05em]">10:00–20:00</strong>
          <small className="mt-2 block max-w-[220px] text-[10px] leading-5 text-white/45">{t.reply}</small>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className={cx(container, "flex min-h-12 items-center justify-between gap-4 text-[8px] uppercase tracking-[.08em] text-white/38 max-sm:flex-wrap max-sm:py-4")}>
          <span>© 2026 LUMI Books</span><span>{t.city}</span><span>{t.privacy}</span>
        </div>
      </div>
    </footer>
  );
}

function Toast() {
  const { notice } = useStorefront();
  return <div className={cx("pointer-events-none fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-2.5rem)] translate-y-3 items-center gap-3 rounded-2xl border border-white/10 bg-[#151722] px-5 py-4 text-[11px] font-semibold text-white opacity-0 shadow-[0_24px_70px_rgba(21,23,34,.3)] transition", notice && "translate-y-0 opacity-100")} aria-live="polite"><span className="grid size-7 place-items-center rounded-full bg-[#d9ff69] text-[10px] font-black text-[#151722]">✓</span>{notice}</div>;
}

export function StorefrontShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <StorefrontProvider locale={locale}>
      <div className="lumi-store min-h-screen overflow-x-clip bg-[#f5f6fb] font-sans text-[#151722]">
        <Header /><main>{children}</main><Footer /><Toast />
      </div>
    </StorefrontProvider>
  );
}
