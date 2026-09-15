"use client";

import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";
import { formatAmd } from "../../lib/catalog-data";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, localizeBookCategory } from "./i18n";
import { container, cx, eyebrow, primaryButton, sectionTitle } from "./ui";

const DELIVERY_PRICE = 1000;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1").replace(/\/$/, "");
const PRICING_RULE_VERSION = "amd-fixed-v1";
const CHECKOUT_IDENTITY_STORAGE_KEY = "lumi-checkout-idempotency-v1";

type CreatedOrder = {
  orderNumber: string;
  totalAmd: number;
};

type RequestIdentity = { fingerprint: string; key: string };
type ApiErrorPayload = {
  code?: string;
  message?: string | string[] | { code?: string };
  currentTotalAmd?: number;
  currentPricingRuleVersion?: string;
};
type QuoteOverride = { cartKey: string; totalAmd: number; pricingRuleVersion: string };

function apiErrorCode(payload: ApiErrorPayload | null) {
  if (payload?.code) return payload.code;
  return payload?.message && typeof payload.message === "object" && !Array.isArray(payload.message)
    ? payload.message.code
    : undefined;
}

async function fingerprint(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readPersistedIdentity(expectedFingerprint: string): RequestIdentity | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CHECKOUT_IDENTITY_STORAGE_KEY) ?? "null") as Partial<RequestIdentity> | null;
    if (parsed?.fingerprint === expectedFingerprint && typeof parsed.key === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(parsed.key)) {
      return { fingerprint: parsed.fingerprint, key: parsed.key };
    }
  } catch { /* A fresh key is safer than trusting malformed browser state. */ }
  return null;
}

function persistIdentity(identity: RequestIdentity) {
  try { window.localStorage.setItem(CHECKOUT_IDENTITY_STORAGE_KEY, JSON.stringify(identity)); } catch { /* In-memory retry still works. */ }
}

function clearPersistedIdentity() {
  try { window.localStorage.removeItem(CHECKOUT_IDENTITY_STORAGE_KEY); } catch { /* No-op. */ }
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("374")) return `+${digits}`;
  if (digits.length === 9 && digits.startsWith("0")) return `+374${digits.slice(1)}`;
  if (digits.length === 8) return `+374${digits}`;
  return `+${digits}`;
}

