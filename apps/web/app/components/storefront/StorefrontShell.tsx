"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Book } from "../../lib/types";
import { dictionary, localized, locales, type Locale } from "./i18n";
import { container, cx } from "./ui";

export type CartLine = { book: Book; quantity: number };

type StorefrontContextValue = {
  locale: Locale;
  cart: CartLine[];
  cartCount: number;
  cartSubtotal: number;
  addToCart: (book: Book, quantity?: number) => void;
  setQuantity: (bookId: string, quantity: number) => void;
  removeFromCart: (bookId: string) => void;
  clearCart: () => void;
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
    <span className={cx("inline-flex items-center gap-3 text-[#111]", inverse && "text-white")}>
      <span className={cx("grid size-10 place-items-center rounded-[11px] bg-[#2447ff] text-[18px] font-black tracking-[-.08em] text-white", inverse && "bg-[#d9ff57] text-[#111]")} aria-hidden="true">L</span>
      <span className="text-[21px] font-black leading-none tracking-[-.075em]">LUMI<span className="ml-1.5 text-[8px] font-extrabold tracking-[.06em] opacity-50">/BOOKS</span></span>
    </span>
  );
}

function StorefrontProvider({ children, locale }: { children: ReactNode; locale: Locale }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notice, setNotice] = useState("");
  const loaded = useRef(false);
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
      loaded.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try { window.localStorage.setItem("lumi-cart", JSON.stringify(cart)); } catch { /* No-op. */ }
  }, [cart]);

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
    cartCount,
    cartSubtotal,
    addToCart,
    setQuantity,
    removeFromCart: (bookId) => setCart((current) => current.filter((line) => line.book.id !== bookId)),
    clearCart: () => setCart([]),
    notice,
  };

  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

