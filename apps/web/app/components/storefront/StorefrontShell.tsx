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
import { brandName, BRAND_LABELS } from "../../lib/brand";
import type { Book, CatalogCategory } from "../../lib/types";
import { subtractOrderedItems } from "../../lib/checkout-client.mjs";
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
  completeCheckout: (items: Array<{ productId: string; quantity: number }>) => void;
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

export function Logo({ locale, inverse = false }: { locale: Locale; inverse?: boolean }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[var(--accent)] sm:gap-2.5", inverse && "text-[var(--paper)]")}>
      {/* A decorative mark pairs with searchable, accessible text in every language. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/grqaser-mark.png" alt="" aria-hidden="true" width={44} height={44} className={cx("size-7 shrink-0 object-contain sm:size-11", inverse && "brightness-0 invert")} />
      <span className="flex flex-col gap-1">
        <span className="whitespace-nowrap font-serif text-[22px] leading-none tracking-[-.025em] sm:text-[32px]">{brandName(locale)}</span>
        <span className={cx("text-[8px] font-medium leading-none tracking-[.025em] text-[var(--muted)] sm:text-[9px] sm:tracking-[.06em]", inverse && "text-[#c1cdc3]")}>{BRAND_LABELS[locale]}</span>
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
        ? current.map((line) => line.book.id === book.id ? { ...line, book, quantity: Math.min(10, line.quantity + quantity) } : line)
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
    completeCheckout: (items) => setCart((current) => subtractOrderedItems(current, items)),
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
  const headerRef = useRef<HTMLElement>(null);
  const t = dictionary[locale].header;
  const serviceLabels = {
    ru: { about: "О нас", offers: "По приятной цене", news: "Журнал", delivery: "Как заказать", faq: "Вопросы и ответы", contacts: "Контакты", advanced: "Расширенный поиск", publishers: "Издательства", recommendations: "Рекомендуем" },
    hy: { about: "Մեր մասին", offers: "Մատչելի գրքեր", news: "Ամսագիր", delivery: "Ինչպես պատվիրել", faq: "Հարցեր և պատասխաններ", contacts: "Կապ", advanced: "Ընդլայնված որոնում", publishers: "Հրատարակիչներ", recommendations: "Առաջարկում ենք" },
    en: { about: "About us", offers: "Budget-friendly books", news: "Journal", delivery: "How to order", faq: "Help & FAQ", contacts: "Contact", advanced: "Advanced search", publishers: "Publishers", recommendations: "Discover books" },
  }[locale];
  const serviceLinks = [
    [serviceLabels.about, localized(locale, "/information") + "#about"],
    [serviceLabels.news, localized(locale, "/journal")],
    [serviceLabels.delivery, localized(locale, "/information") + "#delivery"],
    [serviceLabels.faq, localized(locale, "/information") + "#faq"],
    [serviceLabels.contacts, localized(locale, "/contacts")],
  ];
  const categoryNav = [
    { href: localized(locale, "/catalog") + "?isNew=true", label: t.new },
    { href: localized(locale) + "#publishers", label: serviceLabels.publishers },
    { href: localized(locale, "/catalog") + "?sort=price-asc", label: serviceLabels.offers },
    { href: localized(locale, "/catalog") + "?language=hy", label: t.armenian },
    { href: localized(locale, "/catalog") + "?language=ru", label: { hy: "Ռուսերեն գրքեր", ru: "Книги на русском", en: "Russian books" }[locale] },
    { href: localized(locale, "/catalog") + "?language=en", label: t.english },
  ];
  const localePath = (next: Locale) => {
    const nextPath = pathname.replace(/^\/(ru|hy|en)(?=\/|$)/, "/" + next) || "/" + next;
    const query = searchParams.toString();
    return nextPath + (query ? "?" + query : "");
  };
  const languageOptions: Array<{ value: Locale; label: string }> = [
    { value: "hy", label: "Հայերեն" },
    { value: "ru", label: "Русский" },
    { value: "en", label: "English" },
  ];
  const languageLabel = { hy: "Լեզու", ru: "Язык", en: "Language" }[locale];
  const changeLocale = (next: Locale) => window.location.assign(localePath(next));
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    if (!String(data.get("q") ?? "").trim() && !String(data.get("category") ?? "").trim()) event.preventDefault();
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

  useEffect(() => {
    if (!catalogOpen && !mobileOpen) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !headerRef.current?.contains(document.activeElement)) return;
      event.preventDefault();
      const trigger = headerRef.current.querySelector<HTMLButtonElement>(catalogOpen ? '[aria-controls="desktop-catalog-menu"]' : '[aria-controls="mobile-navigation-menu"]');
      if (catalogCloseTimer.current) clearTimeout(catalogCloseTimer.current);
      catalogCloseTimer.current = null;
      setMobileOpen(false);
      setCatalogOpen(false);
      trigger?.focus();
    };
    document.addEventListener("keydown", onEscape);
    const onOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) {
        setCatalogOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("pointerdown", onOutsidePointer);
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.removeEventListener("pointerdown", onOutsidePointer);
    };
  }, [catalogOpen, mobileOpen]);

  const catalogChildren = new Map<string, CatalogCategory[]>();
  for (const category of catalogCategories) {
    const parentId = category.parentSupplierCategoryId ?? "root";
    const children = catalogChildren.get(parentId) ?? [];
    children.push(category);
    catalogChildren.set(parentId, children);
  }
  const categoryIds = new Set(catalogCategories.map((category) => category.supplierCategoryId));
  const roots = catalogCategories.filter((category) => !category.parentSupplierCategoryId || !categoryIds.has(category.parentSupplierCategoryId));
  const rootCategories = roots.length === 1 && roots[0]?.supplierCategoryId === "7463"
    ? catalogChildren.get("7463") ?? roots
    : roots;
  catalogChildren.set("menu-root", rootCategories);
  const catalogColumns: Array<{
    label: string;
    items: CatalogCategory[];
    selectedId: string;
  }> = [];
  let catalogParentId = "menu-root";
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
  const mobileCategoryTree = (items: CatalogCategory[], ancestors: string[] = []): ReactNode => items.map((category) => {
    if (ancestors.includes(category.supplierCategoryId) || ancestors.length >= 6) return null;
    const children = catalogChildren.get(category.supplierCategoryId) ?? [];
    const href = `${localized(locale, "/catalog")}?category=${encodeURIComponent(category.supplierCategoryId)}`;
    if (!children.length) return <Link className="flex min-h-11 items-center rounded-lg px-3 py-2 text-sm text-[var(--ink)] hover:bg-[var(--paper)]" href={href} onClick={closeMenus} key={category.id}>{category.name}</Link>;
    return <details className="group/category rounded-xl border border-[var(--line)] bg-white" key={category.id}><summary className="min-h-11 cursor-pointer px-3 py-3 text-sm font-medium text-[var(--ink)]">{category.name}</summary><div className="ml-3 border-l border-[var(--line)] pl-2 pr-2"><Link className="flex min-h-11 items-center px-3 text-xs font-semibold text-[var(--accent)]" href={href} onClick={closeMenus}>{t.allCategories} →</Link>{mobileCategoryTree(children, [...ancestors, category.supplierCategoryId])}</div></details>;
  });

  return (
    <>
      <div className="border-b border-[var(--line)] bg-[var(--paper)] text-[var(--muted)]">
        <div className={cx(container, "flex min-h-11 items-center justify-between gap-3 text-[11px] font-medium sm:text-xs")}>
          <Link className="flex min-h-11 items-center gap-2 whitespace-nowrap text-[var(--accent)]" href={localized(locale, "/information") + "#delivery"}><span aria-hidden="true">↗</span>{t.announcement}</Link>
          <nav className="hidden items-center gap-5 xl:flex" aria-label={dictionary[locale].footer.lumi}>{serviceLinks.map(([label, href]) => <Link className="inline-flex min-h-11 items-center transition hover:text-[var(--accent)]" href={href} key={href}>{label}</Link>)}</nav>
          <label className="relative flex h-11 shrink-0 items-center text-[var(--ink)]"><span className="sr-only">{languageLabel}</span><select className="h-full cursor-pointer appearance-none rounded-lg bg-transparent pl-2 pr-6 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label={languageLabel}>{languageOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select><Icon name="chevron" className="pointer-events-none absolute right-1 size-3 rotate-90" /></label>
        </div>
      </div>
      <header ref={headerRef} className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/95 backdrop-blur-xl" onPointerLeave={(event) => { if (event.pointerType === "mouse") closeCatalogSoon(); }}>
        <div className={cx(container, "flex min-h-[88px] items-center gap-7 max-sm:min-h-[76px] max-sm:gap-2")}>
          <Link className="shrink-0" href={localized(locale)} aria-label={brandName(locale) + " — " + BRAND_LABELS[locale]} onClick={closeMenus}><Logo locale={locale} /></Link>
          <form className="mx-auto hidden h-12 min-w-[180px] max-w-[610px] flex-1 items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] pl-4 pr-1 transition focus-within:border-[var(--accent)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[var(--accent)]/10 md:flex" action={localized(locale, "/catalog")} onSubmit={submitSearch}>
            {rootCategories.length > 0 ? <select className="mr-3 hidden h-11 max-w-[135px] border-r border-[var(--line)] bg-transparent pr-3 text-xs text-[var(--muted)] outline-none focus-visible:text-[var(--accent)] 2xl:block" name="category" defaultValue="" aria-label={t.allCategories}><option value="">{t.allCategories}</option>{rootCategories.map((category) => <option key={category.id} value={category.supplierCategoryId}>{category.name}</option>)}</select> : null}
            <Icon name="search" className="mr-3 size-[18px] shrink-0 text-[var(--muted)]" />
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" name="q" maxLength={120} placeholder={t.search} aria-label={t.search} />
            <button className="h-11 rounded-lg bg-[var(--accent)] px-5 text-xs font-semibold text-white transition hover:bg-[var(--accent-deep)]" type="submit">{t.searchButton}</button>
          </form>
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Link className="hidden size-11 place-items-center rounded-full text-[var(--accent)] transition hover:bg-[var(--paper)] lg:grid" href={localized(locale, "/account")} aria-label={t.account}><Icon name="user" /></Link>
            <Link className="relative grid size-11 place-items-center rounded-full text-[var(--accent)] transition hover:bg-[var(--paper)]" href={localized(locale, "/favorites")} aria-label={t.favorites}>
              <Icon name="heart" />
              {favorites.length > 0 ? <b className="absolute right-0 top-0 grid min-h-4 min-w-4 place-items-center rounded-full bg-[var(--paper)] px-1 text-[10px] font-semibold text-[var(--accent)]">{favorites.length}</b> : null}
            </Link>
            <Link className="relative grid size-11 place-items-center rounded-full bg-[var(--accent)] text-white transition hover:bg-[var(--accent-deep)]" href={localized(locale, "/cart")} aria-label={t.cart + ": " + cartCount}>
              <Icon name="cart" />
              <b className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[var(--ink)] px-1 text-[10px] font-semibold text-white">{cartCount}</b>
            </Link>
            <button className="ml-1 grid size-11 place-items-center rounded-full text-[var(--accent)] transition hover:bg-[var(--paper)] xl:hidden" type="button" aria-label={t.menu} aria-controls="mobile-navigation-menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}>
              <Icon name={mobileOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
        <div className={cx(container, "pb-4 md:hidden")}>
          <form className="flex h-12 items-center rounded-xl border border-[var(--line)] bg-[var(--paper)] pl-4 pr-1" action={localized(locale, "/catalog")} onSubmit={submitSearch}>
            <Icon name="search" className="mr-2 size-[18px] shrink-0 text-[var(--muted)]" />
            <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]" name="q" maxLength={120} placeholder={t.search} aria-label={t.search} />
            <button className="h-11 rounded-lg bg-[var(--accent)] px-4 text-xs font-semibold text-white" type="submit">{t.searchButton}</button>
          </form>
        </div>
        <div className="hidden border-t border-[var(--line)]/65 xl:block">
          <div className={cx(container, "flex min-h-[52px] items-center justify-between gap-5")}>
            <nav className="flex items-center gap-5 text-xs font-medium text-[var(--ink)]" aria-label={t.menu}>
              <button className="mr-1 flex min-h-11 items-center gap-2.5 rounded-xl bg-[var(--accent)] px-4 text-white transition hover:bg-[var(--accent-deep)]" type="button" aria-expanded={catalogOpen} aria-controls="desktop-catalog-menu" onMouseEnter={openCatalog} onBlur={closeCatalogSoon} onClick={() => {
                openCatalog();
                window.requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>("#desktop-catalog-menu a")?.focus());
              }} onKeyDown={(event) => {
                if (event.key !== "ArrowDown") return;
                event.preventDefault();
                openCatalog();
                window.requestAnimationFrame(() => document.querySelector<HTMLAnchorElement>("#desktop-catalog-menu a")?.focus());
              }}>
                <Icon name="menu" className="size-[17px]" />{t.catalog}<Icon name="chevron" className={cx("size-3 transition", catalogOpen && "rotate-90")} />
              </button>
              <span className="h-4 w-px bg-[var(--line)]" aria-hidden="true" />
              {categoryNav.map((item) => <Link className="flex min-h-11 items-center transition hover:text-[var(--accent)]" href={item.href} key={item.href}>{item.label}</Link>)}
            </nav>
            <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
              <Link className="hidden min-h-11 items-center transition hover:text-[var(--accent)] 2xl:flex" href={localized(locale, "/search")}>{serviceLabels.advanced}</Link>
              <Link className="flex min-h-11 items-center transition hover:text-[var(--accent)]" href={localized(locale, "/contacts")}>{serviceLabels.contacts}</Link>
            </div>
          </div>
        </div>
        {catalogOpen && (
          <div id="desktop-catalog-menu" className="absolute inset-x-0 top-full border-b border-[var(--line)] bg-[var(--paper)] shadow-[0_20px_40px_rgba(32,44,40,.09)] max-xl:hidden" onMouseEnter={cancelCatalogClose} onFocusCapture={cancelCatalogClose} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeCatalogSoon(); }}>
            <div className={cx(container, "py-5")}>
              <div className="mb-4 flex items-center justify-between gap-5">
                <div><span className="text-[12px] font-medium uppercase tracking-[.14em] text-[var(--muted)]">{t.catalog}</span><strong className="mt-1 block font-display text-3xl font-normal text-[var(--accent)]">{t.allCategories}</strong></div>
                <Link className="inline-flex min-h-11 items-center gap-5 rounded-full border border-[var(--accent)] px-5 text-[13px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" href={localized(locale, "/catalog")} onClick={closeMenus}>{t.allCategories}<span aria-hidden="true">↗</span></Link>
              </div>
              {catalogColumns.length > 0 ? (
                <div className="grid h-[min(62vh,520px)] grid-flow-col auto-cols-[minmax(220px,1fr)] overflow-x-auto rounded-[22px] border border-[var(--line)] bg-[var(--white)]">
                  {catalogColumns.map((column, level) => (
                    <section className="min-w-0 overflow-y-auto border-r border-[var(--line)] bg-white/55 p-3 last:border-r-0" key={level}>
                      <h3 className="sticky top-0 z-10 mb-2 bg-[var(--white)]/95 px-2 py-2 text-[12px] font-medium uppercase tracking-[.11em] text-[var(--muted)] backdrop-blur">{column.label}</h3>
                      <nav className="grid gap-1" aria-label={column.label}>
                        {column.items.map((category) => {
                          const hasChildren = (catalogChildren.get(category.supplierCategoryId)?.length ?? 0) > 0;
                          const active = column.selectedId === category.supplierCategoryId;
                          return <Link className={cx("flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px] font-bold leading-4 transition", active ? "bg-[var(--paper)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--accent-deep)]")} href={`${localized(locale, "/catalog")}?category=${category.supplierCategoryId}`} onMouseEnter={() => { if (!active) activateCatalogCategory(level, category.supplierCategoryId); }} onFocus={() => { if (!active) activateCatalogCategory(level, category.supplierCategoryId); }} onClick={closeMenus} key={category.supplierCategoryId}><span>{category.name}</span>{hasChildren ? <Icon name="chevron" className="size-3 shrink-0" /> : <span className="text-[14px] opacity-35">↗</span>}</Link>;
                        })}
                      </nav>
                    </section>
                  ))}
                </div>
              ) : (
                <nav className="grid grid-cols-3 gap-3" aria-label={t.catalog}>
                  {categoryNav.map((item, index) => <Link className="flex min-h-16 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--white)] px-4 text-[14px] font-bold transition hover:border-[var(--accent)] hover:bg-[var(--paper)] hover:text-[var(--accent-deep)]" href={item.href} onClick={closeMenus} key={item.href}><span><small className="mr-2 text-[12px] text-[var(--muted)]">0{index + 1}</small>{item.label}</span><Icon name="chevron" className="size-3" /></Link>)}
                </nav>
              )}
            </div>
          </div>
        )}

        {mobileOpen && (
          <div id="mobile-navigation-menu" className="absolute inset-x-0 top-full max-h-[calc(100dvh-150px)] overflow-auto border-b border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_16px_30px_rgba(32,44,40,.08)] xl:hidden">
            <Link className="flex min-h-12 items-center justify-between rounded-full bg-[var(--accent)] px-5 text-sm font-medium text-white" href={localized(locale, "/catalog")} onClick={closeMenus}>{t.allCategories}<span className="text-lg" aria-hidden="true">↗</span></Link>
            <nav className="mt-3 grid gap-1" aria-label={t.menu}>
              {categoryNav.map((item) => <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium hover:bg-[var(--paper)]" href={item.href} onClick={closeMenus} key={item.href}>{item.label}<Icon name="chevron" className="size-4 text-[var(--muted)]" /></Link>)}
              <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium text-[var(--accent-deep)] hover:bg-[var(--paper)]" href={localized(locale, "/search")} onClick={closeMenus}>{serviceLabels.advanced}<Icon name="search" className="size-4" /></Link>
              <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium hover:bg-[var(--paper)]" href={localized(locale, "/favorites")} onClick={closeMenus}>{t.favorites}<Icon name="heart" className="size-4" /></Link>
              <Link className="flex min-h-12 items-center justify-between rounded-xl px-3 text-sm font-medium hover:bg-[var(--paper)]" href={localized(locale, "/account")} onClick={closeMenus}>{t.account}<Icon name="user" className="size-4" /></Link>
            </nav>
            {rootCategories.length > 0 ? <nav className="mt-4 grid gap-2 border-t border-[var(--line)] pt-4" aria-label={t.allCategories}>{mobileCategoryTree(rootCategories)}</nav> : null}
            <nav className="mt-3 grid grid-cols-2 gap-x-3 border-t border-[var(--line)] pt-3" aria-label={dictionary[locale].footer.lumi}>
              {serviceLinks.map(([label, href]) => <Link className="flex min-h-11 items-center rounded-lg px-3 text-[13px] text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--accent)]" href={href} onClick={closeMenus} key={href}>{label}</Link>)}
            </nav>
            <label className="mt-4 grid gap-2 rounded-2xl bg-[var(--paper)] p-3">
              <span className="px-1 text-[12px] font-medium uppercase tracking-[.1em] text-[var(--muted)]">{languageLabel}</span>
              <span className="relative flex items-center">
                <select className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-[var(--line)] bg-white px-4 pr-10 text-sm font-medium outline-none focus:border-[var(--accent)]" value={locale} onChange={(event) => changeLocale(event.target.value as Locale)} aria-label={languageLabel}>
                  {languageOptions.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
                <Icon name="chevron" className="pointer-events-none absolute right-4 size-4 rotate-90 text-[var(--muted)]" />
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
  const footerLink = "inline-flex min-h-11 items-center text-sm text-[var(--muted)] transition hover:text-[var(--accent)]";
  const extra = { hy: { journal: "Ամսագիր", faq: "Հարցեր և պատասխաններ", recommendations: "Առաջարկում ենք" }, ru: { journal: "Журнал", faq: "Вопросы и ответы", recommendations: "Рекомендуем" }, en: { journal: "Journal", faq: "Help & FAQ", recommendations: "Discover books" } }[locale];
  return (
    <footer className="border-t border-[var(--line)] bg-white text-[var(--ink)]">
      <div className={cx(container, "grid gap-10 py-14 sm:grid-cols-2 sm:gap-x-12 sm:py-16 lg:grid-cols-[1.5fr_.7fr_.8fr_1fr] lg:gap-14")}>
        <div className="max-w-[340px]">
          <Link href={localized(locale)} aria-label={brandName(locale) + " — " + BRAND_LABELS[locale]}><Logo locale={locale} /></Link>
          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{t.about}</p>
          <span className="mt-5 inline-flex items-center gap-2 text-xs text-[var(--muted)]"><span className="size-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />{t.city}</span>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">{t.buyers}</h3>
          <nav className="flex flex-col items-start" aria-label={t.buyers}>
            <Link className={footerLink} href={localized(locale, "/catalog")}>{t.catalog}</Link>
            <Link className={footerLink} href={localized(locale, "/catalog") + "?isNew=true"}>{dictionary[locale].header.new}</Link>
            <Link className={footerLink} href={localized(locale, "/catalog")}>{extra.recommendations}</Link>
            <Link className={footerLink} href={localized(locale, "/favorites")}>{dictionary[locale].header.favorites}</Link>
            <Link className={footerLink} href={localized(locale, "/account")}>{dictionary[locale].header.account}</Link>
          </nav>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[var(--ink)]">{t.lumi}</h3>
          <nav className="flex flex-col items-start" aria-label={t.lumi}>
            <Link className={footerLink} href={localized(locale, "/information") + "#about"}>{t.how}</Link>
            <Link className={footerLink} href={localized(locale, "/information") + "#delivery"}>{t.delivery}</Link>
            <Link className={footerLink} href={localized(locale, "/information") + "#faq"}>{extra.faq}</Link>
            <Link className={footerLink} href={localized(locale, "/journal")}>{extra.journal}</Link>
            <Link className={footerLink} href={localized(locale, "/contacts")}>{t.contacts}</Link>
          </nav>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold">{t.contacts}</h3>
          <p className="max-w-[240px] text-sm leading-7 text-[var(--muted)]">{t.contactHint}</p>
          <Link className="mt-4 inline-flex min-h-11 items-center gap-5 rounded-xl bg-[var(--accent)]/8 px-4 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white" href={localized(locale, "/contacts")}>{t.contacts}<span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--paper)]">
        <div className={cx(container, "flex min-h-[70px] items-center justify-between gap-4 text-xs text-[var(--muted)] max-sm:flex-col max-sm:items-start max-sm:gap-1 max-sm:py-5")}>
          <span>© {new Date().getFullYear()} {brandName(locale)}</span>
          <span className="hidden text-[11px] tracking-[.04em] sm:block">Հայերեն · Русский · English</span>
          <Link className="inline-flex min-h-11 items-center transition hover:text-[var(--accent)]" href={localized(locale, "/information")}>{t.information}</Link>
        </div>
      </div>
    </footer>
  );
}

function Toast() {
  const { notice } = useStorefront();
  return <div className={cx("pointer-events-none fixed bottom-5 right-5 z-[100] flex max-w-[calc(100vw-2.5rem)] translate-y-3 items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 text-sm font-medium text-[var(--accent)] opacity-0 shadow-[0_12px_40px_rgba(32,44,40,.12)] transition", notice && "translate-y-0 opacity-100")} aria-live="polite"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--paper)] text-[13px] text-[var(--accent)]" aria-hidden="true">✓</span>{notice}</div>;
}

export function StorefrontShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <StorefrontProvider locale={locale}>
      <div className="lumi-store min-h-screen overflow-x-clip bg-[var(--paper)] font-sans text-[var(--ink)]">
        <Header /><main>{children}</main><Footer /><Toast />
      </div>
    </StorefrontProvider>
  );
}