export function CartPage() {
  const { cart, cartCount, cartSubtotal, setQuantity, removeFromCart, clearCart, locale } = useStorefront();
  const t = dictionary[locale].cart;
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success">("idle");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [quoteOverride, setQuoteOverride] = useState<QuoteOverride | null>(null);
  const requestIdentity = useRef<RequestIdentity | null>(null);
  const cartKey = cart
    .map(({ book, quantity }) => `${book.id}:${quantity}`)
    .sort()
    .join("|");
  const activeQuote = quoteOverride?.cartKey === cartKey ? quoteOverride : null;
  const localTotalAmd = cartSubtotal + DELIVERY_PRICE;
  const displayedTotalAmd = activeQuote?.totalAmd ?? localTotalAmd;
  const displayedPricingRuleVersion = activeQuote?.pricingRuleVersion ?? PRICING_RULE_VERSION;
  const serverAdjustmentAmd = displayedTotalAmd - localTotalAmd;

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitState === "submitting") return;

    const form = new FormData(event.currentTarget);
    const district = String(form.get("district") ?? "");
    const address = String(form.get("address") ?? "").trim();
    const deliveryWindow = String(form.get("deliveryWindow") ?? "").trim();
    const comment = String(form.get("comment") ?? "").trim();

    setSubmitState("submitting");
    setSubmitError("");

    try {
      const body = JSON.stringify({
        locale,
        items: cart.map(({ book, quantity }) => ({ productId: book.id, quantity })),
        customer: {
          fullName: String(form.get("name") ?? "").trim(),
          phone: normalizePhone(String(form.get("phone") ?? "")),
        },
        delivery: {
          city: "YEREVAN",
          district,
          addressLine: address,
          notes: [deliveryWindow, comment].filter(Boolean).join(" · ") || undefined,
        },
        paymentMethod: "CASH_ON_DELIVERY",
        acceptsPreliminaryAvailability: true,
        expectedTotalAmd: displayedTotalAmd,
        expectedPricingRuleVersion: displayedPricingRuleVersion,
      });
      const bodyFingerprint = await fingerprint(body);
      if (!requestIdentity.current || requestIdentity.current.fingerprint !== bodyFingerprint) {
        requestIdentity.current = readPersistedIdentity(bodyFingerprint) ?? {
          fingerprint: bodyFingerprint,
          key: crypto.randomUUID(),
        };
        persistIdentity(requestIdentity.current);
      }

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": requestIdentity.current.key,
        },
        body,
      });

      const payload = await response.json().catch(() => null) as (CreatedOrder & ApiErrorPayload) | null;
      if (!response.ok) {
        if (
          response.status === 409 &&
          apiErrorCode(payload) === "QUOTE_CHANGED" &&
          Number.isSafeInteger(payload?.currentTotalAmd) &&
          (payload?.currentTotalAmd ?? 0) > 0 &&
          typeof payload?.currentPricingRuleVersion === "string" &&
          payload.currentPricingRuleVersion.length > 0 &&
          payload.currentPricingRuleVersion.length <= 64
        ) {
          const currentTotalAmd = payload.currentTotalAmd as number;
          setQuoteOverride({
            cartKey,
            totalAmd: currentTotalAmd,
            pricingRuleVersion: payload.currentPricingRuleVersion,
          });
          requestIdentity.current = null;
          clearPersistedIdentity();
          setSubmitState("idle");
          setSubmitError(`${t.quoteChanged} ${formatAmd(currentTotalAmd)}`);
          return;
        }
        throw new Error(`Order API returned ${response.status}`);
      }
      if (!payload?.orderNumber || !Number.isSafeInteger(payload.totalAmd)) throw new Error("Order API returned an invalid response");

      setOrderNumber(payload.orderNumber);
      setOrderTotal(payload.totalAmd);
      setQuoteOverride(null);
      setSubmitState("success");
      requestIdentity.current = null;
      clearPersistedIdentity();
      clearCart();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitState("idle");
      setSubmitError(t.submitError);
    }
  };

  if (submitState === "success") return (
    <div className="min-h-[70vh] bg-[#f5f6fb]">
      <div className={cx(container, "flex min-h-[650px] flex-col items-center justify-center px-5 py-16 text-center")}>
        <span className="mb-6 grid size-16 place-items-center rounded-[22px] bg-[#d9ff69] text-xl font-black text-[#151722] shadow-[0_16px_35px_rgba(150,180,55,.2)]">✓</span>
        <small className={eyebrow}>{t.successPrefix} #{orderNumber}</small>
        <h1 className={cx(sectionTitle, "my-4 max-w-[680px] whitespace-pre-line")}>{t.successTitle}</h1>
        <p className="max-w-[560px] text-[13px] leading-7 text-[#70766f]">{t.successText}</p>
        <p className="mt-5 rounded-full bg-[#f3ded3] px-5 py-2 text-[10px] font-bold text-[#a94728]">{t.successTotal}: {formatAmd(orderTotal)}</p>
        <div className="my-7 rounded-[22px] border border-[#e2e4ed] bg-white px-7 py-5 text-left shadow-[0_16px_45px_rgba(39,42,72,.06)]">
          <strong className="text-[9px] font-bold uppercase tracking-[.08em]">{t.next}</strong>
          <ol className="mt-3 flex gap-8 max-sm:flex-col max-sm:gap-2">{t.nextSteps.map((step, stepIndex) => <li className="flex items-center gap-2 text-[10px] text-[#70766f]" key={step}><span className="grid size-5 place-items-center rounded-full bg-[#dce6dc] text-[8px] font-bold text-[#2f7654]">{stepIndex + 1}</span>{step}</li>)}</ol>
        </div>
        <Link className={primaryButton} href={localized(locale, "/catalog")}>{t.backCatalog}<span>→</span></Link>
      </div>
    </div>
  );

  if (cart.length === 0) return (
    <div className="min-h-[70vh] bg-[#f5f6fb]">
      <div className={cx(container, "pb-20")}>
        <nav className="flex min-h-14 items-center gap-2 text-[10px] text-[#858b84]"><Link href={localized(locale)}>{t.home}</Link><span>/</span><span>{t.cart}</span></nav>
        <div className="flex min-h-[560px] flex-col items-center justify-center px-5 text-center">
          <div className="relative mb-8 h-[130px] w-[165px]" aria-hidden="true"><i className="absolute bottom-0 left-2 h-[108px] w-[68px] -rotate-6 rounded-[5px_11px_11px_5px] bg-[#d9ff69] shadow-xl" /><i className="absolute bottom-0 right-2 h-[118px] w-[72px] rotate-6 rounded-[5px_11px_11px_5px] bg-[#6258ff] shadow-xl" /><span className="absolute -right-2 top-0 grid size-10 place-items-center rounded-2xl bg-[#151722] text-lg font-black text-white">+</span></div>
          <span className={eyebrow}>{t.emptyOverline}</span>
          <h1 className={cx(sectionTitle, "mt-3")}>{t.emptyTitle}</h1>
          <p className="my-5 max-w-[440px] text-[13px] leading-6 text-[#70766f]">{t.emptyText}</p>
          <Link className={primaryButton} href={localized(locale, "/catalog")}>{t.toCatalog}<span>→</span></Link>
        </div>
      </div>
    </div>
  );

  const inputClass = "w-full rounded-2xl border border-[#dfe1ea] bg-[#f7f7fb] px-4 py-3.5 text-[11px] outline-none transition placeholder:text-[#9a9dac] focus:border-[#6258ff] focus:bg-white focus:shadow-[0_0_0_4px_rgba(98,88,255,.08)]";
  const fieldClass = "grid gap-2 text-[9px] font-black uppercase tracking-[.055em] text-[#686b7a]";

  return (
    <div className="min-h-[70vh] bg-[#f5f6fb]">
      <div className={cx(container, "pb-20")}>
        <nav className="flex min-h-14 items-center gap-2 text-[10px] text-[#858b84]"><Link href={localized(locale)}>{t.home}</Link><span>/</span><span>{t.cart}</span></nav>
        <header className="pb-10 pt-7"><span className={eyebrow}>{t.selection}</span><h1 className="my-5 text-[clamp(3.2rem,6vw,6rem)] font-black leading-[.86] tracking-[-.08em]">{t.cart} <sup className="align-top text-[11px] font-sans text-[#5147e2]">{cartCount}</sup></h1><p className="text-[12px] text-[#737685]">{t.intro}</p></header>

        <form className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-7 max-lg:grid-cols-1" onSubmit={submitOrder}>
          <div className="grid gap-4">
            <section className="rounded-[26px] border border-[#e2e4ed] bg-white p-6 shadow-[0_18px_55px_rgba(39,42,72,.06)] max-sm:rounded-[20px] max-sm:p-4">
              <SectionHeading index="01" title={t.books} action={t.clear} onAction={clearCart} />
              {cart.map(({ book, quantity }) => <article className="grid grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-5 border-b border-[#e7e3da] py-5 last:border-0 last:pb-0 max-sm:grid-cols-[70px_minmax(0,1fr)] max-sm:items-start max-sm:gap-3" key={book.id}>
                <Link href={localized(locale, "/books/" + book.slug)}><BookCover book={book} size="mini" /></Link>
                <div className="flex min-w-0 flex-col"><small className="text-[8px] font-semibold uppercase tracking-[.05em] text-[#858b84]">{book.language} · {localizeBookCategory(locale, book.category)}</small><Link className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-.02em] max-sm:text-[14px]" href={localized(locale, "/books/" + book.slug)}>{book.title}</Link><span className="mt-1 text-[10px] text-[#777d77]">{book.author}</span><button className="mt-4 self-start text-[9px] font-semibold text-[#a94728] underline underline-offset-4" type="button" onClick={() => removeFromCart(book.id)}>{t.remove}</button></div>
                <div className="flex flex-col items-end gap-4 max-sm:col-start-2 max-sm:flex-row-reverse max-sm:items-center max-sm:justify-between"><strong className="text-[14px] font-bold">{formatAmd(book.price * quantity)}</strong><div className="grid min-h-10 grid-cols-[32px_28px_32px] items-center rounded-[9px] border border-[#d3cfc6] bg-[#f8f6f1]"><button className="min-h-10 text-base" type="button" onClick={() => setQuantity(book.id, quantity - 1)}>−</button><span className="text-center text-[10px] font-semibold">{quantity}</span><button className="min-h-10 text-base disabled:cursor-not-allowed disabled:opacity-30" type="button" disabled={quantity >= 10} onClick={() => setQuantity(book.id, quantity + 1)}>+</button></div></div>
              </article>)}
            </section>

            <section className="rounded-[26px] border border-[#e2e4ed] bg-white p-6 shadow-[0_18px_55px_rgba(39,42,72,.06)] max-sm:rounded-[20px] max-sm:p-4"><SectionHeading index="02" title={t.recipient} /><div className="grid grid-cols-2 gap-5 pt-6 max-sm:grid-cols-1">
              <label className={fieldClass}>{t.name}<input className={inputClass} name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder={t.namePlaceholder} /></label>
              <label className={fieldClass}>{t.phone}<input className={inputClass} name="phone" autoComplete="tel" required type="tel" inputMode="tel" minLength={8} maxLength={20} placeholder="+374 00 00 00 00" /></label>
              <label className={cx(fieldClass, "col-span-2 max-sm:col-span-1")}>{t.address}<input className={inputClass} name="address" autoComplete="street-address" required minLength={5} maxLength={200} placeholder={t.addressPlaceholder} /></label>
              <label className={fieldClass}>{t.district}<select className={inputClass} name="district" required defaultValue=""><option value="" disabled>{t.chooseDistrict}</option>{t.districtOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
              <label className={fieldClass}>{t.window}<select className={inputClass} name="deliveryWindow" defaultValue="12:00–16:00"><option>12:00–16:00</option><option>16:00–20:00</option><option>{t.call}</option></select></label>
              <label className={cx(fieldClass, "col-span-2 max-sm:col-span-1")}>{t.comment}<textarea className={cx(inputClass, "resize-y")} name="comment" maxLength={300} rows={3} placeholder={t.commentPlaceholder} /></label>
            </div></section>

            <section className="rounded-[26px] border border-[#e2e4ed] bg-white p-6 shadow-[0_18px_55px_rgba(39,42,72,.06)] max-sm:rounded-[20px] max-sm:p-4"><SectionHeading index="03" title={t.payment} /><div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#c9c4ff] bg-[#f0efff] p-4"><i className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6258ff] text-base font-black not-italic text-white">✓</i><div className="grid gap-1"><strong className="text-[11px] font-bold">{t.onDelivery}</strong><small className="text-[9px] text-[#6e6a9a]">{t.onDeliveryHint}</small></div><b className="ml-auto rounded-full bg-white px-3 py-2 text-[8px] font-black uppercase text-[#5147e2] max-sm:hidden">{t.selected}</b></div></section>
          </div>

          <aside className="lumi-grid sticky top-28 overflow-hidden rounded-[26px] bg-[#151722] p-7 text-white shadow-[0_25px_65px_rgba(29,30,51,.2)] max-lg:static max-sm:rounded-[20px] max-sm:p-6">
            <span className={cx(eyebrow, "text-[#efb096]")}>{t.total}</span><h2 className="font-display mb-7 mt-3 text-3xl font-semibold">{t.yourOrder}</h2>
            <dl className="grid gap-3"><div className="flex justify-between"><dt className="text-[10px] text-white/55">{t.books} ({cartCount})</dt><dd className="text-[11px] font-semibold">{formatAmd(cartSubtotal)}</dd></div><div className="flex justify-between"><dt className="text-[10px] text-white/55">{t.delivery}</dt><dd className="text-[11px] font-semibold">{formatAmd(DELIVERY_PRICE)}</dd></div>{serverAdjustmentAmd !== 0 && <div className="flex justify-between text-[#efb096]"><dt className="text-[9px]">{t.serverAdjustment}</dt><dd className="text-[10px]">{formatAmd(serverAdjustmentAmd)}</dd></div>}</dl>
            <div className="mt-6 flex items-center justify-between border-t border-white/15 py-5"><span className="text-[10px] font-semibold">{t.toPay}</span><strong className="text-[23px] font-bold tracking-[-.03em]">{formatAmd(displayedTotalAmd)}</strong></div>
            {submitError && <p className="mb-4 rounded-[9px] border border-[#efb096]/30 bg-[#efb096]/10 p-3 text-[9px] leading-4 text-[#ffd8c8]" role="alert">{submitError}</p>}
            <button className="flex min-h-13 w-full items-center justify-between rounded-2xl bg-[#d9ff69] px-5 text-[9px] font-black uppercase tracking-[.07em] text-[#151722] transition hover:-translate-y-0.5 hover:bg-white disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitState === "submitting"}>{submitState === "submitting" ? t.submitting : t.submit}<span className="text-lg">↗</span></button>
            <p className="mt-4 flex gap-2 text-[9px] leading-4 text-white/58"><i className="grid size-4 shrink-0 place-items-center rounded-full bg-[#466a55] text-[7px] not-italic text-white">✓</i>{t.submitHint}</p><small className="mt-3 block text-[8px] leading-4 text-white/30">{t.legal}</small>
          </aside>
        </form>
      </div>
    </div>
  );
}

function SectionHeading({ index, title, action, onAction }: { index: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-center gap-3 border-b border-[#e5e6ee] pb-5"><span className="grid size-9 place-items-center rounded-xl bg-[#ebe9ff] text-[9px] font-black text-[#5147e2]">{index}</span><h2 className="text-2xl font-black tracking-[-.045em]">{title}</h2>{action && <button className="ml-auto text-[9px] font-black text-[#5147e2]" type="button" onClick={onAction}>{action}</button>}</div>;
}
