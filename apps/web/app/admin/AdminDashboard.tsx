"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";

type Locale = "HY" | "RU" | "EN";
type Section = "overview" | "orders" | "catalog" | "procurement" | "crawler";
type OrderStatus =
  | "REQUEST_RECEIVED"
  | "CUSTOMER_CONFIRMED"
  | "PROCUREMENT_PENDING"
  | "SUPPLIER_CONFIRMED"
  | "READY_FOR_DELIVERY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CUSTOMER_REFUSED"
  | "CANCELLED";
type CashStatus = "CASH_DUE" | "CASH_COLLECTED" | "CASH_RECONCILED" | "CASH_REFUSED";
type ProcurementStatus = "PENDING_OPERATOR" | "SUPPLIER_CONFIRMED" | "SOURCE_UNAVAILABLE" | "CANCELLED";

type CrawlerStatus = {
  mode: "FIXTURE_ONLY" | "PERMISSION_GATED_HTML";
  liveRunAllowed: boolean;
  gate: {
    allowed: boolean;
    production: boolean;
    liveEnabled: boolean;
    writtenPermission: boolean;
    dailyRequestBudget: number;
    unmet: string[];
  };
  networkFetcherImplemented: boolean;
  budget: {
    dateUtc: string;
    limit: number;
    used: number;
    remaining: number;
    persistence: string;
  };
  killSwitch: {
    engaged: boolean;
    reason: string | null;
    sourceUrl: string | null;
    engagedAt: string | null;
    resetAt: string | null;
    resetReason: string | null;
  };
  safetyNotice: string;
};

type DashboardData = {
  generatedAt: string;
  ordersByStatus: Record<OrderStatus, number>;
  procurementsByStatus: Record<ProcurementStatus, number>;
  crawler: CrawlerStatus;
  persistence: string;
};

type OrderRecord = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  locale: "hy" | "ru" | "en";
  customer: { fullName: string; phone: string; email: string | null };
  delivery: {
    city: "YEREVAN";
    district: string;
    addressLine: string;
    apartment: string | null;
    entrance: string | null;
    floor: string | null;
    notes: string | null;
  };
  paymentMethod: "CASH_ON_DELIVERY";
  cod: {
    dueAmd: number;
    status: CashStatus;
    collectedAt: string | null;
    reconciledAt: string | null;
    fiscalReceiptNumber: string | null;
    reconciliationReference: string | null;
    refusalReason: string | null;
  };
  currency: "AMD";
  items: Array<{
    productId: string;
    supplierSku: string;
    title: string;
    author: string;
    sourceUrl: string;
    quantity: number;
    sourceUnitPriceAmd: number;
    customerUnitPriceAmd: number;
    customerSubtotalAmd: number;
  }>;
  itemsSubtotalAmd: number;
  deliveryFeeAmd: number;
  totalAmd: number;
  projectedMarginAmd: number;
  customerConfirmationRequired: boolean;
  createdAt: string;
  updatedAt: string;
};

type ProcurementTask = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: ProcurementStatus;
  supplierName: "Books.am";
  currency: "AMD";
  items: Array<{
    productId: string;
    supplierSku: string;
    title: string;
    author: string;
    sourceUrl: string;
    quantity: number;
    observedSourceUnitPriceAmd: number;
  }>;
  supplierItemsSubtotalAmd: number;
  supplierDeliveryFeeAmd: number | null;
  supplierTotalAmd: number | null;
  supplierReference: string | null;
  operatorNote: string | null;
  confirmedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CatalogBook = {
  id: string;
  slug: string;
  title: string;
  author: string;
  language: string;
  locale: "hy" | "ru" | "en";
  isbn: string | null;
  publisher: string | null;
  availability: "PRELIMINARY_AVAILABLE" | "OUT_OF_STOCK";
  observedAt: string;
  price: { amount: number; currency: "AMD" };
  availabilityNotice: string;
};

type Snapshot = {
  dashboard: DashboardData;
  orders: OrderRecord[];
  procurements: ProcurementTask[];
  crawler: CrawlerStatus;
  catalog: { items: CatalogBook[]; total: number };
};

type Connection = { baseUrl: string; adminKey: string };
type DialogAction =
  | { kind: "cash-collect"; order: OrderRecord }
  | { kind: "cash-reconcile"; order: OrderRecord }
  | { kind: "cash-refuse"; order: OrderRecord }
  | { kind: "proc-confirm"; task: ProcurementTask }
  | { kind: "proc-unavailable"; task: ProcurementTask }
  | { kind: "proc-cancel"; task: ProcurementTask }
  | { kind: "crawler-resume" };

