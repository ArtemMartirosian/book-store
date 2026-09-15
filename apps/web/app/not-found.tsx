"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname();
  const segment = pathname.split("/")[1];
  const locale = ["ru", "hy", "en"].includes(segment) ? segment : "ru";

  return (
    <main className="grid min-h-[72vh] place-items-center bg-[#f6f3ed] px-5 py-16 text-[#202722]">
      <section className="max-w-[680px] text-center">
        <span className="inline-flex rounded-full bg-[#f3ded3] px-4 py-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#a94728]">Ошибка 404</span>
        <div className="font-display my-5 text-[clamp(4rem,12vw,8.5rem)] font-semibold leading-none text-[#d9d5cc]" aria-hidden="true">404</div>
        <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[.98] tracking-[-.045em]">Эта страница потерялась между строк</h1>
        <p className="mx-auto mt-5 max-w-[540px] text-[14px] leading-7 text-[#70766f]">Вернитесь в каталог — там точно найдётся следующая хорошая история.</p>
        <Link className="mt-7 inline-flex min-h-12 items-center gap-6 rounded-[9px] bg-[#c85f3a] px-6 text-[10px] font-bold uppercase tracking-[.06em] text-white transition hover:bg-[#a94728]" href={"/" + locale + "/catalog"}>Открыть каталог <span>→</span></Link>
      </section>
    </main>
  );
}
