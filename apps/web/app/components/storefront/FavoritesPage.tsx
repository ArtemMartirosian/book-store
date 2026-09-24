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
    <main className="min-h-[72vh] bg-[#f7f8fc] text-[#18192d]">
      <section className="border-b border-[#e3e5ef]"><div className={cx(container, "grid grid-cols-[1fr_.72fr] items-end gap-8 py-14 max-lg:grid-cols-1 max-sm:py-9")}><div><span className={cx(eyebrow, "text-[#6258ff]")}>{t.overline}</span><h1 className="font-display mt-5 text-[clamp(2.7rem,5.5vw,4.75rem)] font-normal leading-[1.06] tracking-[-.03em]">{t.title}<em className="block pt-1 font-normal italic text-[#6258ff]">{t.accent}</em></h1></div><p className="max-w-[500px] pb-1 text-base leading-8 text-[#727789]">{t.intro}</p></div></section>
      <section className={cx(container, "py-12 pb-20")}>
        {favorites.length > 0 ? <><div className="mb-8 flex items-center justify-between"><h2 className={sectionTitle}>{t.overline}</h2><span className="grid size-11 place-items-center rounded-full border border-[#e3e5ef] bg-[#f0eeff] text-sm font-medium text-[#6258ff]">{favorites.length}</span></div><div className="grid grid-cols-4 gap-x-6 gap-y-10 max-xl:grid-cols-3 max-md:grid-cols-2 max-sm:gap-x-4">{favorites.map((book) => <BookCard book={book} variant="compact" key={book.id} />)}</div></> : <div className="grid min-h-[390px] place-items-center rounded-[20px] border border-[#e3e5ef] bg-[#ffffff] p-8 text-center shadow-[0_20px_65px_rgba(36,62,53,.025)]"><div><span className="mx-auto grid size-16 place-items-center rounded-full border border-[#e3e5ef] bg-[#f0eeff] text-3xl text-[#6258ff]">♡</span><h2 className="font-display mt-6 text-[clamp(2rem,4vw,3rem)] font-normal leading-tight tracking-[-.025em]">{t.empty}</h2><p className="mx-auto mt-4 max-w-[460px] text-[14px] leading-6 text-[#727789]">{t.emptyText}</p><Link className="mt-7 inline-flex min-h-12 items-center gap-7 rounded-xl bg-[#6258ff] px-6 text-sm font-medium text-white transition hover:bg-[#5147e2]" href={localized(locale, "/catalog")}>{t.catalog}<span>↗</span></Link></div></div>}
      </section>
    </main>
  );
}
