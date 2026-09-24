"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { documentLocaleFromPath } from "./lib/document-locale";

const copy = {
  hy: { title: "Էջը ժամանակավորապես անհասանելի է", description: "Խնդրում ենք կրկին փորձել մի փոքր ուշ։", retry: "Կրկին փորձել", home: "Գլխավոր էջ" },
  ru: { title: "Страница временно недоступна", description: "Попробуйте ещё раз немного позже.", retry: "Попробовать снова", home: "На главную" },
  en: { title: "This page is temporarily unavailable", description: "Please try again in a moment.", retry: "Try again", home: "Back to home" },
};

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = documentLocaleFromPath(usePathname());
  const text = copy[locale];
  return (
    <main className="grid min-h-[72vh] place-items-center bg-[#f7f8fc] px-5 py-16 text-[#6258ff]">
      <section className="max-w-xl text-center">
        <h1 className="font-display text-4xl font-semibold">{text.title}</h1>
        <p className="my-5 text-sm text-[#727789]">{text.description}</p>
        <button onClick={reset} className="rounded-xl bg-[#6258ff] px-6 py-3 text-white">{text.retry}</button>
        <Link href={`/${locale}`} className="mt-5 block underline underline-offset-4">{text.home}</Link>
      </section>
    </main>
  );
}
