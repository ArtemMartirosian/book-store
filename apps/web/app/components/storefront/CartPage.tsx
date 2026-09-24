"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { mapCatalogBook } from "../../lib/catalog-api";
import type { Book } from "../../lib/types";
import { checkoutFieldErrors, fetchCartSnapshot, normalizeCheckoutPhone, readPendingCheckout, savePendingCheckout, clearPendingCheckout, classifyCheckoutResponse, type PendingCheckout } from "../../lib/checkout-client.mjs";
import { formatAmd } from "../../lib/catalog-data";
import { BookCover } from "./BookCover";
import { useStorefront } from "./StorefrontShell";
import { dictionary, localized, localizeBookCategory } from "./i18n";
import { container, cx, eyebrow, primaryButton, sectionTitle } from "./ui";

const DELIVERY_PRICE = 1000;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1").replace(/\/$/, "");
const PRICING_RULE_VERSION = "amd-fixed-v1";

type CreatedOrder = {
  orderNumber: string;
  totalAmd: number;
};

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

type CheckoutField = "name" | "phone" | "address" | "district";
type CartSnapshot = {
  key: string; books: Book[]; unavailableIds: string[];
  deliveryFeeAmd: number; pricingRuleVersion: string;
};
const checkoutCopy = {
  ru: { checking: "Проверяем цены и наличие…", refreshError: "Не удалось проверить корзину. Повторите проверку перед оформлением.", retry: "Проверить ещё раз", unavailable: "Книга сейчас недоступна. Удалите её из корзины, чтобы продолжить.", changed: "Цена обновлена:", name: "Укажите имя и фамилию: от 2 до 100 символов.", phone: "Проверьте номер телефона, например +374 99 123456.", address: "Укажите улицу, дом и квартиру: от 5 до 200 символов.", district: "Выберите район доставки.", fields: "Проверьте выделенные поля.", review: "К оформлению", decrease: "Уменьшить количество", increase: "Увеличить количество" },
  hy: { checking: "Ստուգում ենք գներն ու առկայությունը…", refreshError: "Չհաջողվեց ստուգել զամբյուղը։ Պատվիրելուց առաջ կրկին փորձեք։", retry: "Կրկին ստուգել", unavailable: "Գիրքն այժմ հասանելի չէ։ Շարունակելու համար հեռացրեք այն զամբյուղից։", changed: "Գինը թարմացվել է՝", name: "Նշեք անունն ու ազգանունը՝ 2–100 նիշ։", phone: "Ստուգեք հեռախոսահամարը, օրինակ՝ +374 99 123456։", address: "Նշեք փողոցը, տունն ու բնակարանը՝ 5–200 նիշ։", district: "Ընտրեք առաքման շրջանը։", fields: "Ստուգեք նշված դաշտերը։", review: "Ձևակերպել", decrease: "Նվազեցնել քանակը", increase: "Ավելացնել քանակը" },
  en: { checking: "Checking prices and availability…", refreshError: "We could not check your cart. Please retry before placing your order.", retry: "Check again", unavailable: "This book is unavailable. Remove it from your cart to continue.", changed: "Price updated:", name: "Enter a full name with 2–100 characters.", phone: "Check your phone number, for example +374 99 123456.", address: "Enter the street, building and apartment using 5–200 characters.", district: "Choose a delivery district.", fields: "Check the highlighted fields.", review: "Review order", decrease: "Decrease quantity", increase: "Increase quantity" },
} as const;


