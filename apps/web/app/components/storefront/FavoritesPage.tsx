"use client";

import Link from "next/link";
import { BookCard } from "./BookCard";
import { useStorefront } from "./StorefrontShell";
import { localized, type Locale } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

const copy: Record<Locale, { overline: string; title: string; accent: string; intro: string; empty: string; emptyText: string; catalog: string }> = {
  ru: { overline: "Личная полка", title: "Ваше", accent: "избранное.", intro: "Книги сохраняются в этом браузере и остаются под рукой, пока вы выбираете.", empty: "Полка пока пуста", emptyText: "Нажмите на сердце в каталоге или на странице книги — и она появится здесь.", catalog: "Перейти в каталог" },
  hy: { overline: "Անձնական դարակ", title: "Ձեր", accent: "նախընտրելիները։", intro: "Գրքերը պահվում են այս դիտարկիչում և մնում են հասանելի ընտրության ընթացքում։", empty: "Դարակը դեռ դատարկ է", emptyText: "Սեղմեք սրտիկը կատալոգում կամ գրքի էջում, և այն կհայտնվի այստեղ։", catalog: "Գնալ կատալոգ" },
  en: { overline: "Personal shelf", title: "Your", accent: "favorites.", intro: "Books are saved in this browser and stay close while you make your choice.", empty: "Your shelf is empty", emptyText: "Tap the heart in the catalog or on a book page and it will appear here.", catalog: "Browse catalog" },
};

export function FavoritesPage() {
  const { locale, favorites } = useStorefront();
  const t = copy[locale];
  return (
    <main className="min-h-[72vh] bg-[#f5f6fb]">
      <section className="lumi-grid bg-[#151722] text-white"><div className={cx(container, "grid grid-cols-[1fr_.72fr] items-end gap-12 py-16 max-lg:grid-cols-1 max-sm:py-10")}><div><span className={cx(eyebrow, "bg-white/8 text-[#d9ff69]")}>{t.overline}</span><h1 className="mt-6 text-[clamp(3.3rem,7vw,7rem)] font-black leading-[.84] tracking-[-.08em]">{t.title}<em className="block pt-2 not-italic text-[#8d85ff]">{t.accent}</em></h1></div><p className="max-w-[500px] text-[12px] leading-6 text-white/58">{t.intro}</p></div></section>
      <section className={cx(container, "py-12 pb-20")}>
        {favorites.length > 0 ? <><div className="mb-8 flex items-center justify-between"><h2 className={sectionTitle}>{t.overline}</h2><span className="grid size-11 place-items-center rounded-full bg-[#d9ff69] text-[12px] font-black">{favorites.length}</span></div><div className="grid grid-cols-4 gap-3 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:grid-cols-1">{favorites.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div></> : <div className="grid min-h-[390px] place-items-center rounded-[30px] border border-[#e1e2eb] bg-white p-8 text-center shadow-[0_20px_65px_rgba(35,38,70,.05)]"><div><span className="mx-auto grid size-16 place-items-center rounded-[22px] bg-[#f0efff] text-3xl text-[#6258ff]">♡</span><h2 className="mt-6 text-[clamp(2.2rem,4vw,3.6rem)] font-black tracking-[-.06em]">{t.empty}</h2><p className="mx-auto mt-4 max-w-[460px] text-[11px] leading-6 text-[#737685]">{t.emptyText}</p><Link className="mt-7 inline-flex min-h-13 items-center gap-7 rounded-2xl bg-[#6258ff] px-6 text-[9px] font-black uppercase tracking-[.08em] text-white" href={localized(locale, "/catalog")}>{t.catalog}<span>↗</span></Link></div></div>}
      </section>
    </main>
  );
}