function Header() {
  const pathname = usePathname();
  const { locale, cartCount } = useStorefront();
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = dictionary[locale].header;
  const categoryNav = [
    { href: `${localized(locale, "/catalog")}?sort=new`, label: t.new },
    { href: `${localized(locale, "/catalog")}?sort=popular`, label: t.bestsellers },
    { href: `${localized(locale, "/catalog")}?language=hy`, label: t.armenian },
    { href: `${localized(locale, "/catalog")}?language=en`, label: t.english },
    { href: `${localized(locale, "/catalog")}?category=classics`, label: t.classics },
    { href: `${localized(locale, "/catalog")}?category=self-development`, label: t.selfDevelopment },
    { href: `${localized(locale)}#delivery`, label: t.delivery },
  ];
  const localePath = (next: Locale) => pathname.replace(/^\/(ru|hy|en)(?=\/|$)/, `/${next}`) || `/${next}`;
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    if (!String(new FormData(event.currentTarget).get("q") ?? "").trim()) event.preventDefault();
  };

  return (
    <>
      <div className="border-b border-black bg-[#d9ff57] text-[#111]">
        <div className={cx(container, "flex min-h-8 items-center justify-between gap-5 text-[9px] font-black uppercase tracking-[.08em]")}>
          <span>{t.announcement}</span>
          <div className="flex items-center gap-5 max-md:hidden"><span>{t.city}</span><span>●</span><span>{t.cash}</span><Link className="underline decoration-1 underline-offset-4" href={`${localized(locale)}#delivery`}>{t.howOrder}</Link></div>
        </div>
      </div>
      <header className="sticky top-0 z-50 border-b-2 border-black bg-[#f7f7f2]/95 backdrop-blur-xl">
        <div className={cx(container, "grid min-h-[78px] grid-cols-[auto_auto_minmax(260px,1fr)_auto] items-center gap-4 max-lg:grid-cols-[1fr_auto] max-lg:py-3")}>
          <Link href={localized(locale)} aria-label="LUMI Books"><Logo /></Link>
          <Link className="flex h-12 items-center gap-3 rounded-[13px] bg-[#111] px-5 text-[10px] font-black uppercase tracking-[.05em] text-white transition hover:bg-[#2447ff] max-lg:hidden" href={localized(locale, "/catalog")}><span aria-hidden="true">▦</span>{t.catalog}</Link>
          <form className="flex h-12 min-w-0 items-center border-2 border-black bg-white pl-4 pr-1 max-lg:order-3 max-lg:col-span-2 max-lg:w-full" action={localized(locale, "/catalog")} onSubmit={submitSearch}>
            <span className="mr-3 text-xl font-black" aria-hidden="true">⌕</span>
            <input className="min-w-0 flex-1 bg-transparent text-[11px] font-bold outline-none placeholder:text-black/40" name="q" placeholder={t.search} aria-label={t.search} />
            <button className="h-10 bg-[#2447ff] px-6 text-[9px] font-black uppercase tracking-[.06em] text-white transition hover:bg-[#111]" type="submit">{t.searchButton}</button>
          </form>
          <div className="flex items-center gap-2 justify-self-end">
            <div className="flex border-2 border-black bg-white max-sm:hidden" aria-label="Language">{locales.map((item) => <a className={cx("grid h-8 w-9 place-items-center text-[8px] font-black uppercase", locale === item && "bg-[#111] text-white")} href={localePath(item)} hrefLang={item} lang={item} key={item}>{item}</a>)}</div>
            <Link className="px-2 py-3 text-[9px] font-black uppercase tracking-[.04em] max-xl:hidden" href={localized(locale, "/account")}>{t.account}</Link>
            <Link className="flex h-11 items-center gap-2 rounded-[12px] bg-[#2447ff] px-4 text-[9px] font-black uppercase tracking-[.04em] text-white" href={localized(locale, "/cart")} aria-label={`${t.cart}: ${cartCount}`}><span>{t.cart}</span><b className="grid size-5 place-items-center rounded-full bg-[#d9ff57] text-[8px] text-[#111]">{cartCount}</b></Link>
            <button className="hidden size-11 flex-col justify-center gap-1.5 rounded-[12px] border-2 border-black p-3 max-lg:flex" type="button" aria-label={t.menu} aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)}><span className="h-0.5 w-full bg-black" /><span className="h-0.5 w-full bg-black" /></button>
          </div>
        </div>
        <div className="border-t border-black/15 bg-white">
          <nav className={cx(container, "flex min-h-10 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden")} aria-label={t.catalog}>{categoryNav.map((item, index) => <Link className={cx("shrink-0 border-r border-black/15 px-5 py-3 text-[8px] font-black uppercase tracking-[.07em] transition hover:bg-[#d9ff57]", index === 0 && "border-l")} href={item.href} key={item.href}>{item.label}</Link>)}</nav>
        </div>
        {mobileOpen && <div className="absolute inset-x-0 top-full border-b-2 border-black bg-[#f7f7f2] px-5 pb-6 shadow-2xl"><nav className="grid" aria-label={t.menu}>{[{ href: localized(locale, "/catalog"), label: t.catalog }, ...categoryNav].map((item) => <Link className="flex justify-between border-b border-black/15 py-4 text-lg font-black tracking-[-.03em]" href={item.href} onClick={() => setMobileOpen(false)} key={item.href}>{item.label}<span>↗</span></Link>)}</nav><div className="mt-5 flex border-2 border-black">{locales.map((item) => <a className={cx("grid h-11 flex-1 place-items-center text-[9px] font-black uppercase", locale === item && "bg-[#111] text-white")} href={localePath(item)} hrefLang={item} lang={item} key={item}>{item}</a>)}</div></div>}
      </header>
    </>
  );
}

