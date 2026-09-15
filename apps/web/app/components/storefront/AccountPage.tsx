"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

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
    <div className="min-h-[70vh] bg-[#f5f6fb] py-10 max-sm:py-4">
      <div className={cx(container, "grid grid-cols-[.9fr_1.1fr] overflow-hidden rounded-[34px] border border-[#e2e4ed] bg-white shadow-[0_28px_80px_rgba(39,42,72,.1)] max-lg:grid-cols-1 max-sm:rounded-[24px]")}>
        <section className="lumi-mesh lumi-grid relative flex min-h-[650px] flex-col justify-between overflow-hidden p-[clamp(2rem,5vw,4.5rem)] text-white max-lg:min-h-[430px] max-sm:min-h-[390px]">
          <div className="absolute -bottom-32 -right-28 size-[380px] rounded-full border-[60px] border-white/8" />
          <div className="relative z-10"><span className={cx(eyebrow, "bg-white/10 text-[#d9ff69]")}>{t.overline}</span><h1 className={cx(sectionTitle, "my-6 max-w-[620px] text-white")}>{t.title}<br /><em className="not-italic text-[#d9ff69]">{t.accent}</em></h1><p className="max-w-[470px] text-[12px] leading-7 text-white/58">{t.intro}</p></div>
          <div className="relative z-10 max-w-[460px] rounded-[22px] border border-white/12 bg-white/[.07] p-5 backdrop-blur"><blockquote className="text-[18px] font-bold leading-7 text-white/82">{t.quote}</blockquote><small className="mt-4 block text-[8px] font-black uppercase tracking-[.14em] text-[#d9ff69]">{t.team}</small></div>
        </section>

        <section className="flex flex-col items-center justify-center px-[clamp(2rem,7vw,6rem)] py-16 max-sm:px-5 max-sm:py-10">
          <div className="w-[min(430px,100%)]">
            {!sent ? <>
              <span className={eyebrow}>{t.passwordless}</span>
              <h2 className="mb-4 mt-5 text-[44px] font-black leading-[.9] tracking-[-.065em]">{t.welcome}</h2>
              <p className="mb-8 text-[11px] leading-6 text-[#737685]">{t.prompt}</p>
              <form onSubmit={sendCode}>
                <label className="grid gap-2 text-[9px] font-black uppercase tracking-[.06em] text-[#666978]">{t.phone}<div className="flex min-h-14 items-center rounded-2xl border border-[#dfe1ea] bg-[#f6f7fb] focus-within:border-[#6258ff] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(98,88,255,.08)]"><b className="border-r border-[#dfe1ea] px-4 text-[12px] font-black">+374</b><input className="min-h-14 min-w-0 flex-1 bg-transparent px-4 text-[13px] outline-none" value={phone} onChange={(event) => { setPhone(event.target.value); setAuthError(""); }} required inputMode="tel" placeholder="00 00 00 00" aria-label={t.phone} /></div></label>
                <button className="mt-3.5 flex min-h-14 w-full items-center justify-between rounded-2xl bg-[#6258ff] px-5 text-[9px] font-black uppercase tracking-[.07em] text-white shadow-[0_14px_32px_rgba(98,88,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#473dd4]" type="submit">{t.getCode}<span className="text-lg">↗</span></button>
                {authError && <p className="mt-3 rounded-[9px] border border-[#e5b8a8] bg-[#f3ded3] p-3 text-[10px] leading-5 text-[#8f3e27]" role="alert">{authError}</p>}
              </form>
              <div className="relative my-7 border-t border-[#e2e4ed] text-center"><span className="relative -top-2 bg-white px-3 text-[9px] text-[#858897]">{t.or}</span></div>
              <Link className="block text-center text-[9px] font-black uppercase tracking-[.07em] text-[#5147e2]" href={localized(locale, "/catalog")}>{t.guest} ↗</Link>
            </> : <>
              <button className="mb-7 text-[10px] text-[#70766f] underline underline-offset-4" type="button" onClick={() => setSent(false)}>← {t.back}</button>
              <span className={eyebrow}>{t.sent}</span><h2 className="font-display mb-3 mt-3 text-[42px] font-semibold leading-[.95]">{t.checkPhone}</h2><p className="mb-7 text-[12px] leading-6 text-[#70766f]">{t.codeText} +374 {phone}.</p>
              <form onSubmit={(event) => event.preventDefault()}><div className="grid grid-cols-4 gap-2.5">{[0,1,2,3].map((item) => <input className="h-16 w-full rounded-[9px] border border-[#d3cfc6] bg-[#f8f6f1] text-center text-2xl font-semibold outline-none focus:border-[#c85f3a]" key={item} aria-label={t.digit + " " + (item + 1)} inputMode="numeric" maxLength={1} />)}</div><button className="mt-3.5 flex min-h-13 w-full items-center justify-between rounded-[9px] bg-[#c85f3a] px-5 text-[10px] font-bold uppercase text-white" type="submit">{t.signIn}<span>→</span></button></form>
              <button className="mx-auto mt-5 block text-[10px] text-[#70766f] underline underline-offset-4" type="button">{t.resend}</button>
            </>}
            <small className="mt-7 block text-center text-[8px] leading-4 text-[#92978f]">{t.legal}</small>
          </div>

          <div className="mt-12 grid w-[min(560px,100%)] grid-cols-3 gap-3 border-t border-[#e2e4ed] pt-6 max-sm:grid-cols-1">
            {t.benefits.map(([title, text], index) => <div className="rounded-2xl bg-[#f6f7fb] p-3" key={title}><span className="text-[8px] font-black text-[#5147e2]">0{index + 1}</span><p className="mt-2 grid gap-1"><strong className="text-[10px] font-bold">{title}</strong><small className="text-[8px] leading-4 text-[#7c7f8d]">{text}</small></p></div>)}
          </div>
        </section>
      </div>
    </div>
  );
}
