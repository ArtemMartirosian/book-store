"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { documentLocaleFromPath } from "./lib/document-locale";

const copy = {
  hy: { label: "Էջը չի գտնվել", title: "Այս էջը կորել է տողերի արանքում", description: "Վերադարձեք գրացուցակ՝ ձեր հաջորդ լավ պատմությունը գտնելու համար։", action: "Բացել գրացուցակը" },
  ru: { label: "Страница не найдена", title: "Эта страница потерялась между строк", description: "Вернитесь в каталог — там найдётся следующая хорошая история.", action: "Открыть каталог" },
  en: { label: "Page not found", title: "This page got lost between the lines", description: "Return to the catalog to discover your next great story.", action: "Explore the catalog" },
};

export default function NotFound() {
  const pathname = usePathname();
  const locale = documentLocaleFromPath(pathname);
  const text = copy[locale];

  return (
    <main className="grid min-h-[72vh] place-items-center bg-[#f6f3ed] px-5 py-16 text-[#202722]">
      <section className="max-w-[680px] text-center">
        <span className="inline-flex rounded-full bg-[#e8eee9] px-4 py-2 text-[10px] font-bold text-[#173d32]">{text.label}</span>
        <div className="font-display my-5 text-[clamp(4rem,12vw,8.5rem)] font-semibold leading-none text-[#d9d5cc]" aria-hidden="true">404</div>
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[.98] tracking-[-.045em]">{text.title}</h1>
        <p className="mx-auto mt-5 max-w-[540px] text-[14px] leading-7 text-[#70766f]">{text.description}</p>
        <Link className="mt-7 inline-flex min-h-12 items-center gap-6 rounded-[9px] bg-[#173d32] px-6 text-[12px] font-bold text-white transition hover:bg-[#245343]" href={"/" + locale + "/catalog"}>{text.action} <span>→</span></Link>
      </section>
    </main>
  );
}