function Footer() {
  const { locale } = useStorefront();
  const t = dictionary[locale].footer;
  const slogan = {
    hy: ["ԿԱՐԴԱ։", "ԿՐԿԻՆ։"],
    ru: ["ЧИТАЙ.", "СНОВА."],
    en: ["READ.", "REPEAT."],
  }[locale];
  return (
    <footer className="border-t-2 border-black bg-[#0b0c10] px-[max(2rem,calc((100vw-1440px)/2))] py-16 text-white max-sm:px-6">
      <div className="mb-14 flex items-end justify-between gap-8 border-b border-white/12 pb-12 max-md:items-start max-md:flex-col">
        <div><Link href={localized(locale)}><Logo inverse /></Link><p className="mt-6 max-w-[390px] text-[12px] font-medium leading-6 text-white/45">{t.about}</p></div>
        <strong className="text-right text-[clamp(3rem,7vw,7rem)] font-black leading-[.72] tracking-[-.09em] text-[#6558ff] max-md:text-left">{slogan[0]}<br /><span className="text-[#c9ff3d]">{slogan[1]}</span></strong>
      </div>
      <div className="grid grid-cols-[1.5fr_.7fr_.7fr_.8fr] gap-16 border-b border-white/12 pb-12 max-lg:grid-cols-2 max-sm:gap-9">
        <div className="max-sm:col-span-2"><span className="text-[9px] font-black uppercase tracking-[.12em] text-[#c9ff3d]">Yerevan / Armenia</span><p className="mt-4 max-w-[280px] text-[10px] font-medium leading-5 text-white/38">{t.about}</p></div>
        <div className="flex flex-col gap-3"><h3 className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-white/30">{t.buyers}</h3><Link className="text-[11px] font-bold text-white/72 transition hover:text-[#c9ff3d]" href={localized(locale, "/catalog")}>{t.catalog}</Link><Link className="text-[11px] font-bold text-white/72 transition hover:text-[#c9ff3d]" href={`${localized(locale)}#delivery`}>{t.delivery}</Link><Link className="text-[11px] font-bold text-white/72 transition hover:text-[#c9ff3d]" href={localized(locale, "/account")}>{t.orders}</Link></div>
        <div className="flex flex-col gap-3"><h3 className="mb-2 text-[9px] font-black uppercase tracking-[.14em] text-white/30">{t.lumi}</h3><Link className="text-[11px] font-bold text-white/72 transition hover:text-[#c9ff3d]" href={`${localized(locale)}#about`}>{t.how}</Link><Link className="text-[11px] font-bold text-white/72 transition hover:text-[#c9ff3d]" href={`${localized(locale)}#delivery`}>{t.delivery}</Link><Link className="text-[11px] font-bold text-white/72 transition hover:text-[#c9ff3d]" href={localized(locale, "/account")}>{t.orders}</Link></div>
        <div className="flex flex-col gap-2 max-sm:col-span-2"><span className="text-[9px] font-black uppercase tracking-[.12em] text-white/30">{t.daily}</span><strong className="text-2xl font-black tracking-[-.05em]">10:00–20:00</strong><small className="text-[9px] font-medium text-white/42">{t.reply}</small></div>
      </div>
      <div className="flex justify-between pt-5 text-[8px] font-bold uppercase tracking-[.08em] text-white/28 max-sm:flex-col max-sm:gap-2"><span>© 2026 LUMI Books</span><span>{t.city}</span><span>{t.privacy}</span></div>
    </footer>
  );
}

function Toast() {
  const { notice } = useStorefront();
  return <div className={cx("pointer-events-none fixed bottom-6 right-6 z-[100] flex max-w-[calc(100vw-3rem)] translate-y-4 items-center gap-3 rounded-[14px] border-2 border-[#c9ff3d] bg-[#0b0c10] px-5 py-4 text-[11px] font-bold text-white opacity-0 shadow-2xl transition", notice && "translate-y-0 opacity-100")} aria-live="polite"><span className="grid size-6 place-items-center rounded-[8px] bg-[#c9ff3d] text-[9px] font-black text-[#0b0c10]">✓</span>{notice}</div>;
}

export function StorefrontShell({ children, locale }: { children: ReactNode; locale: Locale }) {
  return (
    <StorefrontProvider locale={locale}>
      <div className="min-h-screen overflow-hidden bg-[#f7f7f2] font-sans text-[#111] selection:bg-[#d9ff57] selection:text-[#111]">
        <Header /><main>{children}</main><Footer /><Toast />
      </div>
    </StorefrontProvider>
  );
}
