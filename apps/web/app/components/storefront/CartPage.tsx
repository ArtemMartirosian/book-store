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
    <div className={cx(container, "min-h-[70vh] pb-24")}><div className="flex min-h-[650px] flex-col items-center justify-center px-5 text-center"><span className="mb-5 grid size-16 place-items-center rounded-[18px] bg-[#c9ff3d] text-2xl font-black text-[#0b0c10]">✓</span><small className="text-[9px] font-black uppercase tracking-[.14em] text-[#6558ff]">{t.successPrefix} #{orderNumber}</small><h1 className={cx(sectionTitle, "my-4 whitespace-pre-line text-6xl max-sm:text-5xl")}>{t.successTitle}</h1><p className="max-w-[550px] text-[13px] font-medium leading-7 text-black/48">{t.successText}</p><p className="mt-4 rounded-[10px] bg-[#6558ff] px-5 py-2 text-[10px] font-black text-white">{t.successTotal}: {formatAmd(orderTotal)}</p><div className="my-7 border-2 border-black bg-white px-7 py-5 text-left"><strong className="text-[9px] font-black uppercase">{t.next}</strong><ol className="mt-3 flex gap-8 max-sm:flex-col max-sm:gap-2">{t.nextSteps.map((step) => <li className="text-[9px] font-medium text-black/45" key={step}>{step}</li>)}</ol></div><Link className={primaryButton} href={localized(locale, "/catalog")}>{t.backCatalog}<span>→</span></Link></div></div>
  );

  if (cart.length === 0) return (
    <div className={cx(container, "min-h-[70vh] pb-24")}><nav className="flex min-h-14 items-center gap-2 text-[9px] font-bold text-black/42"><Link href={localized(locale)}>{t.home}</Link><span>/</span><span>{t.cart}</span></nav><div className="flex min-h-[600px] flex-col items-center justify-center px-5 text-center"><div className="relative mb-8 h-[130px] w-[150px]"><i className="absolute bottom-0 h-[105px] w-[70px] -rotate-6 rounded-[10px] border-2 border-black bg-[#6558ff]" /><i className="absolute bottom-0 right-0 h-[115px] w-[70px] rotate-6 rounded-[10px] border-2 border-black bg-[#c9ff3d]" /><span className="absolute -right-4 top-0 grid size-10 place-items-center rounded-[12px] bg-[#0b0c10] text-xl font-black text-white">+</span></div><span className={eyebrow}>{t.emptyOverline}</span><h1 className={cx(sectionTitle, "mt-3 text-6xl max-sm:text-5xl")}>{t.emptyTitle}</h1><p className="my-5 max-w-[430px] text-xs font-medium leading-6 text-black/48">{t.emptyText}</p><Link className={primaryButton} href={localized(locale, "/catalog")}>{t.toCatalog}<span>→</span></Link></div></div>
  );

  const inputClass = "w-full rounded-[11px] border-2 border-black bg-white px-3.5 py-3 text-[11px] font-bold outline-none transition focus:border-[#6558ff]";
  const fieldClass = "grid gap-2 text-[9px] font-black uppercase text-black/58";

  return (
    <div className={cx(container, "min-h-[70vh] pb-24")}>
      <nav className="flex min-h-14 items-center gap-2 text-[9px] font-bold text-black/42"><Link href={localized(locale)}>{t.home}</Link><span>/</span><span>{t.cart}</span></nav>
      <header className="pb-10 pt-10"><span className={eyebrow}>{t.selection}</span><h1 className="my-3 text-[clamp(3.5rem,7vw,7rem)] font-black leading-[.8] tracking-[-.085em]">{t.cart} <sup className="align-top text-xs text-[#6558ff]">{cartCount}</sup></h1><p className="text-xs font-medium text-black/48">{t.intro}</p></header>

      <form className="grid grid-cols-[minmax(0,1fr)_350px] items-start gap-7 max-lg:grid-cols-1" onSubmit={submitOrder}>
        <div className="grid gap-4">
          <section className="rounded-[22px] border-2 border-black bg-white p-7 max-sm:p-4">
            <SectionHeading index="01" title={t.books} action={t.clear} onAction={clearCart} />
            {cart.map(({ book, quantity }) => <article className="grid grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-5 border-b border-black/10 py-5 last:border-0 last:pb-0 max-sm:grid-cols-[70px_minmax(0,1fr)] max-sm:items-start max-sm:gap-3" key={book.id}>
              <Link href={localized(locale, `/books/${book.slug}`)}><BookCover book={book} size="mini" /></Link>
              <div className="flex min-w-0 flex-col"><small className="text-[7px] font-black uppercase tracking-wider text-black/42">{book.language} · {localizeBookCategory(locale, book.category)}</small><Link className="mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-lg font-black tracking-[-.03em] max-sm:text-sm" href={localized(locale, `/books/${book.slug}`)}>{book.title}</Link><span className="mt-1 text-[9px] font-medium text-black/42">{book.author}</span><button className="mt-4 self-start border-b border-black/30 bg-transparent pb-0.5 text-[8px] font-bold text-black/42" type="button" onClick={() => removeFromCart(book.id)}>{t.remove}</button></div>
              <div className="flex flex-col items-end gap-4 max-sm:col-start-2 max-sm:flex-row-reverse max-sm:items-center max-sm:justify-between"><strong className="text-sm font-black">{formatAmd(book.price * quantity)}</strong><div className="grid h-9 grid-cols-[28px_25px_28px] items-center overflow-hidden rounded-[10px] border-2 border-black"><button className="h-full bg-transparent font-black" type="button" onClick={() => setQuantity(book.id, quantity - 1)}>−</button><span className="text-center text-[10px] font-black">{quantity}</span><button className="h-full bg-transparent font-black disabled:cursor-not-allowed disabled:opacity-30" type="button" disabled={quantity >= 10} onClick={() => setQuantity(book.id, quantity + 1)}>+</button></div></div>
            </article>)}
          </section>

          <section className="rounded-[22px] border-2 border-black bg-white p-7 max-sm:p-4"><SectionHeading index="02" title={t.recipient} /><div className="grid grid-cols-2 gap-5 pt-6 max-sm:grid-cols-1">
            <label className={fieldClass}>{t.name}<input className={inputClass} name="name" autoComplete="name" required minLength={2} maxLength={100} placeholder={t.namePlaceholder} /></label>
            <label className={fieldClass}>{t.phone}<input className={inputClass} name="phone" autoComplete="tel" required type="tel" inputMode="tel" minLength={8} maxLength={20} placeholder="+374 00 00 00 00" /></label>
            <label className={cx(fieldClass, "col-span-2 max-sm:col-span-1")}>{t.address}<input className={inputClass} name="address" autoComplete="street-address" required minLength={5} maxLength={200} placeholder={t.addressPlaceholder} /></label>
            <label className={fieldClass}>{t.district}<select className={inputClass} name="district" required defaultValue=""><option value="" disabled>{t.chooseDistrict}</option>{t.districtOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label>
            <label className={fieldClass}>{t.window}<select className={inputClass} name="deliveryWindow" defaultValue="12:00–16:00"><option>12:00–16:00</option><option>16:00–20:00</option><option>{t.call}</option></select></label>
            <label className={cx(fieldClass, "col-span-2 max-sm:col-span-1")}>{t.comment}<textarea className={cx(inputClass, "resize-y")} name="comment" maxLength={300} rows={3} placeholder={t.commentPlaceholder} /></label>
          </div></section>

          <section className="rounded-[22px] border-2 border-black bg-white p-7 max-sm:p-4"><SectionHeading index="03" title={t.payment} /><label className="mt-5 flex cursor-pointer items-center gap-3 rounded-[14px] border-2 border-black bg-[#c9ff3d] p-4"><input className="sr-only" type="radio" name="payment" defaultChecked /><span className="grid size-5 place-items-center rounded-[7px] border-2 border-black after:size-2.5 after:rounded-[3px] after:bg-[#6558ff] after:content-['']" /><i className="grid size-9 place-items-center rounded-[10px] bg-[#0b0c10] text-base font-black not-italic text-white">֏</i><div className="grid gap-1"><strong className="text-[10px] font-black">{t.onDelivery}</strong><small className="text-[8px] font-medium text-black/52">{t.onDeliveryHint}</small></div><b className="ml-auto text-[8px] font-black uppercase text-[#0b0c10] max-sm:hidden">{t.selected}</b></label></section>
        </div>

        <aside className="sticky top-28 rounded-[22px] border-2 border-black bg-[#0b0c10] p-8 text-white shadow-[7px_7px_0_#6558ff] max-lg:static max-sm:p-6"><span className={cx(eyebrow, "text-[#c9ff3d]")}>{t.total}</span><h2 className="mb-7 mt-3 text-3xl font-black tracking-[-.055em]">{t.yourOrder}</h2><dl className="grid gap-3"><div className="flex justify-between"><dt className="text-[9px] font-medium text-white/52">{t.books} ({cartCount})</dt><dd className="text-[10px] font-bold">{formatAmd(cartSubtotal)}</dd></div><div className="flex justify-between"><dt className="text-[9px] font-medium text-white/52">{t.delivery}</dt><dd className="text-[10px] font-bold">{formatAmd(DELIVERY_PRICE)}</dd></div>{serverAdjustmentAmd !== 0 && <div className="flex justify-between text-[#c9ff3d]"><dt className="text-[9px]">{t.serverAdjustment}</dt><dd className="text-[10px]">{formatAmd(serverAdjustmentAmd)}</dd></div>}</dl><div className="mt-6 flex items-center justify-between border-t border-white/15 py-5"><span className="text-[10px] font-black">{t.toPay}</span><strong className="text-2xl font-black tracking-[-.04em]">{formatAmd(displayedTotalAmd)}</strong></div>{submitError && <p className="mb-4 rounded-xl border border-[#ff9b7b]/40 bg-[#ff9b7b]/10 p-3 text-[9px] leading-4 text-[#ffd5c8]" role="alert">{submitError}</p>}<button className="flex h-13 w-full items-center justify-between rounded-[12px] bg-[#c9ff3d] px-5 text-[10px] font-black uppercase text-[#0b0c10] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitState === "submitting"}>{submitState === "submitting" ? t.submitting : t.submit}<span className="text-lg">→</span></button><p className="mt-4 flex gap-2 text-[8px] font-medium leading-4 text-white/55"><i className="grid size-4 shrink-0 place-items-center rounded-[5px] bg-[#6558ff] text-[7px] not-italic text-white">✓</i>{t.submitHint}</p><small className="mt-3 block text-[7px] leading-3 text-white/28">{t.legal}</small></aside>
      </form>
    </div>
  );
}

function SectionHeading({ index, title, action, onAction }: { index: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-center gap-3 border-b-2 border-black pb-5"><span className="grid size-8 place-items-center rounded-[10px] bg-[#6558ff] text-[9px] font-black text-white">{index}</span><h2 className="text-2xl font-black tracking-[-.045em]">{title}</h2>{action && <button className="ml-auto border-b border-black/35 bg-transparent pb-0.5 text-[8px] font-bold text-black/42" type="button" onClick={onAction}>{action}</button>}</div>;
}
