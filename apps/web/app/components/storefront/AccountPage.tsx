"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Logo, useStorefront } from "./StorefrontShell";
import { dictionary, localized } from "./i18n";
import { cx, eyebrow } from "./ui";

export function AccountPage() {
  const { locale } = useStorefront();
  const t = dictionary[locale].account;
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const sendCode = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(t.authUnavailable);
  };

  return (
    <div className="grid min-h-[760px] grid-cols-[1.05fr_.95fr] max-lg:grid-cols-1">
      <section className="relative flex min-h-[760px] flex-col justify-between overflow-hidden bg-[#0b0c10] px-[max(3.5rem,calc((100vw-1440px)/2))] py-16 text-white max-lg:min-h-[680px] max-sm:min-h-[630px] max-sm:px-6 max-sm:py-12">
        <div className="absolute -bottom-44 -right-36 size-[520px] rounded-[100px] bg-[#6558ff] opacity-90" />
        <Link className="relative z-10 self-start" href={localized(locale)}><Logo inverse /></Link>
        <div className="relative z-10"><span className={cx(eyebrow, "text-[#c9ff3d]")}>{t.overline}</span><h1 className="my-6 text-[clamp(3.8rem,7vw,7rem)] font-black leading-[.8] tracking-[-.085em]">{t.title}<br /><em className="not-italic text-[#8f85ff]">{t.accent}</em></h1><p className="max-w-[490px] text-[13px] font-medium leading-7 text-white/55 max-sm:text-[11px]">{t.intro}</p></div>
        <div className="relative z-10 max-w-[460px] border-l-4 border-[#c9ff3d] pl-6"><blockquote className="text-[15px] font-black leading-6 text-white/82">{t.quote}</blockquote><small className="mt-3 block text-[8px] font-bold uppercase tracking-[.12em] text-white/40">{t.team}</small></div>
      </section>

      <section className="flex flex-col items-center justify-center bg-[#f1f2f4] px-[clamp(3rem,7vw,7rem)] py-20 max-sm:px-6 max-sm:py-16">
        <div className="w-[min(420px,100%)]">
          {!sent ? <>
            <span className={eyebrow}>{t.passwordless}</span><h2 className="mb-3 mt-3 text-[48px] font-black leading-[.88] tracking-[-.07em]">{t.welcome}</h2><p className="mb-7 text-[11px] font-medium leading-5 text-black/48">{t.prompt}</p>
            <form onSubmit={sendCode}><label className="grid gap-2 text-[9px] font-black uppercase text-black/55">{t.phone}<div className="flex h-14 items-center rounded-[12px] border-2 border-black bg-white"><b className="border-r-2 border-black px-3.5 text-[11px]">+374</b><input className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-xs font-bold outline-none" value={phone} onChange={(event) => { setPhone(event.target.value); setAuthError(""); }} required inputMode="tel" placeholder="00 00 00 00" /></div></label><button className="mt-3.5 flex h-14 w-full items-center justify-between rounded-[12px] bg-[#2447ff] px-6 text-[10px] font-black uppercase text-white transition hover:bg-[#0b0c10]" type="submit">{t.getCode}<span className="text-lg">→</span></button>{authError && <p className="mt-3 rounded-[12px] border-2 border-black bg-[#ff715b] p-3 text-[9px] font-bold leading-4 text-[#0b0c10]" role="alert">{authError}</p>}</form>
            <div className="relative my-6 border-t border-black/12 text-center"><span className="relative -top-2 bg-[#f1f2f4] px-3 text-[8px] font-bold text-black/42">{t.or}</span></div><Link className="block text-center text-[10px] font-black underline decoration-2 underline-offset-4" href={localized(locale, "/catalog")}>{t.guest}</Link>
          </> : <>
            <button className="mb-7 border-b border-black/35 bg-transparent pb-1 text-[9px] font-bold text-black/45" type="button" onClick={() => setSent(false)}>← {t.back}</button><span className={eyebrow}>{t.sent}</span><h2 className="mb-3 mt-3 text-[48px] font-black leading-[.88] tracking-[-.07em]">{t.checkPhone}</h2><p className="mb-7 text-[11px] font-medium leading-5 text-black/45">{t.codeText} +374 {phone}.</p><form onSubmit={(event) => event.preventDefault()}><div className="grid grid-cols-4 gap-2.5">{[0,1,2,3].map((item) => <input className="h-16 w-full rounded-[12px] border-2 border-black bg-white text-center text-2xl font-black outline-none focus:border-[#6558ff]" key={item} aria-label={`${t.digit} ${item + 1}`} inputMode="numeric" maxLength={1} />)}</div><button className="mt-3.5 flex h-13 w-full items-center justify-between rounded-[12px] bg-[#2447ff] px-6 text-[10px] font-black uppercase text-white" type="submit">{t.signIn}<span>→</span></button></form><button className="mx-auto mt-5 block border-b border-black/35 bg-transparent pb-1 text-[9px] font-bold text-black/45" type="button">{t.resend}</button>
          </>}
          <small className="mt-7 block text-center text-[7px] font-medium leading-3 text-black/32">{t.legal}</small>
        </div>
        <div className="mt-16 grid w-[min(520px,100%)] grid-cols-3 gap-4 max-sm:grid-cols-1">{t.benefits.map(([title, text], index) => <div className="grid grid-cols-[30px_1fr] border-t-2 border-black pt-3" key={title}><span className="text-[9px] font-black text-[#6558ff]">0{index + 1}</span><p className="grid gap-1"><strong className="text-[11px] font-black">{title}</strong><small className="text-[7px] font-medium leading-3 text-black/42">{text}</small></p></div>)}</div>
      </section>
    </div>
  );
}