const defaultApiBase = (process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1").replace(/\/$/u, "");

const navigation: Array<{ id: Section; icon: string }> = [
  { id: "overview", icon: "⌂" },
  { id: "orders", icon: "▤" },
  { id: "catalog", icon: "▦" },
  { id: "procurement", icon: "↗" },
  { id: "crawler", icon: "◎" },
];

const copy = {
  RU: {
    nav: { overview: "Обзор", orders: "Заказы", catalog: "Каталог", procurement: "Закупки", crawler: "Парсер" },
    connect: { eyebrow: "Защищённое подключение", title: "Операционный центр", text: "Подключитесь к Nest API. Ключ хранится только в памяти этой вкладки и исчезнет при перезагрузке.", base: "Адрес API", key: "Admin API key", button: "Подключиться", connecting: "Проверяем доступ…", security: "Ключ не записывается в localStorage или sessionStorage.", invalid: "Укажите HTTP(S) адрес или same-origin путь /api/v1." },
    common: { refresh: "Обновить", refreshing: "Обновляем…", retry: "Повторить", disconnect: "Отключиться", loading: "Загружаем операционные данные…", empty: "Здесь пока нет данных", error: "Не удалось выполнить запрос", cancel: "Отмена", confirm: "Подтвердить", save: "Выполнить", close: "Закрыть" },
    action: { next: "Следующий этап", cancel: "Отменить заказ", collect: "Принять наличные", reconcile: "Сверить кассу", refuse: "Отказ клиента", procConfirm: "Подтвердить закупку", unavailable: "Нет у поставщика", procCancel: "Отменить закупку", parse: "Проверить fixture", resume: "Снять kill switch", openSupplier: "Открыть разрешённую карточку поставщика" },
    kpi: { sales: "Сумма заказов", margin: "Прогнозная маржа", active: "Активные заявки", procurement: "Ждут закупки" },
  },
  HY: {
    nav: { overview: "Ամփոփում", orders: "Պատվերներ", catalog: "Կատալոգ", procurement: "Գնումներ", crawler: "Փարսեր" },
    connect: { eyebrow: "Պաշտպանված կապ", title: "Գործառնական կենտրոն", text: "Միացեք Nest API-ին։ Բանալին պահվում է միայն այս ներդիրի հիշողության մեջ և կջնջվի թարմացնելիս։", base: "API հասցե", key: "Admin API բանալի", button: "Միանալ", connecting: "Ստուգում ենք մուտքը…", security: "Բանալին չի պահվում localStorage-ում կամ sessionStorage-ում։", invalid: "Նշեք HTTP(S) հասցե կամ նույն աղբյուրի /api/v1 ուղի։" },
    common: { refresh: "Թարմացնել", refreshing: "Թարմացվում է…", retry: "Կրկնել", disconnect: "Անջատել", loading: "Բեռնում ենք գործառնական տվյալները…", empty: "Տվյալներ դեռ չկան", error: "Հարցումը չհաջողվեց", cancel: "Չեղարկել", confirm: "Հաստատել", save: "Կատարել", close: "Փակել" },
    action: { next: "Հաջորդ փուլ", cancel: "Չեղարկել պատվերը", collect: "Ընդունել կանխիկը", reconcile: "Համադրել դրամարկղը", refuse: "Հաճախորդի մերժում", procConfirm: "Հաստատել գնումը", unavailable: "Չկա մատակարարի մոտ", procCancel: "Չեղարկել գնումը", parse: "Ստուգել fixture-ը", resume: "Անջատել kill switch-ը", openSupplier: "Բացել մատակարարի թույլատրված քարտը" },
    kpi: { sales: "Պատվերների գումար", margin: "Կանխատեսվող մարժա", active: "Ակտիվ հայտեր", procurement: "Սպասում են գնման" },
  },
  EN: {
    nav: { overview: "Overview", orders: "Orders", catalog: "Catalog", procurement: "Procurement", crawler: "Crawler" },
    connect: { eyebrow: "Secure connection", title: "Operations center", text: "Connect to the Nest API. The key is kept only in this tab’s React memory and disappears on reload.", base: "API base URL", key: "Admin API key", button: "Connect", connecting: "Checking access…", security: "The key is never written to localStorage or sessionStorage.", invalid: "Enter an HTTP(S) address or the same-origin /api/v1 path." },
    common: { refresh: "Refresh", refreshing: "Refreshing…", retry: "Retry", disconnect: "Disconnect", loading: "Loading operational data…", empty: "No data here yet", error: "The request failed", cancel: "Cancel", confirm: "Confirm", save: "Run action", close: "Close" },
    action: { next: "Next stage", cancel: "Cancel order", collect: "Collect cash", reconcile: "Reconcile cash", refuse: "Customer refusal", procConfirm: "Confirm procurement", unavailable: "Supplier unavailable", procCancel: "Cancel procurement", parse: "Parse fixture", resume: "Reset kill switch", openSupplier: "Open permitted supplier page" },
    kpi: { sales: "Order value", margin: "Projected margin", active: "Active requests", procurement: "Awaiting procurement" },
  },
} as const;

const orderTone: Record<OrderStatus, string> = {
  REQUEST_RECEIVED: "border-indigo-100 bg-indigo-50 text-indigo-700",
  CUSTOMER_CONFIRMED: "border-sky-100 bg-sky-50 text-sky-700",
  PROCUREMENT_PENDING: "border-amber-100 bg-amber-50 text-amber-700",
  SUPPLIER_CONFIRMED: "border-violet-100 bg-violet-50 text-violet-700",
  READY_FOR_DELIVERY: "border-cyan-100 bg-cyan-50 text-cyan-700",
  OUT_FOR_DELIVERY: "border-cyan-100 bg-cyan-50 text-cyan-700",
  DELIVERED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  CUSTOMER_REFUSED: "border-rose-100 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
};

const procurementTone: Record<ProcurementStatus, string> = {
  PENDING_OPERATOR: "border-amber-100 bg-amber-50 text-amber-700",
  SUPPLIER_CONFIRMED: "border-emerald-100 bg-emerald-50 text-emerald-700",
  SOURCE_UNAVAILABLE: "border-rose-100 bg-rose-50 text-rose-700",
  CANCELLED: "border-slate-200 bg-slate-100 text-slate-600",
};

const nextOrderStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  REQUEST_RECEIVED: "CUSTOMER_CONFIRMED",
  CUSTOMER_CONFIRMED: "PROCUREMENT_PENDING",
  SUPPLIER_CONFIRMED: "READY_FOR_DELIVERY",
  READY_FOR_DELIVERY: "OUT_FOR_DELIVERY",
};

const panelClass = "min-w-0 overflow-hidden rounded-2xl border border-[#e3e9e6] bg-white shadow-[0_6px_24px_rgba(31,55,46,0.035)]";
const primaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#183d33] px-4 text-xs font-bold text-white transition hover:bg-[#234c41] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-300";
const secondaryButtonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#dfe6e2] bg-white px-4 text-xs font-bold text-[#33443e] transition hover:bg-[#f7faf8] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-indigo-300";

function formatAmd(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ֏`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Yerevan" }).format(date);
}

function humanStatus(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}

async function apiRequest<T>(connection: Connection, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${connection.baseUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      "x-admin-api-key": connection.adminKey,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json() as { message?: string | string[]; code?: string };
      const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
      detail = [body.code, message].filter(Boolean).join(": ") || detail;
    } catch { /* The status line is still useful. */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

async function loadSnapshot(connection: Connection, locale: Locale): Promise<Snapshot> {
  const catalogLocale = locale.toLocaleLowerCase();
  const [dashboard, orders, procurements, crawler, catalog] = await Promise.all([
    apiRequest<DashboardData>(connection, "/admin/dashboard"),
    apiRequest<OrderRecord[]>(connection, "/admin/orders"),
    apiRequest<ProcurementTask[]>(connection, "/admin/procurements"),
    apiRequest<CrawlerStatus>(connection, "/admin/crawler/status"),
    apiRequest<{ items: CatalogBook[]; total: number }>(connection, `/catalog/books?locale=${catalogLocale}&limit=100`),
  ]);
  return { dashboard, orders, procurements, crawler, catalog };
}

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-[9px] font-extrabold capitalize ${className}`}>{children}</span>;
}