const pendingCopy = {
  ru: { title: "Проверим отправленный заказ", text: "Ответ магазина ещё не получен. Проверьте результат прежнего запроса перед новым оформлением — это защищает от повторного заказа.", retry: "Проверить результат", uncertain: "Связь прервалась или магазин временно не отвечает. Заказ мог быть принят. Нажмите «Проверить результат» — повторный заказ не создастся.", storage: "Не удалось сохранить запрос в браузере. Разрешите локальное хранение данных и повторите. Заказ не отправлен.", checking: "Проверяем незавершённое оформление…", invalid: "Не удалось оформить заказ. Проверьте корзину и данные доставки.", items: "Книг в отправленном запросе", info: "Информация о заказе и данных" },
  hy: { title: "Ստուգենք ուղարկված պատվերը", text: "Խանութի պատասխանը դեռ չի ստացվել։ Նոր պատվեր ձևակերպելուց առաջ ստուգեք նախորդ հարցման արդյունքը՝ կրկնակի պատվերից խուսափելու համար։", retry: "Ստուգել արդյունքը", uncertain: "Կապն ընդհատվել է կամ խանութը ժամանակավորապես չի պատասխանում։ Պատվերը կարող է ընդունված լինել։ Սեղմեք «Ստուգել արդյունքը»․ նոր պատվեր չի ստեղծվի։", storage: "Չհաջողվեց հարցումը պահպանել դիտարկիչում։ Թույլատրեք տվյալների տեղային պահպանումը և կրկին փորձեք։ Պատվերը չի ուղարկվել։", checking: "Ստուգում ենք անավարտ պատվերը…", invalid: "Չհաջողվեց ձևակերպել պատվերը։ Ստուգեք զամբյուղն ու առաքման տվյալները։", items: "Գրքերի քանակն ուղարկված հարցման մեջ", info: "Պատվերի և տվյալների մասին" },
  en: { title: "Check your submitted order", text: "The shop has not confirmed the result yet. Check the original request before placing another order to avoid duplicates.", retry: "Check result", uncertain: "The connection was interrupted or the shop is temporarily unavailable. Your order may have been accepted. Choose “Check result” to retry without creating a duplicate.", storage: "We could not save the request in this browser. Enable local storage and try again. Your order has not been sent.", checking: "Checking unfinished checkout…", invalid: "We could not place the order. Check your cart and delivery details.", items: "Books in the submitted request", info: "Order and data information" },
} as const;
const pendingCleanupCopy = {
  ru: "Магазин подтвердил заказ, но браузер не смог завершить локальное сохранение. Разрешите локальное хранение и нажмите «Проверить результат». Тот же заказ будет подтверждён повторно.",
  hy: "Խանութը հաստատել է պատվերը, բայց դիտարկիչը չի կարող ավարտել տեղային պահպանումը։ Թույլատրեք տեղային պահպանումը և սեղմեք «Ստուգել արդյունքը»։ Կրկին կհաստատվի նույն պատվերը։",
  en: "The shop confirmed your order, but this browser could not finish updating local storage. Enable local storage and choose “Check result” to confirm the same order again.",
} as const;
type SubmittedCheckout = { locale: string; items: Array<{ productId: string; quantity: number }>; expectedTotalAmd: number };
function itemSignature(items: Array<{ productId: string; quantity: number }>) {
  return items.map(({ productId, quantity }) => productId + ":" + quantity).sort().join("|");
}

