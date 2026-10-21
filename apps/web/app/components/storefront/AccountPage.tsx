"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { accountRequest, AccountError, googleSignInUrl, type AccountAddress, type AccountConfig, type AccountOrders } from "../../lib/customer-account";
import { accountCopy, type AccountCopy } from "./account-copy";
import { dictionary, localized, type Locale } from "./i18n";
import { useStorefront } from "./StorefrontShell";
import { container, cx, primaryButton } from "./ui";

const card = "rounded-3xl border border-[var(--line)] bg-white";
const inputClass = "min-h-12 w-full min-w-0 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-4 text-base outline-none transition focus:border-[var(--accent)] focus:bg-white focus:ring-4 focus:ring-[var(--accent)]/10";
const fieldClass = "grid min-w-0 gap-2 text-sm font-medium text-[var(--ink)]";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 text-sm font-medium transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50";

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h5v-6h4v6h5V9"/></>,
  orders: <><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  pin: <><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  user: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21c0-5 3-7 7-7s7 2 7 7"/></>,
  shield: <><path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3Z"/><path d="m8 12 3 3 5-6"/></>,
  heart: <path d="M12 21 3 12C-3 5 7-1 12 7c5-8 15-2 9 5l-9 9Z"/>,
  arrow: <path d="M4 12h15m-5-5 5 5-5 5"/>,
  logout: <><path d="M10 4H4v16h6M10 12h11m-4-4 4 4-4 4"/></>,
  book: <><path d="M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2V4Zm9 2v15"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  phone: <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
};
type IconName = keyof typeof iconPaths;
function Icon({ name, className = "size-5" }: { name: IconName; className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}
function GoogleMark() {
  return <svg viewBox="0 0 24 24" className="size-5 shrink-0" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.05.97-3.38.97-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.93a6 6 0 0 1 0-3.86V7.48H3.07a10 10 0 0 0 0 9.04l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.51 3.83 1.51l2.88-2.88A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.48l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"/></svg>;
}
function BooksDrawing({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? "h-40 w-48 max-sm:hidden" : "mx-auto h-56 w-full max-w-80 max-sm:h-40"} viewBox="0 0 320 240" fill="none" aria-hidden="true">
    <circle cx="168" cy="120" r="104" fill="#e3deff"/><circle cx="270" cy="46" r="9" fill="#d5f09a"/>
    <path d="m46 191 211 0" stroke="#b6abef" strokeWidth="3" strokeLinecap="round"/>
    <g transform="rotate(-12 104 130)"><rect x="59" y="45" width="84" height="145" rx="9" fill="#8b80e7"/><path d="M70 45v145" stroke="#7065c9" strokeWidth="3"/><path d="M86 70h35M86 79h25" stroke="#e6e1ff" strokeWidth="3" strokeLinecap="round"/><circle cx="105" cy="127" r="20" fill="#a99df1"/></g>
    <g transform="rotate(9 208 137)"><rect x="167" y="72" width="80" height="120" rx="8" fill="#bcd5ac"/><path d="M179 72v120" stroke="#97b78a" strokeWidth="3"/><path d="M194 94h35M194 102h25" stroke="#f1f7ed" strokeWidth="3" strokeLinecap="round"/><path d="M194 164c-2-20 15-19 17-40 12 19 24 29 12 43" fill="#88ab7a"/></g>
    <path d="m146 21 3 9 9 3-9 3-3 9-3-9-9-3 9-3 3-9ZM276 149l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" fill="#8c7ee3"/>
  </svg>;
}
function errorText(error: unknown, t: AccountCopy) {
  if (!(error instanceof AccountError)) return t.error;
  if (error.status === 401) return t.sessionError;
  return ({ INVALID_PHONE: t.phoneError, CODE_INVALID: t.codeError, CODE_EXPIRED: t.expired, TOO_MANY_ATTEMPTS: t.rateError,
    SMS_UNAVAILABLE: t.providerError, GOOGLE_UNAVAILABLE: t.providerError, ACCOUNT_UNAVAILABLE: t.providerError,
    IDENTITY_ALREADY_LINKED: t.identityError, ADDRESS_LIMIT: t.addressLimit } as Record<string, string>)[error.code] ?? t.error;
}
function Alert({ children, success = false }: { children: ReactNode; success?: boolean }) {
  return <p className={cx("rounded-xl border p-4 text-sm leading-6", success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800")} role={success ? "status" : "alert"}>{children}</p>;
}

function AuthPanel({ config, locale, onSuccess, link = false }: { config: AccountConfig | null; locale: Locale; onSuccess: () => Promise<void>; link?: boolean }) {
  const t = accountCopy[locale];
  const params = useSearchParams();
  const [phone, setPhone] = useState("+374 ");
  const [code, setCode] = useState("");
  const [challenge, setChallenge] = useState<{ challengeId: string; phone: string; expiresAt: string } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!seconds) return;
    const timer = window.setTimeout(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);
  useEffect(() => { if (challenge) codeInput.current?.focus(); }, [challenge]);
  const requestCode = async (event?: FormEvent) => {
    event?.preventDefault();
    if (locked.current || !config?.smsEnabled) return;
    const compact = phone.replace(/[\s()-]/gu, "");
    if (!/^(?:\+?374)?\d{8}$/u.test(compact)) { setError(t.phoneError); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      const result = await accountRequest<{ challengeId: string; phone: string; expiresAt: string; resendAfterSeconds: number }>("auth/code", { method: "POST", body: JSON.stringify({ phone, locale, link }) });
      setChallenge(result); setCode(""); setSeconds(result.resendAfterSeconds);
    } catch (cause) { setError(errorText(cause, t)); }
    finally { locked.current = false; setBusy(false); }
  };
  const verify = async (event: FormEvent) => {
    event.preventDefault();
    if (locked.current || !challenge) return;
    if (!/^\d{6}$/u.test(code)) { setError(t.codeError); return; }
    locked.current = true; setBusy(true); setError("");
    try {
      await accountRequest("auth/verify", { method: "POST", body: JSON.stringify({ challengeId: challenge.challengeId, code }) });
      await onSuccess();
    } catch (cause) { setError(errorText(cause, t)); }
    finally { locked.current = false; setBusy(false); }
  };
  return <div className="mx-auto w-full max-w-[420px]" data-testid="customer-auth-panel">
    {challenge ? <>
      <button type="button" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-[var(--muted)] hover:text-[var(--accent)]" disabled={busy} onClick={() => { setChallenge(null); setError(""); setCode(""); }}><span aria-hidden="true">←</span>{t.back}</button>
      <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name="phone" className="size-7"/></span>
      <h2 className="text-2xl font-bold tracking-tight">{t.codeTitle}</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{t.codeText}<br/><strong className="text-[var(--ink)]" dir="ltr">{challenge.phone}</strong></p>
      <form className="mt-7 grid gap-4" onSubmit={verify}>
        <label className={fieldClass}>{t.code}<input ref={codeInput} className={cx(inputClass, "min-h-16 text-center text-2xl tracking-[.4em]")} value={code} onChange={event => { setCode(event.target.value.replace(/\D/gu, "").slice(0, 6)); setError(""); }} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required aria-invalid={Boolean(error)} aria-describedby={error ? "account-auth-error" : undefined} disabled={busy}/></label>
        <button className={cx(primaryButton, "w-full")} disabled={busy || code.length !== 6} type="submit">{busy ? t.verifying : t.verify}<Icon name="arrow"/></button>
      </form>
      <button className="mt-3 min-h-11 w-full text-center text-sm font-medium text-[var(--accent)] disabled:text-[var(--muted)]" type="button" disabled={busy || seconds > 0} onClick={() => { void requestCode(); }}>{seconds ? t.resendIn + " " + seconds + " " + t.seconds : t.resend}</button>
    </> : <>
      <span className="mb-5 grid size-14 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name={link ? "phone" : "user"} className="size-7"/></span>
      <h2 className="text-[clamp(1.4rem,3vw,1.9rem)] font-bold leading-tight tracking-tight">{link ? t.connectPhone : t.welcome}</h2>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{link ? t.connectPhoneText : t.welcomeText}</p>
      {!link && <><button className={cx(secondary, "mt-7 min-h-13 w-full gap-3")} type="button" disabled={!config?.googleEnabled || busy} onClick={() => window.location.assign(googleSignInUrl(locale))}><GoogleMark/>{t.google}</button>
        {config && !config.googleEnabled && <p className="mt-2 text-center text-xs leading-5 text-[var(--muted)]">{t.googleUnavailable}</p>}
        <div className="my-6 flex items-center gap-4 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]"/>{t.or}<span className="h-px flex-1 bg-[var(--line)]"/></div></>}
      <form className={cx("grid gap-4", link && "mt-7")} onSubmit={requestCode}>
        <label className={fieldClass}>{t.phone}<input className={inputClass} type="tel" inputMode="tel" autoComplete="tel" name="phone" value={phone} onChange={event => { setPhone(event.target.value); setError(""); }} placeholder="+374 99 123456" aria-describedby="account-phone-hint" maxLength={30} required disabled={busy}/></label>
        <span id="account-phone-hint" className="-mt-2 text-xs text-[var(--muted)]">{t.phoneHint}</span>
        <button className={cx(primaryButton, "min-h-13 w-full")} type="submit" disabled={busy || !config?.smsEnabled}>{busy ? t.sending : t.send}<Icon name="arrow"/></button>
      </form>
      {config && !config.smsEnabled && <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t.smsUnavailable}</p>}
      <p className="mt-5 text-xs leading-6 text-[var(--muted)]">{t.legal}</p>
    </>}
    {(error || params.get("auth")) && <div className="mt-4" id="account-auth-error"><Alert>{error || t.providerError}</Alert></div>}
  </div>;
}

type Tab = "home" | "orders" | "addresses" | "profile" | "security";
export function AccountPage() {
  const { locale, customer, customerLoaded, refreshCustomer, favorites } = useStorefront();
  const t = accountCopy[locale];
  const [config, setConfig] = useState<AccountConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [storedOrders, setOrders] = useState<AccountOrders | null>(null);
  const [storedAddresses, setAddresses] = useState<AccountAddress[]>([]);
  const [dataOwner, setDataOwner] = useState<string | null>(null);
  const orders = dataOwner === customer?.id ? storedOrders : null;
  const addresses = dataOwner === customer?.id ? storedAddresses : [];
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [addressForm, setAddressForm] = useState<AccountAddress | "new" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [linkPhone, setLinkPhone] = useState(false);
  const actionLock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void accountRequest<AccountConfig>("auth/config", { signal: controller.signal }).then(setConfig).catch(() => { if (!controller.signal.aborted) setConfigError(true); });
    return () => controller.abort();
  }, []);
  const customerId = customer?.id;
  const loadData = useCallback(async () => {
    if (!customerId) { setOrders(null); setAddresses([]); return; }
    setLoading(true); setError("");
    try {
      const [nextOrders, nextAddresses] = await Promise.all([accountRequest<AccountOrders>("orders"), accountRequest<AccountAddress[]>("addresses")]);
      setOrders(nextOrders); setAddresses(nextAddresses);
      setDataOwner(customerId);
    } catch (cause) { setError(errorText(cause, accountCopy[locale])); }
    finally { setLoading(false); }
  }, [customerId, locale]);
  useEffect(() => { const timer = window.setTimeout(() => { void loadData(); }, 0); return () => window.clearTimeout(timer); }, [loadData]);
  const changeTab = (next: Tab) => { setTab(next); setError(""); setMessage(""); setAddressForm(null); setDeleteId(null); setLinkPhone(false); };
  const action = async (callback: () => Promise<void>, success = t.savedMessage) => {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError(""); setMessage("");
    try { await callback(); setMessage(success); }
    catch (cause) { setError(errorText(cause, t)); if (cause instanceof AccountError && cause.status === 401) await refreshCustomer(); }
    finally { actionLock.current = false; setBusy(false); }
  };
  const logout = (all = false) => { void action(async () => { await accountRequest("auth/logout" + (all ? "?all=true" : ""), { method: "POST" }); await refreshCustomer(); setOrders(null); setAddresses([]); setTab("home"); }, ""); };
  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    void action(async () => { await accountRequest("profile", { method: "PATCH", body: JSON.stringify({ fullName: data.get("fullName"), locale: data.get("locale") }) }); await refreshCustomer(); });
  };
  const saveAddress = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const data = new FormData(event.currentTarget); const id = addressForm && addressForm !== "new" ? addressForm.id : null;
    const body = { label: data.get("label"), fullName: data.get("fullName"), phone: data.get("phone"), district: data.get("district"), addressLine: data.get("addressLine"), isDefault: data.get("isDefault") === "on" };
    void action(async () => { await accountRequest("addresses" + (id ? "/" + id : ""), { method: id ? "PATCH" : "POST", body: JSON.stringify(body) }); setAddresses(await accountRequest<AccountAddress[]>("addresses")); setAddressForm(null); });
  };
  const moreOrders = () => { void action(async () => { const next = await accountRequest<AccountOrders>("orders?offset=" + (orders?.items.length ?? 0)); setOrders(previous => ({ ...next, items: [...(previous?.items ?? []), ...next.items] })); }, ""); };
  const onAuthenticated = async () => { await refreshCustomer(); setLinkPhone(false); setMessage(""); setError(""); };
  const money = (amount: number) => new Intl.NumberFormat(locale === "hy" ? "hy-AM" : locale === "ru" ? "ru-RU" : "en-GB").format(amount) + " ֏";
  const date = (value: string) => new Intl.DateTimeFormat(locale === "hy" ? "hy-AM" : locale === "ru" ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
  const tabs: Array<{ id: Tab; icon: IconName }> = [{ id: "home", icon: "home" }, { id: "orders", icon: "orders" }, { id: "addresses", icon: "pin" }, { id: "profile", icon: "user" }, { id: "security", icon: "shield" }];
  const orderList = (limit?: number) => <div className="divide-y divide-[var(--line)]">{orders?.items.slice(0, limit).map(order => <details key={order.id} className="group p-5 max-sm:p-4">
    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[var(--paper)] text-[var(--accent)]"><Icon name="orders"/></span>
      <span className="min-w-0 flex-1"><strong className="block break-all text-sm">{order.orderNumber}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{date(order.createdAt)} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} {t.items.toLowerCase()}</span></span>
      <span className={cx("rounded-full px-3 py-1.5 text-xs font-medium", order.status === "delivered" ? "bg-emerald-50 text-emerald-700" : order.status === "cancelled" ? "bg-rose-50 text-rose-700" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>{t[order.status as keyof AccountCopy] ?? t.received}</span>
      <strong className="ml-auto text-sm">{money(order.totalAmd)}</strong><span className="text-[var(--muted)] transition group-open:rotate-90" aria-hidden="true">›</span><span className="sr-only">{t.details}</span>
    </summary>
    <div className="mt-5 grid gap-3 border-t border-[var(--line)] pt-4">{order.items.map(item => <div className="flex justify-between gap-4 text-sm" key={item.productId}><span className="min-w-0"><strong className="block font-medium">{item.title}</strong><span className="mt-1 block text-xs text-[var(--muted)]">{item.author} · ×{item.quantity}</span></span><span className="shrink-0">{money(item.subtotalAmd)}</span></div>)}
      <p className="mt-2 text-sm text-[var(--muted)]">{t.delivery}: {money(order.deliveryFeeAmd)} · {t.cash}</p><p className="break-words text-sm">{order.address}</p></div>
  </details>)}</div>;
  const empty = (icon: IconName, title: string, text: string, button?: ReactNode) => <div className="grid justify-items-center px-6 py-12 text-center"><span className="mb-5 grid size-16 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name={icon} className="size-7"/></span><h3 className="text-lg font-semibold">{title}</h3><p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted)]">{text}</p>{button && <div className="mt-6">{button}</div>}</div>;

  if (!customer) return <div className="bg-[var(--paper)] py-10 max-sm:py-6">
    <div className={cx(container, "grid overflow-hidden rounded-[28px] border border-[var(--line)] bg-white lg:grid-cols-2")}>
      <section className="relative hidden overflow-hidden bg-[#f0edff] p-12 lg:block">
        <span className="text-[10px] font-semibold tracking-[.15em] text-[var(--accent)]">{t.eyebrow}</span>
        <h1 className="mt-5 whitespace-pre-line text-[clamp(1.9rem,4vw,3.4rem)] font-bold leading-[1.12] tracking-[-.045em]">{t.title}</h1>
        <p className="mt-5 max-w-md text-sm leading-7 text-[#746c98]">{t.intro}</p>
        <BooksDrawing/>
        <div className="grid gap-4 sm:grid-cols-2">{[{ icon: "orders" as const, title: t.benefitOrders, text: t.benefitOrdersText }, { icon: "pin" as const, title: t.benefitAddress, text: t.benefitAddressText }].map(item => <div className="flex gap-3" key={item.title}><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/75 text-[var(--accent)]"><Icon name={item.icon} className="size-[18px]"/></span><div><h2 className="text-sm font-semibold">{item.title}</h2><p className="mt-1 text-xs leading-6 text-[#746c98]">{item.text}</p></div></div>)}</div>
      </section>
      <section className="flex flex-col justify-center p-9 max-sm:p-6 lg:p-12">
        {!customerLoaded && customerLoaded !== undefined ? <p className="py-16 text-center text-sm text-[var(--muted)]" role="status">{t.loading}</p> : <AuthPanel config={config} locale={locale} onSuccess={onAuthenticated}/>}
        {configError && <div className="mt-4"><Alert>{t.providerError}</Alert></div>}
        <Link className="mx-auto mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--accent)]" href={localized(locale, "/catalog")}>{t.guest}<Icon name="arrow" className="size-4"/></Link>
      </section>
    </div>
  </div>;

  const name = customer.fullName.trim() || t.reader;
  const editedAddress = addressForm && addressForm !== "new" ? addressForm : null;
  return <div className="bg-[var(--paper)] py-10 max-sm:py-6" data-testid="customer-dashboard">
    <div className={container}>
      <div className="mb-7 flex items-end justify-between gap-4"><div><span className="text-[10px] font-semibold tracking-[.14em] text-[var(--muted)]">{t.eyebrow}</span><h1 className="mt-3 text-[clamp(1.7rem,3vw,2.4rem)] font-bold tracking-tight">{t.greeting}, {name.split(" ")[0]}<span className="text-[var(--accent)]">.</span></h1><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.dashboardIntro}</p></div><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent-soft)] text-lg font-semibold text-[var(--accent)] lg:hidden" aria-hidden="true">{name[0]}</span></div>
      <div className="grid items-start gap-6 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className={cx(card, "overflow-hidden lg:sticky lg:top-48")}>
          <div className="hidden items-center gap-3 border-b border-[var(--line)] bg-[#f8f7ff] p-5 lg:flex"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--accent)] text-xl font-medium text-white" aria-hidden="true">{name[0]}</span><div className="min-w-0"><strong className="block truncate text-sm">{name}</strong><span className="mt-1 block truncate text-xs text-[var(--muted)]">{customer.phone ?? customer.googleEmail}</span></div></div>
          <nav className="flex gap-1 overflow-x-auto p-2 lg:grid lg:p-3" aria-label={t.eyebrow}>{tabs.map(item => <button key={item.id} type="button" className={cx("flex min-h-12 shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 text-left text-sm font-medium transition", tab === item.id ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--paper)] hover:text-[var(--ink)]")} onClick={() => changeTab(item.id)} aria-current={tab === item.id ? "page" : undefined}><Icon name={item.icon} className="size-[18px]"/>{t[item.id]}</button>)}</nav>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] p-3 lg:grid"><Link className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm text-[var(--muted)] hover:bg-[var(--paper)]" href={localized(locale, "/favorites")}><Icon name="heart" className="size-[18px]"/>{t.favorites}<span className="ml-auto rounded-lg bg-[var(--paper)] px-2 text-xs">{favorites.length}</span></Link><button className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-left text-sm whitespace-nowrap text-[var(--muted)] hover:text-rose-700" type="button" disabled={busy} onClick={() => logout()}><Icon name="logout" className="size-[18px]"/>{t.logout}</button></div>
        </aside>
        <div className="min-w-0 space-y-6">
          {error && <div className="space-y-2"><Alert>{error}</Alert><button type="button" className="min-h-11 text-sm font-medium text-[var(--accent)]" disabled={loading} onClick={() => { void loadData(); }}>{t.retry}</button></div>}{message && <Alert success>{message}</Alert>}
          {loading && <p className="text-sm text-[var(--muted)]" role="status">{t.loading}</p>}
          {tab === "home" && <>
            <section className="flex items-center justify-between gap-5 overflow-hidden rounded-3xl bg-[#ece8ff] p-7 max-sm:p-6"><div><span className="text-[10px] font-semibold tracking-widest text-[var(--accent)]">GRQASER</span><h2 className="mt-3 whitespace-pre-line text-3xl font-bold leading-[1.12] tracking-tight max-sm:text-2xl">{t.heroTitle}</h2><p className="mt-4 max-w-sm text-sm leading-7 text-[#746c98]">{t.heroText}</p><Link className={cx(primaryButton, "mt-5 min-h-11 px-5")} href={localized(locale, "/catalog")}>{t.catalog}<Icon name="arrow" className="size-4"/></Link></div><BooksDrawing compact/></section>
            <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">{[{ label: t.orders, count: orders?.total, icon: "orders" as const, click: () => changeTab("orders") }, { label: t.saved, count: favorites.length, icon: "heart" as const, href: localized(locale, "/favorites") }, { label: t.addresses, count: orders ? addresses.length : undefined, icon: "pin" as const, click: () => changeTab("addresses") }].map(item => { const children = <><span className="flex items-center gap-2 text-xs text-[var(--muted)]"><Icon name={item.icon} className="size-4"/>{item.label}</span><strong className="mt-4 block text-3xl font-semibold tracking-tight">{item.count ?? "—"}</strong></>; return item.href ? <Link key={item.label} className={cx(card, "p-5 transition hover:border-[var(--accent)]")} href={item.href}>{children}</Link> : <button className={cx(card, "p-5 text-left transition hover:border-[var(--accent)]")} key={item.label} type="button" onClick={item.click}>{children}</button>; })}</div>
            <p className="text-xs leading-6 text-[var(--muted)]">{t.browserFavorites}</p>
            <section className={card}><div className="flex items-center justify-between gap-4 border-b border-[var(--line)] px-6 py-5"><h2 className="text-base font-semibold">{t.recent}</h2><button className="min-h-11 text-sm font-medium text-[var(--accent)]" type="button" onClick={() => changeTab("orders")}>{t.seeAll} →</button></div>{orders?.items.length ? orderList(3) : !loading && orders && empty("book", t.emptyOrders, t.emptyOrdersText, <Link className={secondary} href={localized(locale, "/catalog")}>{t.catalog}<Icon name="arrow" className="size-4"/></Link>)}</section>
          </>}
          {tab === "orders" && <section className={card}><div className="border-b border-[var(--line)] px-6 py-6"><h2 className="text-xl font-semibold">{t.orders}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.orderHelp}</p></div>{orders?.items.length ? <>{orderList()}{orders.items.length < orders.total && <div className="p-5 text-center"><button type="button" className={secondary} disabled={busy} onClick={moreOrders}>{t.loadMore}</button></div>}</> : !loading && orders && empty("orders", t.emptyOrders, t.emptyOrdersText, <Link className={secondary} href={localized(locale, "/catalog")}>{t.catalog}</Link>)}</section>}
          {tab === "profile" && <section className={cx(card, "p-7 max-sm:p-5")}><h2 className="text-xl font-semibold">{t.profile}</h2><form className="mt-7 grid max-w-xl gap-5" onSubmit={saveProfile} key={customer.id + customer.fullName + customer.locale}><label className={fieldClass}>{t.fullName}<input className={inputClass} name="fullName" autoComplete="name" placeholder={t.namePlaceholder} defaultValue={customer.fullName} minLength={2} maxLength={100} required disabled={busy}/></label><label className={fieldClass}>{t.preferredLanguage}<select className={inputClass} name="locale" defaultValue={customer.locale} disabled={busy}><option value="hy">Հայերեն</option><option value="ru">Русский</option><option value="en">English</option></select></label><div className="rounded-2xl bg-[var(--paper)] p-4 text-sm"><p className="text-[var(--muted)]">{t.phone}</p><p className="mt-2 break-words">{customer.phone ?? t.notAdded}{customer.phone && <span className="ml-3 text-xs text-emerald-700">✓ {t.verified}</span>}</p>{customer.googleConnected && <><p className="mt-5 text-[var(--muted)]">{t.googleAccount}</p><p className="mt-2 break-all">{customer.googleEmail}</p></>}</div><button className={cx(primaryButton, "justify-self-start")} type="submit" disabled={busy}>{busy ? t.saving : t.save}<Icon name="check" className="size-4"/></button></form></section>}
          {tab === "addresses" && <>
            <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{t.addressTitle}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t.addressIntro}</p></div>{!addressForm && addresses.length < 10 && <button type="button" className={secondary} onClick={() => setAddressForm("new")}><Icon name="plus" className="size-4"/>{t.addAddress}</button>}</div>
            {addressForm && <form className={cx(card, "grid gap-5 p-6 max-sm:p-5")} onSubmit={saveAddress} key={editedAddress?.id ?? "new-address"}><div className="flex items-center justify-between gap-4"><h3 className="font-semibold">{editedAddress ? t.edit : t.addAddress}</h3><button type="button" className="min-h-11 text-sm text-[var(--muted)]" disabled={busy} onClick={() => setAddressForm(null)}>{t.cancel}</button></div><div className="grid gap-5 sm:grid-cols-2"><label className={fieldClass}>{t.addressLabel}<input className={inputClass} name="label" placeholder={t.labelPlaceholder} defaultValue={editedAddress?.label ?? ""} required maxLength={40} disabled={busy}/></label><label className={fieldClass}>{t.fullName}<input className={inputClass} name="fullName" autoComplete="name" defaultValue={editedAddress?.fullName ?? customer.fullName} minLength={2} maxLength={100} required disabled={busy}/></label><label className={fieldClass}>{t.phone}<input className={inputClass} name="phone" type="tel" autoComplete="tel" placeholder="+374 99 123456" defaultValue={editedAddress?.phone ?? customer.phone ?? ""} required maxLength={30} disabled={busy}/></label><label className={fieldClass}>{t.district}<select className={inputClass} name="district" defaultValue={editedAddress?.district ?? ""} required disabled={busy}><option value="" disabled>{t.chooseDistrict}</option>{dictionary[locale].cart.districtOptions.map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></label><label className={cx(fieldClass, "sm:col-span-2")}>{t.address}<input className={inputClass} name="addressLine" autoComplete="street-address" defaultValue={editedAddress?.addressLine ?? ""} required minLength={5} maxLength={200} disabled={busy}/></label></div><label className="flex min-h-11 items-center gap-3 text-sm"><input className="size-4 accent-[var(--accent)]" type="checkbox" name="isDefault" defaultChecked={editedAddress?.isDefault || addresses.length === 0} disabled={busy}/>{t.defaultAddress}</label><button type="submit" className={cx(primaryButton, "justify-self-start")} disabled={busy}>{busy ? t.saving : t.save}</button></form>}
            <div className="grid gap-4 sm:grid-cols-2">{addresses.map(address => <article className={cx(card, "flex min-w-0 flex-col p-5")} key={address.id}><div className="flex flex-wrap items-center justify-between gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon name="pin"/></span>{address.isDefault && <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--accent)]">{t.defaultAddress}</span>}</div><h3 className="mt-4 break-words font-semibold">{address.label}</h3><p className="mt-2 break-words text-sm leading-7 text-[var(--muted)]">{address.addressLine}<br/>{dictionary[locale].cart.districtOptions.find(([code]) => code === address.district)?.[1]}</p><p className="mt-3 text-sm">{address.fullName}<br/><span className="mt-1 inline-block text-[var(--muted)]">{address.phone}</span></p><div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4"><button type="button" className="min-h-11 text-sm font-medium text-[var(--accent)]" disabled={busy} onClick={() => { setAddressForm(address); setDeleteId(null); }}>{t.edit}</button>{!address.isDefault && <button type="button" className="min-h-11 text-xs text-[var(--muted)]" disabled={busy} onClick={() => { void action(async () => { await accountRequest("addresses/" + address.id, { method: "PATCH", body: JSON.stringify({ ...address, id: undefined, isDefault: true }) }); setAddresses(await accountRequest<AccountAddress[]>("addresses")); }); }}>{t.makeDefault}</button>}<button type="button" className="ml-auto min-h-11 text-sm text-rose-700" disabled={busy} onClick={() => setDeleteId(address.id)}>{t.remove}</button></div>{deleteId === address.id && <div className="mt-3 rounded-xl bg-rose-50 p-3"><p className="text-sm text-rose-800">{t.deleteQuestion}</p><div className="mt-2 flex flex-wrap gap-4"><button type="button" className="min-h-11 text-sm font-semibold text-rose-800" disabled={busy} onClick={() => { void action(async () => { await accountRequest("addresses/" + address.id, { method: "DELETE" }); setAddresses(await accountRequest<AccountAddress[]>("addresses")); setDeleteId(null); }); }}>{t.confirmDelete}</button><button type="button" className="min-h-11 text-sm" disabled={busy} onClick={() => setDeleteId(null)}>{t.cancel}</button></div></div>}</article>)}</div>
            {!addresses.length && !addressForm && !loading && orders && <section className={card}>{empty("pin", t.emptyAddress, t.emptyAddressText, <button type="button" className={primaryButton} onClick={() => setAddressForm("new")}>{t.addAddress}</button>)}</section>}
          </>}
          {tab === "security" && <section className={cx(card, "p-7 max-sm:p-5")}><h2 className="text-xl font-semibold">{t.security}</h2><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.securityIntro}</p><div className="mt-7 divide-y divide-[var(--line)]"><div className="flex flex-wrap items-center gap-4 py-5"><span className="grid size-11 place-items-center rounded-xl bg-[var(--paper)] text-[var(--accent)]"><Icon name="phone"/></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{customer.phone ?? t.phone}</h3><p className="mt-1 text-xs leading-6 text-[var(--muted)]">{customer.phone ? t.phoneConnected : t.connectPhoneText}</p></div>{customer.phone ? <span className="text-xs text-emerald-700">✓ {t.verified}</span> : <button type="button" className={secondary} disabled={!config?.smsEnabled} onClick={() => setLinkPhone(true)}>{t.connect}</button>}</div><div className="flex flex-wrap items-center gap-4 py-5"><span className="grid size-11 place-items-center rounded-xl bg-[var(--paper)]"><GoogleMark/></span><div className="min-w-0 flex-1"><h3 className="break-all text-sm font-semibold">{customer.googleEmail ?? t.googleAccount}</h3><p className="mt-1 text-xs leading-6 text-[var(--muted)]">{customer.googleConnected ? t.googleConnected : t.google}</p></div>{customer.googleConnected ? <span className="text-xs text-emerald-700">✓ {t.connected}</span> : <button type="button" className={secondary} disabled={!config?.googleEnabled} onClick={() => window.location.assign(googleSignInUrl(locale, true))}>{t.connect}</button>}</div></div>{linkPhone && <div className="my-6 rounded-2xl border border-[var(--line)] p-5"><AuthPanel config={config} locale={locale} onSuccess={onAuthenticated} link/><button className="mt-3 min-h-11 text-sm text-[var(--muted)]" type="button" onClick={() => setLinkPhone(false)}>{t.cancel}</button></div>}<div className="mt-5 rounded-2xl bg-[var(--paper)] p-5"><h3 className="text-sm font-semibold">{t.sessions}</h3><p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t.sessionsText}</p><button className={cx(secondary, "mt-5 text-rose-700")} type="button" disabled={busy} onClick={() => logout(true)}><Icon name="logout" className="size-4"/>{t.logoutAll}</button></div></section>}
        </div>
      </div>
    </div>
  </div>;
}