function LocaleSwitch({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return <div className="flex rounded-lg border border-[#dfe6e2] bg-[#f8faf9] p-0.5" role="group" aria-label="Interface language">{(["HY", "RU", "EN"] as const).map((item) => <button type="button" key={item} aria-pressed={locale === item} onClick={() => onChange(item)} className={`rounded-md px-2 py-1 text-[9px] font-extrabold transition ${locale === item ? "bg-[#183d33] text-white shadow-sm" : "text-[#7d8984] hover:bg-white"}`}>{item}</button>)}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="grid min-h-48 place-items-center p-8 text-center"><div><span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-full bg-[#f0f4f2] text-xl text-[#7b8c84]">◇</span><p className="mt-3 text-xs font-semibold text-[#728079]">{text}</p></div></div>;
}

function PanelHeader({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="flex min-h-[70px] items-center justify-between gap-4 border-b border-[#edf1ef] px-5 py-4"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[#8d9994]">{eyebrow}</p><h2 className="mt-1 font-serif text-lg font-semibold tracking-tight text-[#202c27]">{title}</h2></div>{action}</div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-5 flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#899690]">{eyebrow}</p><h1 className="mt-1 font-serif text-3xl font-medium tracking-tight sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-xs leading-5 text-[#7d8984]">{description}</p></div>{action ? <div className="w-full shrink-0 lg:w-auto">{action}</div> : null}</div>;
}

function ConnectScreen({ locale, onLocale, busy, error, onConnect }: { locale: Locale; onLocale: (locale: Locale) => void; busy: boolean; error: string | null; onConnect: (connection: Connection) => Promise<void> }) {
  const t = copy[locale];
  const [baseUrl, setBaseUrl] = useState(defaultApiBase);
  const [adminKey, setAdminKey] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let normalized: string;
    try {
      const trimmed = baseUrl.trim();
      if (/^\/(?!\/)/u.test(trimmed)) {
        normalized = trimmed.replace(/\/$/u, "") || "/";
      } else {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
        normalized = parsed.toString().replace(/\/$/u, "");
      }
    } catch {
      setValidation(t.connect.invalid);
      return;
    }
    setValidation(null);
    await onConnect({ baseUrl: normalized, adminKey });
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-[#f3f6f4] p-4 font-sans text-[#17201d] antialiased sm:p-8">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 h-80 bg-gradient-to-br from-[#173e33] via-[#17372f] to-[#102b24]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[26px] border border-white/15 bg-white shadow-[0_30px_90px_rgba(19,48,40,0.2)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#1a4538] to-[#112e27] p-8 text-white sm:p-11">
            <div aria-hidden="true" className="absolute -right-20 -top-20 size-64 rounded-full border border-white/5 shadow-[0_0_0_40px_rgba(255,255,255,.02),0_0_0_80px_rgba(255,255,255,.012)]" />
            <div className="relative flex h-full min-h-[300px] flex-col">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[11px_11px_11px_4px] bg-[#f4be66] font-serif text-xl font-black text-[#173b31]">L</span><strong className="font-serif text-xl tracking-wide">LUMI Books</strong></div>
              <div className="my-auto py-12"><p className="text-[10px] font-extrabold uppercase tracking-[0.17em] text-[#efbd6b]">{t.connect.eyebrow}</p><h1 className="mt-3 font-serif text-4xl font-medium tracking-tight sm:text-5xl">{t.connect.title}</h1><p className="mt-5 max-w-md text-xs leading-6 text-white/55">{t.connect.text}</p></div>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-[10px] leading-5 text-white/55"><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-emerald-200">✓</span>{t.connect.security}</div>
            </div>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-12">
            <div className="mb-8 flex items-center justify-between"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8a9690]">NestJS Admin API</p><LocaleSwitch locale={locale} onChange={onLocale} /></div>
            <form className="space-y-5" onSubmit={submit}>
              <label className="grid gap-2 text-[10px] font-bold text-[#526059]">{t.connect.base}<input required autoComplete="url" spellCheck={false} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="h-12 rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-4 text-xs font-medium outline-none transition focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100" /></label>
              <label className="grid gap-2 text-[10px] font-bold text-[#526059]">{t.connect.key}<input required autoComplete="off" type="password" value={adminKey} onChange={(event) => setAdminKey(event.target.value)} className="h-12 rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-4 text-xs font-medium outline-none transition focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100" /></label>
              {(validation || error) ? <div role="alert" className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] leading-5 text-rose-700"><strong className="block">{t.common.error}</strong>{validation ?? error}</div> : null}
              <button disabled={busy} className={`${primaryButtonClass} h-12 w-full`} type="submit">{busy ? <><span aria-hidden="true" className="size-3 animate-spin rounded-full border-2 border-white/35 border-t-white" />{t.connect.connecting}</> : <>{t.connect.button}<span aria-hidden="true">→</span></>}</button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: "green" | "purple" | "blue" | "amber"; icon: string }) {
  const tones = { green: "bg-emerald-50 text-emerald-700", purple: "bg-violet-50 text-violet-700", blue: "bg-indigo-50 text-indigo-700", amber: "bg-amber-50 text-amber-700" };
  return <article className="min-w-0 rounded-2xl border border-[#e3e9e6] bg-white p-4 sm:p-5"><span aria-hidden="true" className={`grid size-8 place-items-center rounded-[10px] text-sm font-black ${tones[tone]}`}>{icon}</span><p className="mt-4 text-[10px] font-bold text-[#7e8b85]">{label}</p><strong className="mt-1 block font-serif text-2xl font-semibold tracking-tight">{value}</strong><p className="mt-1 truncate text-[9px] text-[#9ca6a1]">{detail}</p></article>;
}

function OrderActions({ order, locale, busy, onTransition, onDialog }: { order: OrderRecord; locale: Locale; busy: boolean; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  const next = nextOrderStatus[order.status];
  const cancellable = ["REQUEST_RECEIVED", "CUSTOMER_CONFIRMED", "PROCUREMENT_PENDING", "SUPPLIER_CONFIRMED", "READY_FOR_DELIVERY"].includes(order.status);
  return <div className="flex flex-wrap justify-end gap-1.5">
    {next ? <button disabled={busy} type="button" onClick={() => onTransition(order, next)} className="min-h-8 rounded-lg bg-[#183d33] px-2.5 text-[9px] font-bold text-white disabled:opacity-50">{t.action.next}</button> : null}
    {order.status === "OUT_FOR_DELIVERY" && order.cod.status === "CASH_DUE" ? <><button disabled={busy} type="button" onClick={() => onDialog({ kind: "cash-collect", order })} className="min-h-8 rounded-lg bg-emerald-600 px-2.5 text-[9px] font-bold text-white">{t.action.collect}</button><button disabled={busy} type="button" onClick={() => onDialog({ kind: "cash-refuse", order })} className="min-h-8 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[9px] font-bold text-rose-700">{t.action.refuse}</button></> : null}
    {order.status === "OUT_FOR_DELIVERY" && order.cod.status === "CASH_COLLECTED" ? <button disabled={busy} type="button" onClick={() => onDialog({ kind: "cash-reconcile", order })} className="min-h-8 rounded-lg bg-indigo-600 px-2.5 text-[9px] font-bold text-white">{t.action.reconcile}</button> : null}
    {order.status === "OUT_FOR_DELIVERY" && order.cod.status === "CASH_RECONCILED" ? <button disabled={busy} type="button" onClick={() => onTransition(order, "DELIVERED")} className="min-h-8 rounded-lg bg-emerald-600 px-2.5 text-[9px] font-bold text-white">DELIVERED</button> : null}
    {cancellable ? <button disabled={busy} type="button" onClick={() => onTransition(order, "CANCELLED")} className="min-h-8 rounded-lg border border-[#dfe5e2] bg-white px-2.5 text-[9px] font-bold text-[#6d7a74]">{t.action.cancel}</button> : null}
  </div>;
}

function OrdersTable({ orders, locale, busyId, onTransition, onDialog, empty }: { orders: OrderRecord[]; locale: Locale; busyId: string | null; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void; empty: string }) {
  if (!orders.length) return <EmptyState text={empty} />;
  return <div className="w-full overflow-x-auto"><table className="w-full min-w-[930px] border-collapse whitespace-nowrap text-left"><thead className="bg-[#fafbfa] text-[9px] font-extrabold uppercase tracking-wider text-[#96a09b]"><tr><th className="border-b border-[#e8ecea] px-5 py-3">Order</th><th className="border-b border-[#e8ecea] px-4 py-3">Customer</th><th className="border-b border-[#e8ecea] px-4 py-3">Total</th><th className="border-b border-[#e8ecea] px-4 py-3">Order status</th><th className="border-b border-[#e8ecea] px-4 py-3">COD</th><th className="border-b border-[#e8ecea] px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead><tbody className="text-[11px] text-[#4c5954]">{orders.map((order) => <tr key={order.id} className="align-middle transition hover:bg-[#fbfcfb]"><td className="border-b border-[#eef1ef] px-5 py-3"><strong className="block text-xs text-[#25322d]">{order.orderNumber}</strong><span className="mt-0.5 block text-[9px] text-[#9ba5a0]">{formatDate(order.createdAt)} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} items</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><strong className="block text-[#2a3732]">{order.customer.fullName}</strong><span className="mt-0.5 block text-[9px] text-[#929e98]">{order.customer.phone} · {humanStatus(order.delivery.district)}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><strong className="text-[#26332e]">{formatAmd(order.totalAmd)}</strong><span className="mt-0.5 block text-[9px] text-emerald-700">margin {formatAmd(order.projectedMarginAmd)}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><Pill className={orderTone[order.status]}>{humanStatus(order.status)}</Pill></td><td className="border-b border-[#eef1ef] px-4 py-3"><span className="block text-[9px] font-bold capitalize text-[#4f5e57]">{humanStatus(order.cod.status)}</span><span className="mt-0.5 block text-[8px] text-[#96a09b]">{formatAmd(order.cod.dueAmd)}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><OrderActions order={order} locale={locale} busy={busyId === order.id} onTransition={onTransition} onDialog={onDialog} /></td></tr>)}</tbody></table></div>;
}

function OverviewView({ snapshot, locale, busyId, onTransition, onDialog, go }: { snapshot: Snapshot; locale: Locale; busyId: string | null; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void; go: (section: Section) => void }) {
  const t = copy[locale];
  const total = snapshot.orders.reduce((sum, order) => sum + order.totalAmd, 0);
  const margin = snapshot.orders.reduce((sum, order) => sum + order.projectedMarginAmd, 0);
  const active = snapshot.orders.filter((order) => !["DELIVERED", "CUSTOMER_REFUSED", "CANCELLED"].includes(order.status)).length;
  const pending = snapshot.procurements.filter((task) => task.status === "PENDING_OPERATOR").length;
  return <>
    <section className="relative flex min-h-[220px] flex-col justify-between gap-7 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1a4538] via-[#14372e] to-[#102b24] p-6 text-white shadow-[0_18px_44px_rgba(21,57,47,0.11)] sm:p-8 lg:flex-row lg:items-center"><div aria-hidden="true" className="absolute -right-20 -top-28 size-80 rounded-full border border-white/5 shadow-[0_0_0_45px_rgba(255,255,255,.018),0_0_0_90px_rgba(255,255,255,.012)]" /><div className="relative z-10 max-w-3xl"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f0bd68]">LUMI OPERATIONS · {formatDate(snapshot.dashboard.generatedAt)}</p><h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-5xl">{t.nav.overview}</h1><p className="mt-3 max-w-2xl text-xs leading-5 text-white/60">{snapshot.dashboard.persistence} · {snapshot.crawler.mode}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => go("orders")} className="min-h-10 rounded-xl bg-[#f2bd68] px-4 text-xs font-extrabold text-[#263a32]">{t.nav.orders} →</button><button type="button" onClick={() => go("procurement")} className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold">{t.nav.procurement}</button></div></div><div className="relative z-10 flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 lg:w-auto"><span className={`grid size-11 place-items-center rounded-full font-black ${snapshot.crawler.killSwitch.engaged ? "bg-rose-300/15 text-rose-200" : "bg-emerald-300/10 text-emerald-200"}`}>{snapshot.crawler.killSwitch.engaged ? "!" : "✓"}</span><div><strong className="block text-xs">{snapshot.crawler.killSwitch.engaged ? "Kill switch engaged" : "API connected"}</strong><span className="mt-1 block text-[10px] text-white/45">{snapshot.crawler.networkFetcherImplemented ? "network fetcher available" : "fixture-only, no live fetch"}</span></div></div></section>
    <section className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4"><MetricCard label={t.kpi.sales} value={formatAmd(total)} detail={`${snapshot.orders.length} records`} tone="green" icon="֏" /><MetricCard label={t.kpi.margin} value={formatAmd(margin)} detail="server-computed" tone="purple" icon="↗" /><MetricCard label={t.kpi.active} value={String(active)} detail="not terminal" tone="blue" icon="▤" /><MetricCard label={t.kpi.procurement} value={String(pending)} detail="operator queue" tone="amber" icon="◎" /></section>
    <section className={`${panelClass} mt-4`}><PanelHeader eyebrow="Live API" title={t.nav.orders} action={<button type="button" onClick={() => go("orders")} className="text-[10px] font-bold text-[#4e6b61]">{t.nav.orders} →</button>} /><OrdersTable orders={snapshot.orders.slice(0, 5)} locale={locale} busyId={busyId} onTransition={onTransition} onDialog={onDialog} empty={t.common.empty} /></section>
  </>;
}

function OrdersView({ orders, locale, busyId, onTransition, onDialog }: { orders: OrderRecord[]; locale: Locale; busyId: string | null; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return orders.filter((order) => !needle || `${order.orderNumber} ${order.customer.fullName} ${order.customer.phone} ${order.status}`.toLocaleLowerCase().includes(needle)); }, [orders, query]);
  return <><SectionHeading eyebrow="Nest Admin API" title={t.nav.orders} description="Server-authoritative state, procurement and cash-on-delivery controls." /><section className={panelClass}><div className="border-b border-[#e3e9e6] p-3"><label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[#dee5e1] bg-[#fafbfa] px-3"><span aria-hidden="true">⌕</span><span className="sr-only">Search orders</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Order, customer, phone" className="w-full bg-transparent text-[11px] outline-none" /></label></div><OrdersTable orders={filtered} locale={locale} busyId={busyId} onTransition={onTransition} onDialog={onDialog} empty={t.common.empty} /></section></>;
}

function CatalogView({ catalog, locale }: { catalog: Snapshot["catalog"]; locale: Locale }) {
  const t = copy[locale];
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return catalog.items.filter((book) => !needle || `${book.title} ${book.author} ${book.isbn ?? ""}`.toLocaleLowerCase().includes(needle)); }, [catalog.items, query]);
  return <><SectionHeading eyebrow="Local catalog API" title={t.nav.catalog} description="Only local API data is displayed; opening or crawling live Books.am pages is not available here." /><section className={panelClass}><div className="flex items-center justify-between gap-3 border-b border-[#e3e9e6] p-3"><label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[#dee5e1] bg-[#fafbfa] px-3"><span aria-hidden="true">⌕</span><span className="sr-only">Search catalog</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, ISBN" className="w-full bg-transparent text-[11px] outline-none" /></label><span className="hidden text-[10px] font-bold text-[#8c9792] sm:block">{catalog.total}</span></div>{filtered.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="bg-[#fafbfa] text-[9px] uppercase tracking-wider text-[#96a09b]"><tr><th className="border-b border-[#e8ecea] px-5 py-3">Book</th><th className="border-b border-[#e8ecea] px-4 py-3">Price</th><th className="border-b border-[#e8ecea] px-4 py-3">Locale</th><th className="border-b border-[#e8ecea] px-4 py-3">Availability</th><th className="border-b border-[#e8ecea] px-4 py-3">Observed</th></tr></thead><tbody>{filtered.map((book) => <tr key={book.id} className="text-[11px]"><td className="border-b border-[#eef1ef] px-5 py-3"><strong className="block">{book.title}</strong><span className="mt-0.5 block text-[9px] text-[#8c9993]">{book.author} · {book.isbn ?? "no ISBN"}</span></td><td className="border-b border-[#eef1ef] px-4 py-3 font-bold">{formatAmd(book.price.amount)}</td><td className="border-b border-[#eef1ef] px-4 py-3 uppercase">{book.locale} / {book.language}</td><td className="border-b border-[#eef1ef] px-4 py-3"><Pill className={book.availability === "PRELIMINARY_AVAILABLE" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}>{humanStatus(book.availability)}</Pill></td><td className="border-b border-[#eef1ef] px-4 py-3">{formatDate(book.observedAt)}</td></tr>)}</tbody></table></div> : <EmptyState text={t.common.empty} />}</section></>;
}

function ProcurementView({ tasks, locale, busyId, onDialog }: { tasks: ProcurementTask[]; locale: Locale; busyId: string | null; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  return <><SectionHeading eyebrow="Manual B2B queue" title={t.nav.procurement} description="Only operator-confirmed supplier outcomes are recorded. External Books.am pages open solely for manual operator review; no click or checkout is automated." /><section className={panelClass}>{tasks.length ? <div className="divide-y divide-[#edf1ef]">{tasks.map((task) => <article key={task.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_140px_160px_auto] lg:items-center"><div><strong className="block text-sm">{task.orderNumber}</strong><div className="mt-2 space-y-2">{task.items.map((item) => <div key={`${task.id}-${item.productId}`} className="rounded-lg bg-[#f8faf9] px-2.5 py-2"><span className="block text-[9px] font-semibold text-[#44524c]">{item.title} × {item.quantity} · {formatAmd(item.observedSourceUnitPriceAmd)}</span><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" title={item.sourceUrl} className="mt-1 inline-flex items-center gap-1 text-[8px] font-bold text-indigo-700 underline decoration-indigo-200 underline-offset-2"><span aria-hidden="true">Books.am ↗</span><span className="sr-only">External Books.am URL: </span>{t.action.openSupplier}</a></div>)}</div>{task.operatorNote ? <p className="mt-2 text-[9px] text-[#78613b]">{task.operatorNote}</p> : null}</div><div><span className="text-[8px] uppercase text-[#929d98]">{task.supplierName} observed</span><strong className="mt-1 block text-xs">{formatAmd(task.supplierItemsSubtotalAmd)}</strong><span className="mt-0.5 block text-[8px] text-[#9aa49f]">{task.supplierTotalAmd === null ? "quote not confirmed" : formatAmd(task.supplierTotalAmd)}</span></div><div><Pill className={procurementTone[task.status]}>{humanStatus(task.status)}</Pill>{task.supplierReference ? <span className="mt-1 block text-[8px] text-[#8b9691]">ref: {task.supplierReference}</span> : null}</div><div className="flex flex-wrap justify-end gap-2">{task.status === "PENDING_OPERATOR" ? <><button disabled={busyId === task.id} type="button" onClick={() => onDialog({ kind: "proc-confirm", task })} className="min-h-9 rounded-lg bg-[#183d33] px-3 text-[9px] font-bold text-white">{t.action.procConfirm}</button><button disabled={busyId === task.id} type="button" onClick={() => onDialog({ kind: "proc-unavailable", task })} className="min-h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[9px] font-bold text-rose-700">{t.action.unavailable}</button><button disabled={busyId === task.id} type="button" onClick={() => onDialog({ kind: "proc-cancel", task })} className="min-h-9 rounded-lg border border-[#dfe5e2] bg-white px-3 text-[9px] font-bold text-[#6d7a74]">{t.action.procCancel}</button></> : null}</div></article>)}</div> : <EmptyState text={t.common.empty} />}</section></>;
}

function CrawlerView({ crawler, locale, busy, lastResult, onParse, onDialog }: { crawler: CrawlerStatus; locale: Locale; busy: boolean; lastResult: unknown; onParse: (fixture: "book-detail" | "book-price-conflict") => void; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  return <><SectionHeading eyebrow="Safety controls" title={t.nav.crawler} description="This screen exposes bundled fixture controls only. No action on this screen performs a live Books.am request." /><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Mode" value={crawler.mode} detail="server-reported" tone="blue" icon="◎" /><MetricCard label="Network fetcher" value={crawler.networkFetcherImplemented ? "AVAILABLE" : "OFF"} detail={crawler.liveRunAllowed ? "live gate open" : "live gate closed"} tone={crawler.liveRunAllowed ? "green" : "amber"} icon="⌁" /><MetricCard label="Daily budget" value={`${crawler.budget.remaining}/${crawler.budget.limit}`} detail={crawler.gate.writtenPermission ? "permission recorded" : "permission absent"} tone="amber" icon="#" /><MetricCard label="Kill switch" value={crawler.killSwitch.engaged ? "ENGAGED" : "READY"} detail={crawler.killSwitch.reason ?? "no incident"} tone={crawler.killSwitch.engaged ? "amber" : "green"} icon="!" /></section><div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]"><section className={panelClass}><PanelHeader eyebrow="Bundled HTML" title="Contract fixtures" /><div className="grid gap-3 p-5 sm:grid-cols-2"><button disabled={busy} type="button" onClick={() => onParse("book-detail")} className={`${secondaryButtonClass} justify-between`}>book-detail <span>→</span></button><button disabled={busy} type="button" onClick={() => onParse("book-price-conflict")} className={`${secondaryButtonClass} justify-between`}>price-conflict <span>→</span></button></div>{lastResult ? <pre className="max-h-64 overflow-auto border-t border-[#edf1ef] bg-[#f8faf9] p-5 text-[9px] leading-4 text-[#435149]">{JSON.stringify(lastResult, null, 2)}</pre> : <EmptyState text={t.common.empty} />}</section><aside className={panelClass}><PanelHeader eyebrow="Runtime guard" title="Kill switch" action={crawler.killSwitch.engaged ? <Pill className="border-rose-100 bg-rose-50 text-rose-700">engaged</Pill> : <Pill className="border-emerald-100 bg-emerald-50 text-emerald-700">ready</Pill>} /><div className="p-5"><p className="text-[10px] leading-5 text-[#65736c]">{crawler.safetyNotice}</p><dl className="mt-5 space-y-3 border-y border-[#edf1ef] py-4 text-[9px]"><div className="flex justify-between gap-4"><dt className="text-[#8b9791]">Reason</dt><dd className="text-right font-bold">{crawler.killSwitch.reason ?? "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#8b9791]">Engaged</dt><dd className="text-right font-bold">{formatDate(crawler.killSwitch.engagedAt)}</dd></div></dl>{crawler.killSwitch.engaged ? <button disabled={busy} type="button" onClick={() => onDialog({ kind: "crawler-resume" })} className={`${primaryButtonClass} mt-5 w-full`}>{t.action.resume}</button> : null}</div></aside></div></>;
}

function ActionDialogView({ action, locale, busy, error, onClose, onSubmit }: { action: DialogAction; locale: Locale; busy: boolean; error: string | null; onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const t = copy[locale];
  const config = action.kind === "cash-collect" ? { title: t.action.collect, label: "Fiscal receipt number", field: "fiscalReceiptNumber", placeholder: "e-HDM / receipt", min: 3, max: 100 }
    : action.kind === "cash-reconcile" ? { title: t.action.reconcile, label: "Reconciliation reference", field: "reconciliationReference", placeholder: "Cash report / shift reference", min: 3, max: 120 }
      : action.kind === "cash-refuse" ? { title: t.action.refuse, label: "Reason", field: "reason", placeholder: "Document the customer refusal", min: 3, max: 500 }
        : action.kind === "proc-confirm" ? { title: t.action.procConfirm, label: "Supplier reference", field: "supplierReference", placeholder: "Manual Books.am order/reference", min: 2, max: 120 }
          : action.kind === "proc-unavailable" ? { title: t.action.unavailable, label: "Operator note", field: "note", placeholder: "Why the item cannot be purchased", min: 3, max: 500 }
            : action.kind === "proc-cancel" ? { title: t.action.procCancel, label: "Operator note", field: "note", placeholder: "Why the procurement was cancelled", min: 3, max: 500 }
              : { title: t.action.resume, label: "Operator reason", field: "reason", placeholder: "Reason for resetting the kill switch", min: 8, max: 300 };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onSubmit({ [config.field]: String(form.get(config.field) ?? "").trim() });
  }

  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[#0e211b]/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="action-title" className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#8a9690]">Server command</p><h2 id="action-title" className="mt-1 font-serif text-2xl font-semibold">{config.title}</h2></div><button disabled={busy} type="button" onClick={onClose} aria-label={t.common.close} className="grid size-8 place-items-center rounded-lg bg-[#f1f4f2] text-lg">×</button></div><form className="mt-6" onSubmit={submit}><label className="grid gap-2 text-[10px] font-bold text-[#526059]">{config.label}<textarea required minLength={config.min} maxLength={config.max} name={config.field} rows={3} placeholder={config.placeholder} className="resize-y rounded-xl border border-[#dce4e0] bg-[#fafbfa] p-3 text-xs font-medium outline-none focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100" /></label>{error ? <div role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] text-rose-700">{error}</div> : null}<div className="mt-5 flex justify-end gap-2"><button disabled={busy} type="button" onClick={onClose} className={secondaryButtonClass}>{t.common.cancel}</button><button disabled={busy} type="submit" className={primaryButtonClass}>{busy ? t.common.refreshing : t.common.save}</button></div></form></section></div>;
}

export function AdminDashboard() {
  const [locale, setLocale] = useState<Locale>("RU");
  const [section, setSection] = useState<Section>("overview");
  const [connection, setConnection] = useState<Connection | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogAction | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [lastFixtureResult, setLastFixtureResult] = useState<unknown>(null);
  const t = copy[locale];

  async function connect(next: Connection) {
    setConnecting(true); setError(null);
    try {
      const data = await loadSnapshot(next, locale);
      setConnection(next); setSnapshot(data); setNotice("API connected");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setConnecting(false); }
  }

  async function refresh(active = connection, nextLocale = locale) {
    if (!active) return false;
    setRefreshing(true); setError(null);
    try {
      setSnapshot(await loadSnapshot(active, nextLocale));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally { setRefreshing(false); }
  }

  function changeLocale(next: Locale) {
    setLocale(next);
    if (connection) void refresh(connection, next);
  }

  async function mutate(path: string, body: unknown, label: string, id: string) {
    if (!connection) return false;
    setBusyId(id); setDialogError(null); setError(null);
    try {
      await apiRequest(connection, path, { method: path.includes("/status") ? "PATCH" : "POST", body: JSON.stringify(body) });
      const refreshed = await refresh(connection, locale);
      if (!refreshed) return false;
      setNotice(label);
      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setDialogError(message); setError(message);
      return false;
    } finally { setBusyId(null); }
  }

  async function transitionOrder(order: OrderRecord, status: OrderStatus) {
    await mutate(`/admin/orders/${order.id}/status`, { status }, `${order.orderNumber} → ${humanStatus(status)}`, order.id);
  }

  async function submitDialog(values: Record<string, string>) {
    if (!dialog) return;
    let success = false;
    if (dialog.kind === "cash-collect") success = await mutate(`/admin/orders/${dialog.order.id}/cash/collect`, values, `${dialog.order.orderNumber}: cash collected`, dialog.order.id);
    if (dialog.kind === "cash-reconcile") success = await mutate(`/admin/orders/${dialog.order.id}/cash/reconcile`, values, `${dialog.order.orderNumber}: cash reconciled`, dialog.order.id);
    if (dialog.kind === "cash-refuse") success = await mutate(`/admin/orders/${dialog.order.id}/cash/refuse`, values, `${dialog.order.orderNumber}: customer refused`, dialog.order.id);
    if (dialog.kind === "proc-confirm") success = await mutate(`/admin/procurements/${dialog.task.id}/transition`, { status: "SUPPLIER_CONFIRMED", ...values }, `${dialog.task.orderNumber}: supplier confirmed`, dialog.task.id);
    if (dialog.kind === "proc-unavailable") success = await mutate(`/admin/procurements/${dialog.task.id}/transition`, { status: "SOURCE_UNAVAILABLE", ...values }, `${dialog.task.orderNumber}: source unavailable`, dialog.task.id);
    if (dialog.kind === "proc-cancel") success = await mutate(`/admin/procurements/${dialog.task.id}/transition`, { status: "CANCELLED", ...values }, `${dialog.task.orderNumber}: procurement cancelled`, dialog.task.id);
    if (dialog.kind === "crawler-resume") success = await mutate("/admin/crawler/resume", values, "Crawler kill switch reset", "crawler");
    if (success) setDialog(null);
  }

  async function parseFixture(fixture: "book-detail" | "book-price-conflict") {
    if (!connection) return;
    setBusyId("crawler"); setError(null);
    try {
      const result = await apiRequest<unknown>(connection, "/admin/crawler/parse-fixture", { method: "POST", body: JSON.stringify({ fixture }) });
      setLastFixtureResult(result);
      await refresh(connection, locale);
      setNotice(`${fixture}: parsed by server`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusyId(null); }
  }

  function disconnect() {
    setConnection(null); setSnapshot(null); setError(null); setNotice(null); setBusyId(null); setDialog(null); setLastFixtureResult(null);
  }

  if (!connection || !snapshot) return <ConnectScreen locale={locale} onLocale={setLocale} busy={connecting} error={error} onConnect={connect} />;

  return <div className="fixed inset-0 z-[100] flex overflow-hidden bg-[#f5f7f5] font-sans text-[#17201d] antialiased">
    <aside aria-label="Admin navigation" className="hidden h-full w-[78px] shrink-0 flex-col bg-gradient-to-b from-[#173c32] to-[#102d26] px-2.5 py-5 text-white md:flex xl:w-[248px] xl:px-4 xl:py-6"><div className="flex items-center justify-center gap-3 px-1 xl:justify-start xl:px-2"><span className="grid size-9 place-items-center rounded-[10px_10px_10px_3px] bg-[#f4be66] font-serif text-xl font-black text-[#173b31]">L</span><div className="hidden xl:block"><strong className="block font-serif text-xl tracking-wide">LUMI Books</strong><span className="text-[9px] uppercase tracking-wider text-white/40">operations</span></div></div><nav className="mt-7 flex flex-col gap-1">{navigation.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={section === item.id ? "page" : undefined} className={`relative flex items-center justify-center gap-3 rounded-xl px-2 py-3 text-left transition xl:justify-start xl:px-3 ${section === item.id ? "bg-white/10 text-white before:absolute before:-left-2.5 before:h-6 before:w-[3px] before:bg-[#f2bc63] xl:before:-left-4" : "text-white/60 hover:bg-white/[.07] hover:text-white"}`}><span aria-hidden="true" className="grid size-5 place-items-center text-base">{item.icon}</span><span className="hidden text-xs font-semibold xl:block">{t.nav[item.id]}</span>{item.id === "procurement" && snapshot.procurements.some((task) => task.status === "PENDING_OPERATOR") ? <i className="absolute right-2 size-2 rounded-full bg-amber-400 xl:ml-auto" aria-label="Pending tasks" /> : null}</button>)}</nav><div className="mt-auto border-t border-white/10 pt-4"><div className="hidden rounded-xl border border-white/10 bg-black/10 p-3 xl:block"><strong className="block truncate text-[10px]">{connection.baseUrl}</strong><span className="mt-1 block text-[9px] text-white/40">{snapshot.dashboard.persistence}</span></div></div></aside>
    <div className="relative flex min-w-0 flex-1 flex-col"><header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-[#e3e9e6] bg-white/95 px-3 backdrop-blur sm:px-6 lg:px-8"><div className="flex items-center gap-2 md:hidden"><span className="grid size-8 place-items-center rounded-[9px_9px_9px_3px] bg-[#f4be66] font-serif text-base font-black text-[#173b31]">L</span><strong className="font-serif text-lg">LUMI</strong></div><div className="hidden items-center gap-2 text-xs md:flex"><span className="text-[#99a29e]">Admin</span><i className="not-italic text-[#c2c9c6]">/</i><strong>{t.nav[section]}</strong></div><div className="flex items-center gap-2"><LocaleSwitch locale={locale} onChange={changeLocale} /><button disabled={refreshing} type="button" onClick={() => void refresh()} className="grid size-9 place-items-center rounded-xl border border-[#dfe7e1] bg-[#f8fbf9] text-sm text-[#4d5e57] sm:flex sm:w-auto sm:gap-2 sm:px-3 sm:text-[10px] sm:font-bold"><span className={refreshing ? "animate-spin" : ""}>↻</span><span className="hidden lg:inline">{refreshing ? t.common.refreshing : t.common.refresh}</span></button><button type="button" onClick={disconnect} className="hidden min-h-9 rounded-xl border border-[#e2e7e4] bg-white px-3 text-[9px] font-bold text-[#66736d] sm:block">{t.common.disconnect}</button></div></header>
      <nav aria-label="Admin sections" className="flex min-h-[52px] shrink-0 gap-1 overflow-x-auto border-b border-[#e3e9e6] bg-white px-2 py-1.5 md:hidden">{navigation.map((item) => <button type="button" key={item.id} onClick={() => setSection(item.id)} className={`flex min-w-max items-center gap-1.5 rounded-lg px-3 text-[9px] font-bold ${section === item.id ? "bg-[#183d33] text-white" : "text-[#7b8882]"}`}><span aria-hidden="true">{item.icon}</span>{t.nav[item.id]}</button>)}</nav>
      {error ? <div role="alert" className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[10px] text-rose-700 sm:mx-6 lg:mx-8"><span><strong>{t.common.error}:</strong> {error}</span><button type="button" onClick={() => void refresh()} className="shrink-0 font-bold underline">{t.common.retry}</button></div> : null}
      <main className="mx-auto w-full max-w-[1500px] flex-1 overflow-y-auto px-3 py-4 pb-20 sm:px-6 sm:py-6 lg:px-8">
        {refreshing && !snapshot ? <div className="grid min-h-[60vh] place-items-center"><p className="text-xs text-[#7c8983]">{t.common.loading}</p></div> : null}
        {section === "overview" ? <OverviewView snapshot={snapshot} locale={locale} busyId={busyId} onTransition={(order, status) => void transitionOrder(order, status)} onDialog={(action) => { setDialogError(null); setDialog(action); }} go={setSection} /> : null}
        {section === "orders" ? <OrdersView orders={snapshot.orders} locale={locale} busyId={busyId} onTransition={(order, status) => void transitionOrder(order, status)} onDialog={(action) => { setDialogError(null); setDialog(action); }} /> : null}
        {section === "catalog" ? <CatalogView catalog={snapshot.catalog} locale={locale} /> : null}
        {section === "procurement" ? <ProcurementView tasks={snapshot.procurements} locale={locale} busyId={busyId} onDialog={(action) => { setDialogError(null); setDialog(action); }} /> : null}
        {section === "crawler" ? <CrawlerView crawler={snapshot.crawler} locale={locale} busy={busyId === "crawler"} lastResult={lastFixtureResult} onParse={(fixture) => void parseFixture(fixture)} onDialog={(action) => { setDialogError(null); setDialog(action); }} /> : null}
      </main>
      {notice ? <div role="status" aria-live="polite" className="pointer-events-none absolute bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl bg-[#1a352d]/95 px-4 py-3 text-[10px] text-white shadow-xl"><span className="grid size-5 place-items-center rounded-full bg-emerald-300 font-black text-[#204a3d]">✓</span>{notice}</div> : null}
    </div>
    {dialog ? <ActionDialogView action={dialog} locale={locale} busy={busyId !== null} error={dialogError} onClose={() => { if (!busyId) setDialog(null); }} onSubmit={submitDialog} /> : null}
  </div>;
}