export function CartPage() {
  const { cart: savedCart, cartCount, setQuantity, removeFromCart, clearCart, completeCheckout, locale } = useStorefront();
  const copy = checkoutCopy[locale];
  const pendingText = pendingCopy[locale];
  const t = dictionary[locale].cart;
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success">("idle");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTotal, setOrderTotal] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [quoteOverride, setQuoteOverride] = useState<QuoteOverride | null>(null);
  const requestInFlight = useRef(false);
  const [pending, setPending] = useState<PendingCheckout | null>(null);
  const [pendingLoaded, setPendingLoaded] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPending(readPendingCheckout());
      setPendingLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<CheckoutField, boolean>>>({});
  const [cartSnapshot, setCartSnapshot] = useState<CartSnapshot | null>(null);
  const [refreshErrorKey, setRefreshErrorKey] = useState<string | null>(null);
  const [refreshAttempt, setRefreshAttempt] = useState(0);
  const requestsJson = JSON.stringify(savedCart.map(({ book }) => ({ id: book.id, slug: book.slug })));
  const requests = useMemo(() => JSON.parse(requestsJson) as Array<{ id: string; slug: string }>, [requestsJson]);
  const snapshotKey = locale + ":" + requestsJson + ":" + refreshAttempt;
  const snapshot = cartSnapshot?.key === snapshotKey ? cartSnapshot : null;
  const refreshFailed = refreshErrorKey === snapshotKey;
  const cart = savedCart.map((line) => ({
    ...line, book: snapshot?.books.find((book) => book.id === line.book.id) ?? line.book,
  }));
  const cartSubtotal = cart.reduce((sum, line) => sum + line.book.price * line.quantity, 0);
  const deliveryPrice = snapshot?.deliveryFeeAmd ?? DELIVERY_PRICE;
  const checkoutReady = Boolean(snapshot && snapshot.unavailableIds.length === 0);

  useEffect(() => {
    if (requests.length === 0) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    void fetchCartSnapshot({ items: requests, locale, baseUrl: API_BASE_URL, signal: controller.signal })
      .then((result) => {
        if (!cancelled) setCartSnapshot({
          key: snapshotKey, books: result.books.map(mapCatalogBook),
          unavailableIds: result.unavailableIds, ...result.policy,
        });
      })
      .catch(() => { if (!cancelled) setRefreshErrorKey(snapshotKey); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [requests, locale, snapshotKey]);
  const cartKey = cart
    .map(({ book, quantity }) => `${book.id}:${quantity}:${book.price}`)
    .sort()
    .join("|") + ":" + deliveryPrice + ":" + (snapshot?.pricingRuleVersion ?? PRICING_RULE_VERSION);
  const activeQuote = quoteOverride?.cartKey === cartKey ? quoteOverride : null;
  const localTotalAmd = cartSubtotal + deliveryPrice;
  const displayedTotalAmd = activeQuote?.totalAmd ?? localTotalAmd;
  const displayedPricingRuleVersion = activeQuote?.pricingRuleVersion ?? snapshot?.pricingRuleVersion ?? PRICING_RULE_VERSION;
  const serverAdjustmentAmd = displayedTotalAmd - localTotalAmd;

  const sendPendingRequest = async (request: PendingCheckout) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setSubmitState("submitting");
    setSubmitError("");
    const submitted = JSON.parse(request.body) as SubmittedCheckout;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": request.key },
        body: request.body,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as (CreatedOrder & ApiErrorPayload) | null;
      if (classifyCheckoutResponse(response.status) === "definite-error") {
        // A confirmed rejection permits editing. A timeout or 5xx does not.
        const cleared = clearPendingCheckout(undefined, request);
        setPending(cleared ? null : readPendingCheckout() ?? request);
        const sameItems = submitted.locale === locale &&
          itemSignature(submitted.items) === itemSignature(cart.map(({ book, quantity }) => ({ productId: book.id, quantity })));
        if (
          response.status === 409 && apiErrorCode(payload) === "QUOTE_CHANGED" &&
          Number.isSafeInteger(payload?.currentTotalAmd) && (payload?.currentTotalAmd ?? 0) > 0 &&
          typeof payload?.currentPricingRuleVersion === "string" &&
          payload.currentPricingRuleVersion.length > 0 && payload.currentPricingRuleVersion.length <= 64
        ) {
          if (sameItems) setQuoteOverride({
            cartKey, totalAmd: payload.currentTotalAmd as number,
            pricingRuleVersion: payload.currentPricingRuleVersion,
          });
          setSubmitError(t.quoteChanged + " " + formatAmd(payload.currentTotalAmd as number));
        } else {
          setQuoteOverride(null);
          setCartSnapshot(null);
          setRefreshAttempt((value) => value + 1);
          setSubmitError(pendingText.invalid);
        }
        setSubmitState("idle");
        return;
      }
      if (!response.ok || typeof payload?.orderNumber !== "string" || !payload.orderNumber ||
          !Number.isSafeInteger(payload.totalAmd) || payload.totalAmd <= 0) {
        throw new Error("Order result is not confirmed");
      }
      const cleared = clearPendingCheckout(undefined, request);
      const remaining = cleared ? null : readPendingCheckout();
      if (!cleared && (!remaining || (remaining.key === request.key && remaining.body === request.body))) {
        // Do not subtract the cart twice if this confirmed request is still durable.
        setSubmitState("idle");
        setSubmitError(pendingCleanupCopy[locale]);
        return;
      }
      setPending(remaining);
      setOrderNumber(payload.orderNumber);
      setOrderTotal(payload.totalAmd);
      setQuoteOverride(null);
      setSubmitState("success");
      completeCheckout(submitted.items);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Keep the exact body and key, including the original quote, until resolved.
      setSubmitState("idle");
      setSubmitError(pendingText.uncertain);
    } finally {
      requestInFlight.current = false;
      clearTimeout(timeout);
    }
  };

  const submitOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestInFlight.current || !checkoutReady || !pendingLoaded || pending) return;
    const existing = readPendingCheckout();
    if (existing) { setPending(existing); return; }

    const form = new FormData(event.currentTarget);
    const district = String(form.get("district") ?? "");
    const address = String(form.get("address") ?? "").trim();
    const deliveryWindow = String(form.get("deliveryWindow") ?? "").trim();
    const comment = String(form.get("comment") ?? "").trim();
    const errors = checkoutFieldErrors({
      name: form.get("name"), phone: form.get("phone"), address, district,
    }, t.districtOptions.map(([code]) => code)) as Partial<Record<CheckoutField, boolean>>;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitError(copy.fields);
      (event.currentTarget.elements.namedItem(Object.keys(errors)[0]) as HTMLInputElement | null)?.focus();
      return;
    }
    setDraft({ name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? ""), address, district, deliveryWindow, comment });
    const body = JSON.stringify({
      locale,
      items: cart.map(({ book, quantity }) => ({ productId: book.id, quantity })),
      customer: { fullName: String(form.get("name") ?? "").trim(), phone: normalizeCheckoutPhone(String(form.get("phone") ?? "")) },
      delivery: { city: "YEREVAN", district, addressLine: address, notes: [deliveryWindow, comment].filter(Boolean).join(" · ") || undefined },
      paymentMethod: "CASH_ON_DELIVERY",
      acceptsPreliminaryAvailability: true,
      expectedTotalAmd: displayedTotalAmd,
      expectedPricingRuleVersion: displayedPricingRuleVersion,
    });
    try {
      const request = { key: crypto.randomUUID(), body };
      if (!savePendingCheckout(request)) {
        const competingRequest = readPendingCheckout();
        if (competingRequest) setPending(competingRequest);
        else setSubmitError(pendingText.storage);
        return;
      }
      setPending(request);
      await sendPendingRequest(request);
    } catch { setSubmitError(pendingText.storage); }
  };

  if (submitState === "success") return (
    <div className="min-h-[70vh] bg-[#f7f8fc] text-[#18192d]">
      <div className={cx(container, "flex min-h-[650px] flex-col items-center justify-center px-5 py-16 text-center")}>
        <span className="mb-6 grid size-16 place-items-center rounded-[20px] bg-[#e9bf71] text-xl font-semibold text-[#6258ff] shadow-[0_16px_35px_rgba(36,62,53,.08)]">✓</span>
        <small className={eyebrow}>{t.successPrefix} #{orderNumber}</small>
        <h1 className={cx(sectionTitle, "my-4 max-w-[680px] whitespace-pre-line")}>{t.successTitle}</h1>
        <p className="max-w-[560px] text-[14px] leading-7 text-[#727789]">{t.successText}</p>
        <p className="mt-5 rounded-full bg-[#efe4d2] px-5 py-2 text-[14px] font-bold text-[#a94728]">{t.successTotal}: {formatAmd(orderTotal)}</p>
        <div className="my-7 rounded-[20px] border border-[#e3e5ef] bg-[#ffffff] px-7 py-5 text-left shadow-[0_16px_45px_rgba(36,62,53,.025)]">
          <strong className="text-[13px] font-bold uppercase tracking-[.08em]">{t.next}</strong>
          <ol className="mt-3 flex gap-8 max-sm:flex-col max-sm:gap-2">{t.nextSteps.map((step, stepIndex) => <li className="flex items-center gap-2 text-[14px] text-[#727789]" key={step}><span className="grid size-5 place-items-center rounded-full bg-[#f0eeff] text-[13px] font-bold text-[#2f7654]">{stepIndex + 1}</span>{step}</li>)}</ol>
        </div>
        <Link className={primaryButton} href={localized(locale, "/catalog")}>{t.backCatalog}<span>→</span></Link>
      </div>
    </div>
  );

  if (!pendingLoaded) return <div className={cx(container, "min-h-[60vh] py-20")} role="status">{pendingText.checking}</div>;

  if (pending) {
    const submitted = JSON.parse(pending.body) as SubmittedCheckout;
    return <div className="min-h-[70vh] bg-[#f7f8fc] text-[#18192d]">
      <div className={cx(container, "py-14")}>
        <section className="mx-auto max-w-2xl rounded-[20px] border border-[#e3e5ef] bg-[#ffffff] p-6 shadow-[0_12px_40px_rgba(36,62,53,.04)] sm:p-10">
          <h1 className="font-display text-3xl font-normal leading-tight tracking-[-.02em] sm:text-4xl">{pendingText.title}</h1>
          <p className="mt-4 text-base leading-7 text-[#727789]">{pendingText.text}</p>
          <dl className="my-6 grid gap-3 rounded-2xl bg-[#f0eeff] p-5">
            <div className="flex justify-between gap-5"><dt>{pendingText.items}</dt><dd>{submitted.items.reduce((sum, item) => sum + item.quantity, 0)}</dd></div>
            <div className="flex justify-between gap-5 font-bold"><dt>{t.toPay}</dt><dd>{formatAmd(submitted.expectedTotalAmd)}</dd></div>
          </dl>
          {submitError && <p role="alert" className="mb-5 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">{submitError}</p>}
          <button type="button" className={cx(primaryButton, "w-full disabled:opacity-60")} disabled={submitState === "submitting"} onClick={() => void sendPendingRequest(pending)}>{submitState === "submitting" ? t.submitting : pendingText.retry}</button>
          <Link className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-[#6258ff] underline underline-offset-4" href={localized(locale, "/contacts")}>{dictionary[locale].footer.contacts}</Link>
        </section>
      </div>
    </div>;
  }

  if (cart.length === 0) return (
    <div className="min-h-[70vh] bg-[#f7f8fc] text-[#18192d]">
      <div className={cx(container, "pb-28")}>
        <nav className="flex min-h-14 items-center gap-2 text-[14px] text-[#727789]"><Link href={localized(locale)}>{t.home}</Link><span>/</span><span>{t.cart}</span></nav>
        <div className="flex min-h-[560px] flex-col items-center justify-center px-5 text-center">
          <div className="relative mb-8 h-[130px] w-[165px]" aria-hidden="true"><i className="absolute bottom-0 left-2 h-[108px] w-[68px] -rotate-6 rounded-[5px_11px_11px_5px] bg-[#e9bf71] shadow-xl" /><i className="absolute bottom-0 right-2 h-[118px] w-[72px] rotate-6 rounded-[5px_11px_11px_5px] bg-[#6258ff] shadow-xl" /><span className="absolute -right-2 top-0 grid size-10 place-items-center rounded-2xl bg-[#6258ff] text-lg font-semibold text-white">+</span></div>
          {submitError && <p role="alert" className="mb-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{submitError}</p>}
          <span className={eyebrow}>{t.emptyOverline}</span>
          <h1 className={cx(sectionTitle, "mt-3")}>{t.emptyTitle}</h1>
          <p className="my-5 max-w-[440px] text-[14px] leading-6 text-[#727789]">{t.emptyText}</p>
          <Link className={primaryButton} href={localized(locale, "/catalog")}>{t.toCatalog}<span>→</span></Link>
        </div>
      </div>
    </div>
  );

  const inputClass = "w-full min-w-0 rounded-xl border border-[#e3e5ef] bg-[#f7f8fc] px-4 py-3.5 text-base text-[#18192d] outline-none transition placeholder:text-[#9296a6] focus:border-[#6258ff] focus:bg-[#ffffff] focus:shadow-[0_0_0_3px_rgba(36,62,53,.08)]";
  const fieldClass = "grid min-w-0 gap-2 text-sm font-medium text-[#727789]";

  return (
    <div className="min-h-[70vh] bg-[#f7f8fc] text-[#18192d]">
      <div className={cx(container, "pb-28")}>
        <nav className="flex min-h-14 items-center gap-2 text-[14px] text-[#727789]"><Link href={localized(locale)}>{t.home}</Link><span>/</span><span>{t.cart}</span></nav>
        <header className="pb-9 pt-7"><span className={eyebrow}>{t.selection}</span><h1 className="font-display my-4 text-[clamp(2.8rem,5.5vw,4.5rem)] font-normal leading-[1.08] tracking-[-.035em]">{t.cart} <sup className="ml-1 inline-flex size-8 items-center justify-center rounded-full bg-[#f0eeff] align-middle font-sans text-sm font-medium tracking-normal text-[#6258ff]">{cartCount}</sup></h1><p className="text-[14px] text-[#727789]">{t.intro}</p></header>

        <form id="checkout-form" noValidate className="grid grid-cols-[minmax(0,1fr)_350px] items-start gap-7 max-lg:grid-cols-1" onSubmit={submitOrder} onChange={(event) => {
          const field = event.target.getAttribute("name") as CheckoutField | null;
          if (field) setFieldErrors((current) => ({ ...current, [field]: false }));
        }}>
          <div className="grid gap-4">
            <section className="rounded-[20px] border border-[#e3e5ef] bg-[#ffffff] p-6 shadow-[0_18px_55px_rgba(36,62,53,.025)] max-sm:rounded-[20px] max-sm:p-4">
              <SectionHeading index="01" title={t.books} action={submitState === "submitting" ? undefined : t.clear} onAction={clearCart} />
              {!snapshot && <div className="my-4 rounded-xl bg-[#f0eeff] p-4 text-sm" role={refreshFailed ? "alert" : "status"}>
                {refreshFailed ? copy.refreshError : copy.checking}
                {refreshFailed && <button className="mt-3 block min-h-11 font-bold underline" type="button" onClick={() => setRefreshAttempt((value) => value + 1)}>{copy.retry}</button>}
              </div>}
              {cart.map(({ book, quantity }) => <article className="grid grid-cols-[82px_minmax(0,1fr)_auto] items-center gap-5 border-b border-[#e3e5ef] py-5 last:border-0 last:pb-0 max-sm:grid-cols-[70px_minmax(0,1fr)] max-sm:items-start max-sm:gap-3" key={book.id}>
                <Link href={localized(locale, "/books/" + book.slug)}><BookCover book={book} size="mini" /></Link>
                <div className="flex min-w-0 flex-col"><small className="text-[13px] font-semibold uppercase tracking-[.05em] text-[#727789]">{book.language} · {localizeBookCategory(locale, book.category)}</small><Link className="font-display mt-1.5 overflow-hidden text-ellipsis whitespace-nowrap text-xl font-normal leading-snug tracking-[-.02em] max-sm:text-lg" href={localized(locale, "/books/" + book.slug)}>{book.title}</Link><span className="mt-1 text-[14px] text-[#727789]">{book.author}</span>{snapshot?.unavailableIds.includes(book.id) && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800" role="alert">{copy.unavailable}</p>}{snapshot && savedCart.find((line) => line.book.id === book.id)?.book.price !== book.price && <p className="mt-2 text-sm font-semibold text-[#6258ff]">{copy.changed} {formatAmd(book.price)}</p>}<button disabled={submitState === "submitting"} className="mt-4 min-h-11 self-start text-[13px] font-semibold text-[#a94728] underline underline-offset-4" type="button" onClick={() => removeFromCart(book.id)}>{t.remove}</button></div>
                <div className="flex flex-col items-end gap-4 max-sm:col-start-2 max-sm:flex-row-reverse max-sm:items-center max-sm:justify-between"><strong className="text-[14px] font-bold">{formatAmd(book.price * quantity)}</strong><div className="grid min-h-10 grid-cols-[44px_32px_44px] items-center rounded-[9px] border border-[#e3e5ef] bg-[#f7f8fc]"><button className="min-h-11 text-base" type="button" disabled={submitState === "submitting"} aria-label={copy.decrease + ": " + book.title} onClick={() => setQuantity(book.id, quantity - 1)}>−</button><span className="text-center text-[14px] font-semibold">{quantity}</span><button className="min-h-11 text-base disabled:cursor-not-allowed disabled:opacity-30" type="button" disabled={quantity >= 10 || submitState === "submitting"} aria-label={copy.increase + ": " + book.title} onClick={() => setQuantity(book.id, quantity + 1)}>+</button></div></div>
              </article>)}
            </section>

            <section className="rounded-[20px] border border-[#e3e5ef] bg-[#ffffff] p-6 shadow-[0_18px_55px_rgba(36,62,53,.025)] max-sm:rounded-[20px] max-sm:p-4"><SectionHeading index="02" title={t.recipient} /><div className="grid grid-cols-2 gap-5 pt-6 max-sm:grid-cols-1">
              <label className={fieldClass}>{t.name}<input className={inputClass} name="name" defaultValue={draft.name ?? ""} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} autoComplete="name" required minLength={2} maxLength={100} placeholder={t.namePlaceholder} /><FieldError field="name" message={fieldErrors.name ? copy.name : undefined} /></label>
              <label className={fieldClass}>{t.phone}<input className={inputClass} name="phone" defaultValue={draft.phone ?? ""} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} autoComplete="tel" required type="tel" inputMode="tel" minLength={8} maxLength={20} placeholder="+374 00 00 00 00" /><FieldError field="phone" message={fieldErrors.phone ? copy.phone : undefined} /></label>
              <label className={cx(fieldClass, "col-span-2 max-sm:col-span-1")}>{t.address}<input className={inputClass} name="address" defaultValue={draft.address ?? ""} disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "address-error" : undefined} autoComplete="street-address" required minLength={5} maxLength={200} placeholder={t.addressPlaceholder} /><FieldError field="address" message={fieldErrors.address ? copy.address : undefined} /></label>
              <label className={fieldClass}>{t.district}<select className={inputClass} name="district" disabled={submitState === "submitting"} aria-invalid={Boolean(fieldErrors.district)} aria-describedby={fieldErrors.district ? "district-error" : undefined} required defaultValue={draft.district ?? ""}><option value="" disabled>{t.chooseDistrict}</option>{t.districtOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><FieldError field="district" message={fieldErrors.district ? copy.district : undefined} /></label>
              <label className={fieldClass}>{t.window}<select className={inputClass} name="deliveryWindow" disabled={submitState === "submitting"} defaultValue={draft.deliveryWindow ?? "12:00–16:00"}><option>12:00–16:00</option><option>16:00–20:00</option><option>{t.call}</option></select></label>
              <label className={cx(fieldClass, "col-span-2 max-sm:col-span-1")}>{t.comment}<textarea className={cx(inputClass, "resize-y")} name="comment" defaultValue={draft.comment ?? ""} disabled={submitState === "submitting"} maxLength={300} rows={3} placeholder={t.commentPlaceholder} /></label>
            </div></section>

            <section className="rounded-[20px] border border-[#e3e5ef] bg-[#ffffff] p-6 shadow-[0_18px_55px_rgba(36,62,53,.025)] max-sm:rounded-[20px] max-sm:p-4"><SectionHeading index="03" title={t.payment} /><div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#cbd6c7] bg-[#f0eeff] p-4"><i className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#6258ff] text-base font-semibold not-italic text-white">✓</i><div className="grid gap-1"><strong className="text-[14px] font-bold">{t.onDelivery}</strong><small className="text-[13px] text-[#727789]">{t.onDeliveryHint}</small></div><b className="ml-auto rounded-full bg-[#ffffff] px-3 py-2 text-[13px] font-semibold uppercase text-[#6258ff] max-sm:hidden">{t.selected}</b></div></section>
          </div>

          <aside id="checkout-summary" className="scroll-mt-40 xl:scroll-mt-44 sticky top-28 overflow-hidden rounded-[20px] bg-[#6258ff] p-7 text-white shadow-[0_25px_65px_rgba(36,62,53,.12)] max-lg:static max-sm:rounded-[20px] max-sm:p-6">
            <span className={cx(eyebrow, "text-[#e9bf71]")}>{t.total}</span><h2 className="font-display mb-7 mt-3 text-3xl font-normal leading-tight">{t.yourOrder}</h2>
            <dl className="grid gap-3"><div className="flex justify-between"><dt className="text-[14px] text-white/70">{t.books} ({cartCount})</dt><dd className="text-[14px] font-semibold">{formatAmd(cartSubtotal)}</dd></div><div className="flex justify-between"><dt className="text-[14px] text-white/70">{t.delivery}</dt><dd className="text-[14px] font-semibold">{formatAmd(deliveryPrice)}</dd></div>{serverAdjustmentAmd !== 0 && <div className="flex justify-between text-[#e9bf71]"><dt className="text-[13px]">{t.serverAdjustment}</dt><dd className="text-[14px]">{formatAmd(serverAdjustmentAmd)}</dd></div>}</dl>
            <div className="mt-6 flex items-center justify-between border-t border-white/15 py-5"><span className="text-[14px] font-semibold">{t.toPay}</span><strong className="text-[23px] font-bold tracking-[-.03em]">{formatAmd(displayedTotalAmd)}</strong></div>
            {submitError && <p className="mb-4 rounded-[9px] border border-[#e9bf71]/30 bg-[#e9bf71]/10 p-3 text-[13px] leading-4 text-[#f3dfb7]" role="alert">{submitError}</p>}
            <button className="flex min-h-13 w-full items-center justify-between rounded-xl bg-[#e9bf71] px-5 text-sm font-semibold text-[#18192d] transition hover:bg-[#f0cf96] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={submitState === "submitting" || !checkoutReady}>{submitState === "submitting" ? t.submitting : t.submit}<span className="text-lg">↗</span></button>
            <p className="mt-4 flex gap-2 text-[13px] leading-5 text-white/75"><i className="grid size-4 shrink-0 place-items-center rounded-full bg-[#466a55] text-[7px] not-italic text-white">✓</i>{t.submitHint}</p><small className="mt-3 block text-[13px] leading-5 text-white/60">{t.legal}</small><Link className="mt-3 inline-flex min-h-11 items-center text-sm text-white/80 underline underline-offset-4" href={localized(locale, "/information")}>{pendingText.info}</Link>
          </aside>
        </form>
        <div data-sticky-action="cart" className="storefront-bottom-action fixed inset-x-0 z-40 hidden items-center justify-between gap-4 border-t border-[#e3e5ef] bg-[#ffffff]/95 px-5 pt-3 shadow-[0_-6px_24px_rgba(36,62,53,.06)] backdrop-blur max-lg:flex"><div><span className="block text-xs text-[#727789]">{t.toPay}</span><strong className="text-xl font-semibold">{formatAmd(displayedTotalAmd)}</strong></div><a className="flex min-h-12 items-center rounded-xl bg-[#6258ff] px-5 text-sm font-bold text-white" href="#checkout-summary">{copy.review} ↓</a></div>
      </div>
    </div>
  );
}

function SectionHeading({ index, title, action, onAction }: { index: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="flex items-center gap-3 border-b border-[#e3e5ef] pb-5"><span className="grid size-9 shrink-0 place-items-center rounded-full border border-[#e3e5ef] bg-[#f0eeff] text-xs font-medium text-[#6258ff]">{index}</span><h2 className="font-display text-2xl font-normal tracking-[-.025em]">{title}</h2>{action && <button className="ml-auto min-h-11 shrink-0 text-sm font-medium text-[#6258ff] underline underline-offset-4" type="button" onClick={onAction}>{action}</button>}</div>;
}

function FieldError({ field, message }: { field: CheckoutField; message?: string }) {
  return message ? <span id={field + "-error"} role="alert" className="text-sm font-medium normal-case tracking-normal text-rose-700">{message}</span> : null;
}
