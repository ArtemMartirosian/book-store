"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  adminRequestTimeoutMs,
  isAuthorizationStatus,
  isOrderCancellable,
  procurementActionVisibility,
  normalizeAdminApiBase,
  normalizeReceiptNumber,
  requestHeaders,
} from "./admin-client.mjs";

type Locale = "HY" | "RU" | "EN";
type Section = "overview" | "orders" | "catalog" | "categories" | "procurement" | "crawler";
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
  browserRun: {
    status: "IDLE" | "RUNNING" | "STOPPING" | "COMPLETED" | "PAUSED" | "STOPPED" | "FAILED";
    startedAt: string | null;
    completedAt: string | null;
    currentUrl: string | null;
    resumeCatalogUrl: string | null;
    catalogPagesVisited: number;
    discoveredProducts: number;
    productsAttempted: number;
    imported: number;
    quarantined: number;
    failedProducts: number;
    navigationRetries: number;
    productsSkipped: number;
    catalogSegmentsDiscovered: number;
    catalogSegmentsCompleted: number;
    activeCatalogSegment: string | null;
    finishReason: string | null;
    errors: Array<{ sourceUrl: string; code: string }>;
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

type AdminBookAttribute = { code: string | null; label: string; value: string };
type AdminBookDetailSection = {
  code: string | null;
  title: string;
  content: string;
  attributes: AdminBookAttribute[];
};
type AdminBookLocalization = {
  id: string;
  locale: "hy" | "ru" | "en";
  parserVersion: string;
  manualEdited: boolean;
  title: string;
  author: string;
  description: string;
  languageLabel: string | null;
  isbn: string | null;
  publisher: string | null;
  productCode: string;
  weight: string | null;
  barcode: string | null;
  isNew: boolean | null;
  pageCount: number | null;
  coverType: string | null;
  dimensions: string | null;
  publicationYear: number | null;
  series: string | null;
  imageUrls: string[];
  attributes: AdminBookAttribute[];
  detailSections: AdminBookDetailSection[];
  sourceUrl: string;
  observedAt: string;
};
type AdminCatalogBookDetail = {
  id: string;
  supplierSku: string;
  slug: string;
  language: "hy" | "ru" | "en";
  locale: "hy" | "ru" | "en";
  sourcePriceAmd: number;
  availability: "PRELIMINARY_AVAILABLE" | "OUT_OF_STOCK";
  sourceUrl: string;
  manualEdited: boolean;
  createdAt: string;
  updatedAt: string;
  localizations: AdminBookLocalization[];
  categoryIds: string[];
  categoryOptions: Array<{
    id: string;
    supplierCategoryId: string;
    parentId: string | null;
    translations: Array<{ locale: "hy" | "ru" | "en"; name: string }>;
  }>;
};
type AdminCatalogListBook = {
  id: string;
  supplierSku: string;
  slug: string;
  title: string;
  author: string;
  productCode: string | null;
  sourcePriceAmd: number;
  availability: "PRELIMINARY_AVAILABLE" | "OUT_OF_STOCK";
  coverImageUrl: string | null;
  manualEdited: boolean;
  updatedAt: string;
  availableLocales: string[];
};
type AdminCatalogListResponse = {
  items: AdminCatalogListBook[];
  total: number;
  offset: number;
  limit: number;
};

type AdminCategoryTranslation = {
  id: string;
  locale: "hy" | "ru" | "en";
  name: string;
  sourceUrl: string;
  manualEdited: boolean;
  observedAt: string;
};
type AdminCategory = {
  id: string;
  supplierCategoryId: string;
  parentId: string | null;
  parent: { id: string; supplierCategoryId: string } | null;
  position: number;
  manualEdited: boolean;
  observedAt: string;
  updatedAt: string;
  translations: AdminCategoryTranslation[];
  _count: { books: number; children: number };
};
type AdminCategoryDetail = AdminCategory & {
  parentOptions: Array<{
    id: string;
    supplierCategoryId: string;
    parentId: string | null;
    translations: Array<{ locale: "hy" | "ru" | "en"; name: string }>;
  }>;
};
type AdminCategoriesResponse = {
  items: AdminCategory[];
  total: number;
  offset: number;
  limit: number;
};

type Snapshot = {
  dashboard: DashboardData;
  orders: OrderRecord[];
  procurements: ProcurementTask[];
  crawler: CrawlerStatus;
  catalog: { items: CatalogBook[]; total: number };
};

type Connection = { baseUrl: string; username: string; password: string };
type DialogAction =
  | { kind: "order-cancel"; order: OrderRecord }
  | { kind: "cash-collect"; order: OrderRecord }
  | { kind: "cash-reconcile"; order: OrderRecord }
  | { kind: "cash-refuse"; order: OrderRecord }
  | { kind: "proc-confirm"; task: ProcurementTask }
  | { kind: "proc-unavailable"; task: ProcurementTask }
  | { kind: "proc-cancel"; task: ProcurementTask }
  | { kind: "crawler-resume" };

const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL?.trim() || "/api/v1").replace(/\/$/u, "");
const defaultApiBase = /^\/(?!\/)/u.test(configuredApiBase) ? configuredApiBase : "/api/v1";
const noticeLifetimeMs = 4_500;

const crawlerRunCopy = {
  RU: { run: "Запустить парсинг", running: "Парсинг выполняется…", result: "Прогресс серверного парсинга", started: "Парсинг запущен на сервере" },
  HY: { run: "Սկսել վերլուծումը", running: "Վերլուծվում է…", result: "Սերվերային վերլուծման ընթացքը", started: "Վերլուծումը մեկնարկեց սերվերում" },
  EN: { run: "Run parsing", running: "Parsing…", result: "Server parsing progress", started: "Parsing started on the server" },
} as const;

const catalogEditorCopy = {
  RU: {
    description: "Находите любую книгу и редактируйте общие данные или отдельные версии HY, RU и EN.",
    edit: "Редактировать",
    edited: "Ручная правка",
    automatic: "Данные парсера",
    previous: "Назад",
    next: "Дальше",
    editor: "Редактор книги",
    general: "Общие настройки",
    localization: "Локализованные данные",
    categories: "Категории Books.am",
    immutable: "Системные поля доступны только для чтения",
    slug: "Адрес (slug)",
    sourcePrice: "Цена поставщика, ֏",
    language: "Язык книги",
    availability: "Наличие",
    protect: "Защитить ручные изменения от парсера",
    protectHint: "Если включено, следующий парсинг не перезапишет эту книгу.",
    title: "Название",
    author: "Автор",
    descriptionField: "Описание",
    languageLabel: "Язык — текст источника",
    productCode: "Код товара",
    publisher: "Издательство",
    isbn: "ISBN",
    weight: "Вес",
    barcode: "Штрихкод",
    newness: "Новинка",
    unknown: "Не указано",
    yes: "Да",
    no: "Нет",
    pages: "Страницы",
    year: "Год издания",
    cover: "Обложка",
    dimensions: "Формат / размер",
    series: "Серия",
    images: "Изображения — один URL на строку",
    attributes: "Характеристики — JSON",
    sections: "Нижние разделы — JSON",
    save: "Сохранить книгу",
    saved: "Книга сохранена",
    invalidJson: "Проверьте JSON характеристик и нижних разделов.",
    loading: "Загружаем книгу…",
    close: "Закрыть",
    sourceUrl: "URL источника",
    sku: "SKU поставщика",
    parserVersion: "Версия данных",
    refresh: "Обновить из Books.am",
    refreshing: "Обновляем…",
    refreshConfirm: "Заново загрузить все данные этой книги на HY, RU и EN? Ручные изменения будут заменены данными Books.am.",
    refreshed: "Книга обновлена из Books.am",
  },
  HY: {
    description: "Գտեք ցանկացած գիրք և խմբագրեք ընդհանուր տվյալները կամ HY, RU և EN տարբերակները։",
    edit: "Խմբագրել",
    edited: "Ձեռքով խմբագրված",
    automatic: "Փարսերի տվյալներ",
    previous: "Նախորդ",
    next: "Հաջորդ",
    editor: "Գրքի խմբագիր",
    general: "Ընդհանուր կարգավորումներ",
    localization: "Տեղայնացված տվյալներ",
    categories: "Books.am-ի բաժիններ",
    immutable: "Համակարգային դաշտերը միայն ընթերցման համար են",
    slug: "Հասցե (slug)",
    sourcePrice: "Մատակարարի գին, ֏",
    language: "Գրքի լեզու",
    availability: "Առկայություն",
    protect: "Պաշտպանել ձեռքով փոփոխությունները փարսերից",
    protectHint: "Միացված լինելու դեպքում հաջորդ փարսինգը չի վերագրի գիրքը։",
    title: "Վերնագիր",
    author: "Հեղինակ",
    descriptionField: "Նկարագրություն",
    languageLabel: "Լեզու՝ աղբյուրի տեքստ",
    productCode: "Ապրանքի կոդ",
    publisher: "Հրատարակիչ",
    isbn: "ISBN",
    weight: "Քաշ",
    barcode: "Բարկոդ",
    newness: "Նորույթ",
    unknown: "Նշված չէ",
    yes: "Այո",
    no: "Ոչ",
    pages: "Էջեր",
    year: "Հրատարակման տարի",
    cover: "Կազմ",
    dimensions: "Չափս",
    series: "Շարք",
    images: "Նկարներ՝ մեկ URL յուրաքանչյուր տողում",
    attributes: "Բնութագրեր՝ JSON",
    sections: "Ստորին բաժիններ՝ JSON",
    save: "Պահպանել գիրքը",
    saved: "Գիրքը պահպանված է",
    invalidJson: "Ստուգեք բնութագրերի և բաժինների JSON-ը։",
    loading: "Գիրքը բեռնվում է…",
    close: "Փակել",
    sourceUrl: "Աղբյուրի URL",
    sku: "Մատակարարի SKU",
    parserVersion: "Տվյալների տարբերակ",
    refresh: "Թարմացնել Books.am-ից",
    refreshing: "Թարմացվում է…",
    refreshConfirm: "Նորից բեռնե՞լ գրքի բոլոր HY, RU և EN տվյալները։ Ձեռքով փոփոխությունները կփոխարինվեն Books.am-ի տվյալներով։",
    refreshed: "Գիրքը թարմացվել է Books.am-ից",
  },
  EN: {
    description: "Find any book and edit its general data or the individual HY, RU and EN versions.",
    edit: "Edit",
    edited: "Manually edited",
    automatic: "Crawler data",
    previous: "Previous",
    next: "Next",
    editor: "Book editor",
    general: "General settings",
    localization: "Localized data",
    categories: "Books.am categories",
    immutable: "System fields are read-only",
    slug: "Address (slug)",
    sourcePrice: "Supplier price, AMD",
    language: "Book language",
    availability: "Availability",
    protect: "Protect manual changes from the crawler",
    protectHint: "When enabled, future parsing will not overwrite this book.",
    title: "Title",
    author: "Author",
    descriptionField: "Description",
    languageLabel: "Language — source text",
    productCode: "Product code",
    publisher: "Publisher",
    isbn: "ISBN",
    weight: "Weight",
    barcode: "Barcode",
    newness: "New",
    unknown: "Not specified",
    yes: "Yes",
    no: "No",
    pages: "Pages",
    year: "Publication year",
    cover: "Cover",
    dimensions: "Format / dimensions",
    series: "Series",
    images: "Images — one URL per line",
    attributes: "Attributes — JSON",
    sections: "Bottom sections — JSON",
    save: "Save book",
    saved: "Book saved",
    invalidJson: "Check the attributes and detail sections JSON.",
    loading: "Loading book…",
    close: "Close",
    sourceUrl: "Source URL",
    sku: "Supplier SKU",
    parserVersion: "Data version",
    refresh: "Refresh from Books.am",
    refreshing: "Refreshing…",
    refreshConfirm: "Reload all HY, RU and EN data for this book? Manual changes will be replaced with Books.am data.",
    refreshed: "Book refreshed from Books.am",
  },
} as const;

const categoryEditorCopy = {
  RU: {
    eyebrow: "Структура каталога",
    description: "Редактируйте дерево и названия категорий отдельно на HY, RU и EN.",
    search: "Название или ID категории",
    category: "Категория",
    parent: "Родитель",
    position: "Порядок",
    books: "Книг",
    children: "Подкатегорий",
    edit: "Редактировать",
    editor: "Редактор категории",
    root: "Без родителя — корневая",
    protect: "Защитить ручные изменения от парсера",
    protectHint: "Парсер продолжит отмечать категорию как найденную, но не заменит её структуру и названия.",
    save: "Сохранить категорию",
    loading: "Загружаем категорию…",
    automatic: "Данные парсера",
    manual: "Ручная правка",
    previous: "Назад",
    next: "Дальше",
  },
  HY: {
    eyebrow: "Կատալոգի կառուցվածք",
    description: "Խմբագրեք բաժինների ծառը և HY, RU ու EN անվանումները։",
    search: "Բաժնի անուն կամ ID",
    category: "Բաժին",
    parent: "Ծնող բաժին",
    position: "Հերթականություն",
    books: "Գիրք",
    children: "Ենթաբաժին",
    edit: "Խմբագրել",
    editor: "Բաժնի խմբագիր",
    root: "Առանց ծնողի՝ արմատային",
    protect: "Պաշտպանել ձեռքով փոփոխությունները փարսերից",
    protectHint: "Փարսերը կշարունակի տեսնել բաժինը, բայց չի փոխարինի կառուցվածքն ու անունները։",
    save: "Պահպանել բաժինը",
    loading: "Բեռնվում է բաժինը…",
    automatic: "Փարսերի տվյալներ",
    manual: "Ձեռքով խմբագրված",
    previous: "Նախորդ",
    next: "Հաջորդ",
  },
  EN: {
    eyebrow: "Catalog structure",
    description: "Edit the category tree and its HY, RU and EN names.",
    search: "Category name or ID",
    category: "Category",
    parent: "Parent",
    position: "Position",
    books: "Books",
    children: "Children",
    edit: "Edit",
    editor: "Category editor",
    root: "No parent — root category",
    protect: "Protect manual changes from the crawler",
    protectHint: "The crawler will still observe the category but will not replace its tree position or names.",
    save: "Save category",
    loading: "Loading category…",
    automatic: "Crawler data",
    manual: "Manual edit",
    previous: "Previous",
    next: "Next",
  },
} as const;

const navigation: Array<{ id: Section; icon: string }> = [
  { id: "overview", icon: "⌂" },
  { id: "orders", icon: "▤" },
  { id: "catalog", icon: "▦" },
  { id: "categories", icon: "◫" },
  { id: "procurement", icon: "↗" },
  { id: "crawler", icon: "◎" },
];

const copy = {
  RU: {
    nav: { overview: "Обзор", orders: "Заказы", catalog: "Каталог", categories: "Категории", procurement: "Закупки", crawler: "Парсер" },
    connect: { eyebrow: "Защищённый вход", title: "Операционный центр", text: "Войдите в админку по логину и паролю. Данные входа хранятся только в памяти этой вкладки и исчезнут после перезагрузки.", base: "Адрес API", login: "Логин", password: "Пароль", button: "Войти", connecting: "Проверяем доступ…", security: "Логин и пароль не записываются в localStorage или sessionStorage.", invalid: "Используйте только безопасный адрес этого сайта: /api/v1." },
    common: { refresh: "Обновить", refreshing: "Обновляем…", retry: "Повторить", disconnect: "Отключиться", loading: "Загружаем операционные данные…", empty: "Здесь пока нет данных", error: "Не удалось выполнить запрос", cancel: "Отмена", confirm: "Подтвердить", save: "Выполнить", close: "Закрыть" },
    action: { next: "Следующий этап", cancel: "Отменить заказ", collect: "Принять наличные", reconcile: "Сверить кассу", refuse: "Отказ клиента", procConfirm: "Подтвердить закупку", unavailable: "Нет у поставщика", procCancel: "Отменить закупку", parse: "Проверить fixture", resume: "Снять kill switch", openSupplier: "Открыть разрешённую карточку поставщика" },
    kpi: { sales: "Сумма заказов", margin: "Прогнозная маржа", active: "Активные заявки", procurement: "Ждут закупки" },
  },
  HY: {
    nav: { overview: "Ամփոփում", orders: "Պատվերներ", catalog: "Կատալոգ", categories: "Բաժիններ", procurement: "Գնումներ", crawler: "Փարսեր" },
    connect: { eyebrow: "Պաշտպանված մուտք", title: "Գործառնական կենտրոն", text: "Մուտք գործեք ադմինիստրատորի անունով և գաղտնաբառով։ Տվյալները պահվում են միայն այս ներդիրի հիշողության մեջ։", base: "API հասցե", login: "Մուտքանուն", password: "Գաղտնաբառ", button: "Մուտք գործել", connecting: "Ստուգում ենք մուտքը…", security: "Մուտքանունը և գաղտնաբառը չեն պահվում localStorage-ում կամ sessionStorage-ում։", invalid: "Օգտագործեք միայն այս կայքի անվտանգ հասցեն՝ /api/v1։" },
    common: { refresh: "Թարմացնել", refreshing: "Թարմացվում է…", retry: "Կրկնել", disconnect: "Անջատել", loading: "Բեռնում ենք գործառնական տվյալները…", empty: "Տվյալներ դեռ չկան", error: "Հարցումը չհաջողվեց", cancel: "Չեղարկել", confirm: "Հաստատել", save: "Կատարել", close: "Փակել" },
    action: { next: "Հաջորդ փուլ", cancel: "Չեղարկել պատվերը", collect: "Ընդունել կանխիկը", reconcile: "Համադրել դրամարկղը", refuse: "Հաճախորդի մերժում", procConfirm: "Հաստատել գնումը", unavailable: "Չկա մատակարարի մոտ", procCancel: "Չեղարկել գնումը", parse: "Ստուգել fixture-ը", resume: "Անջատել kill switch-ը", openSupplier: "Բացել մատակարարի թույլատրված քարտը" },
    kpi: { sales: "Պատվերների գումար", margin: "Կանխատեսվող մարժա", active: "Ակտիվ հայտեր", procurement: "Սպասում են գնման" },
  },
  EN: {
    nav: { overview: "Overview", orders: "Orders", catalog: "Catalog", categories: "Categories", procurement: "Procurement", crawler: "Crawler" },
    connect: { eyebrow: "Secure sign in", title: "Operations center", text: "Sign in to the admin area with your username and password. Credentials remain only in this tab’s memory.", base: "API base URL", login: "Username", password: "Password", button: "Sign in", connecting: "Checking access…", security: "The username and password are never written to localStorage or sessionStorage.", invalid: "Use only this site’s safe /api/v1 address." },
    common: { refresh: "Refresh", refreshing: "Refreshing…", retry: "Retry", disconnect: "Disconnect", loading: "Loading operational data…", empty: "No data here yet", error: "The request failed", cancel: "Cancel", confirm: "Confirm", save: "Run action", close: "Close" },
    action: { next: "Next stage", cancel: "Cancel order", collect: "Collect cash", reconcile: "Reconcile cash", refuse: "Customer refusal", procConfirm: "Confirm procurement", unavailable: "Supplier unavailable", procCancel: "Cancel procurement", parse: "Parse fixture", resume: "Reset kill switch", openSupplier: "Open permitted supplier page" },
    kpi: { sales: "Order value", margin: "Projected margin", active: "Active requests", procurement: "Awaiting procurement" },
  },
} as const;

const adminUi = {
  RU: {
    interfaceLanguage: "Язык интерфейса",
    apiConnected: "API подключён",
    sessionExpired: "Доступ завершён. Введите актуальный логин и пароль.",
    requestTimeout: "Сервер не ответил за 10 секунд. Попробуйте ещё раз.",
    mutationTimeout: "Сервер не ответил вовремя. Результат операции неизвестен — сначала обновите данные.",
    invalidResponse: "API вернул данные неизвестного формата.",
    refreshAfterSuccess: "Команда выполнена, но свежие данные не загрузились. Нажмите «Обновить».",
    serverCommand: "Команда серверу",
    cancelOrderTitle: "Подтвердите отмену заказа",
    cancelOrderText: "Заказ и связанная с ним закупка будут отменены. Это действие нельзя выполнять случайным кликом.",
    receiptLabel: "Номер фискального чека",
    receiptPlaceholder: "e-HDM-12345",
    receiptInvalid: "Используйте 3–100 букв или цифр; разрешены символы . _ / - без пробелов.",
    reconciliationLabel: "Ссылка сверки",
    reconciliationPlaceholder: "cash-report-2026-001",
    reasonLabel: "Причина",
    refusalPlaceholder: "Зафиксируйте причину отказа клиента",
    supplierReferenceLabel: "Ссылка поставщика",
    supplierReferencePlaceholder: "Номер ручного заказа Books.am",
    operatorNoteLabel: "Комментарий оператора",
    unavailablePlaceholder: "Почему товар нельзя закупить",
    procurementCancelPlaceholder: "Почему закупка отменена",
    resumeReasonLabel: "Причина снятия блокировки",
    resumeReasonPlaceholder: "Опишите причину снятия kill switch",
  },
  HY: {
    interfaceLanguage: "Ինտերֆեյսի լեզու",
    apiConnected: "API-ն միացված է",
    sessionExpired: "Մուտքն ավարտվել է։ Մուտքագրեք գործող մուտքանունը և գաղտնաբառը։",
    requestTimeout: "Սերվերը 10 վայրկյանում չպատասխանեց։ Փորձեք կրկին։",
    mutationTimeout: "Սերվերը ժամանակին չպատասխանեց։ Գործողության արդյունքն անհայտ է․ նախ թարմացրեք տվյալները։",
    invalidResponse: "API-ն վերադարձրել է անհայտ ձևաչափի տվյալներ։",
    refreshAfterSuccess: "Հրամանը կատարվել է, բայց նոր տվյալները չեն բեռնվել։ Սեղմեք «Թարմացնել»։",
    serverCommand: "Սերվերի հրաման",
    cancelOrderTitle: "Հաստատեք պատվերի չեղարկումը",
    cancelOrderText: "Պատվերը և դրա հետ կապված գնումը կչեղարկվեն։ Այս գործողությունը չպետք է կատարվի պատահական սեղմումով։",
    receiptLabel: "Ֆիսկալ կտրոնի համար",
    receiptPlaceholder: "e-HDM-12345",
    receiptInvalid: "Օգտագործեք 3–100 տառ կամ թիվ․ թույլատրվում են . _ / - նշանները՝ առանց բացատների։",
    reconciliationLabel: "Համադրման հղում",
    reconciliationPlaceholder: "cash-report-2026-001",
    reasonLabel: "Պատճառ",
    refusalPlaceholder: "Նշեք հաճախորդի մերժման պատճառը",
    supplierReferenceLabel: "Մատակարարի հղում",
    supplierReferencePlaceholder: "Books.am ձեռքով պատվերի համարը",
    operatorNoteLabel: "Օպերատորի նշում",
    unavailablePlaceholder: "Ինչու ապրանքը հնարավոր չէ գնել",
    procurementCancelPlaceholder: "Ինչու գնումը չեղարկվեց",
    resumeReasonLabel: "Արգելափակումը հանելու պատճառ",
    resumeReasonPlaceholder: "Նկարագրեք kill switch-ը հանելու պատճառը",
  },
  EN: {
    interfaceLanguage: "Interface language",
    apiConnected: "API connected",
    sessionExpired: "Access expired. Enter the current username and password.",
    requestTimeout: "The server did not respond within 10 seconds. Try again.",
    mutationTimeout: "The server timed out. The operation result is unknown—refresh data before retrying.",
    invalidResponse: "The API returned data in an unknown format.",
    refreshAfterSuccess: "The command succeeded, but fresh data could not be loaded. Select Refresh.",
    serverCommand: "Server command",
    cancelOrderTitle: "Confirm order cancellation",
    cancelOrderText: "The order and its linked procurement will be cancelled. This must not happen on an accidental click.",
    receiptLabel: "Fiscal receipt number",
    receiptPlaceholder: "e-HDM-12345",
    receiptInvalid: "Use 3–100 letters or digits; . _ / - are allowed, without spaces.",
    reconciliationLabel: "Reconciliation reference",
    reconciliationPlaceholder: "cash-report-2026-001",
    reasonLabel: "Reason",
    refusalPlaceholder: "Document the customer refusal",
    supplierReferenceLabel: "Supplier reference",
    supplierReferencePlaceholder: "Manual Books.am order number",
    operatorNoteLabel: "Operator note",
    unavailablePlaceholder: "Why the item cannot be purchased",
    procurementCancelPlaceholder: "Why the procurement was cancelled",
    resumeReasonLabel: "Reset reason",
    resumeReasonPlaceholder: "Explain why the kill switch is being reset",
  },
} as const;

const adminView = {
  RU: {
    connected: "API подключён",
    killEngaged: "Аварийная блокировка включена",
    networkAvailable: "сетевой модуль доступен",
    fixtureOnly: "только fixture, без live-запросов",
    fixtureMode: "ТОЛЬКО FIXTURE",
    gatedMode: "ДОСТУП ПО РАЗРЕШЕНИЮ",
    inMemory: "Данные в памяти",
    records: "записей",
    serverComputed: "рассчитано сервером",
    nonTerminal: "активные статусы",
    operatorQueue: "очередь оператора",
    liveApi: "Данные API",
    ordersEyebrow: "Nest Admin API",
    ordersDescription: "Авторитетные данные сервера, закупки и контроль оплаты при получении.",
    searchOrders: "Поиск заказов",
    orderPlaceholder: "Заказ, клиент или телефон",
    order: "Заказ",
    customer: "Клиент",
    total: "Сумма",
    orderStatus: "Статус заказа",
    actions: "Действия",
    items: "тов.",
    margin: "маржа",
    catalogEyebrow: "Локальный API каталога",
    catalogDescription: "Показываются данные локального API. Полный серверный парсинг Books.am запускается в разделе «Парсер».",
    searchCatalog: "Поиск по каталогу",
    catalogPlaceholder: "Название, автор или ISBN",
    book: "Книга",
    price: "Цена",
    locale: "Локаль",
    availability: "Наличие",
    observed: "Проверено",
    noIsbn: "без ISBN",
    procurementEyebrow: "Ручная B2B-очередь",
    procurementDescription: "Фиксируются только подтверждённые оператором результаты. Страницы Books.am открываются исключительно для ручной проверки.",
    quotePending: "сумма не подтверждена",
    reference: "ссылка",
    crawlerEyebrow: "Контроль безопасности",
    crawlerDescription: "Кнопка запускает Playwright на сервере: каждая книга обходится на армянском, русском и английском, включая изображения, характеристики и нижние разделы.",
    mode: "Режим",
    networkFetcher: "Сетевой модуль",
    dailyBudget: "Дневной лимит",
    killSwitch: "Аварийная блокировка",
    serverReported: "сообщено сервером",
    liveGateOpen: "live-доступ открыт",
    liveGateClosed: "live-доступ закрыт",
    permissionRecorded: "разрешение зафиксировано",
    permissionAbsent: "разрешение отсутствует",
    noIncident: "инцидентов нет",
    available: "ДОСТУПЕН",
    off: "ВЫКЛЮЧЕН",
    engaged: "ВКЛЮЧЕНА",
    ready: "ГОТОВ",
    bundledHtml: "Встроенный HTML",
    contractFixtures: "Контрактные fixture",
    runtimeGuard: "Защита runtime",
    reason: "Причина",
    engagedAt: "Включена",
    crawlerNotice: "Live-парсинг работает только при серверном разрешении и дневном лимите. При 403, 429 или защитной странице аварийная блокировка останавливает обход.",
    pendingTasks: "Есть задачи в ожидании",
    status: {
      REQUEST_RECEIVED: "заявка получена",
      CUSTOMER_CONFIRMED: "клиент подтвердил",
      PROCUREMENT_PENDING: "ожидает закупки",
      SUPPLIER_CONFIRMED: "поставщик подтвердил",
      READY_FOR_DELIVERY: "готов к доставке",
      OUT_FOR_DELIVERY: "доставляется",
      DELIVERED: "доставлен",
      CUSTOMER_REFUSED: "отказ клиента",
      CANCELLED: "отменён",
      CASH_DUE: "ожидается оплата",
      CASH_COLLECTED: "наличные приняты",
      CASH_RECONCILED: "касса сверена",
      CASH_REFUSED: "отказ от оплаты",
      PENDING_OPERATOR: "ожидает оператора",
      SOURCE_UNAVAILABLE: "нет у поставщика",
      PRELIMINARY_AVAILABLE: "предварительно доступна",
      OUT_OF_STOCK: "нет в наличии",
    },
  },
  HY: {
    connected: "API-ն միացված է",
    killEngaged: "Վթարային արգելափակումը միացված է",
    networkAvailable: "ցանցային մոդուլը հասանելի է",
    fixtureOnly: "միայն fixture՝ առանց live հարցումների",
    fixtureMode: "ՄԻԱՅՆ FIXTURE",
    gatedMode: "ԹՈՒՅԼՏՎՈՒԹՅԱՄԲ ՄՈՒՏՔ",
    inMemory: "Տվյալները հիշողության մեջ",
    records: "գրանցում",
    serverComputed: "հաշվարկված է սերվերում",
    nonTerminal: "ակտիվ կարգավիճակներ",
    operatorQueue: "օպերատորի հերթ",
    liveApi: "API տվյալներ",
    ordersEyebrow: "Nest Admin API",
    ordersDescription: "Սերվերի հիմնական տվյալներ, գնումներ և առաքման պահին վճարման կառավարում։",
    searchOrders: "Որոնել պատվերներ",
    orderPlaceholder: "Պատվեր, հաճախորդ կամ հեռախոս",
    order: "Պատվեր",
    customer: "Հաճախորդ",
    total: "Գումար",
    orderStatus: "Պատվերի կարգավիճակ",
    actions: "Գործողություններ",
    items: "ապր.",
    margin: "մարժա",
    catalogEyebrow: "Կատալոգի տեղական API",
    catalogDescription: "Ցուցադրվում են տեղական API-ի տվյալները։ Books.am-ի ամբողջական սերվերային փարսինգը գործարկվում է «Փարսեր» բաժնում։",
    searchCatalog: "Որոնել կատալոգում",
    catalogPlaceholder: "Վերնագիր, հեղինակ կամ ISBN",
    book: "Գիրք",
    price: "Գին",
    locale: "Լոկալ",
    availability: "Առկայություն",
    observed: "Ստուգված",
    noIsbn: "առանց ISBN",
    procurementEyebrow: "Ձեռքով B2B հերթ",
    procurementDescription: "Պահվում են միայն օպերատորի հաստատած արդյունքները։ Books.am էջերը բացվում են միայն ձեռքով ստուգման համար։",
    quotePending: "գումարը հաստատված չէ",
    reference: "հղում",
    crawlerEyebrow: "Անվտանգության կառավարում",
    crawlerDescription: "Կոճակը գործարկում է Playwright-ը սերվերում․ յուրաքանչյուր գիրք մշակվում է հայերեն, ռուսերեն և անգլերեն՝ նկարներով, բնութագրերով և բոլոր բաժիններով։",
    mode: "Ռեժիմ",
    networkFetcher: "Ցանցային մոդուլ",
    dailyBudget: "Օրական սահմանաչափ",
    killSwitch: "Վթարային արգելափակում",
    serverReported: "սերվերի տվյալ",
    liveGateOpen: "live մուտքը բաց է",
    liveGateClosed: "live մուտքը փակ է",
    permissionRecorded: "թույլտվությունը գրանցված է",
    permissionAbsent: "թույլտվությունը բացակայում է",
    noIncident: "միջադեպ չկա",
    available: "ՀԱՍԱՆԵԼԻ",
    off: "ԱՆՋԱՏՎԱԾ",
    engaged: "ՄԻԱՑՎԱԾ",
    ready: "ՊԱՏՐԱՍՏ",
    bundledHtml: "Ներկառուցված HTML",
    contractFixtures: "Պայմանագրային fixture-ներ",
    runtimeGuard: "Runtime պաշտպանություն",
    reason: "Պատճառ",
    engagedAt: "Միացված է",
    crawlerNotice: "Live փարսինգը աշխատում է միայն սերվերի թույլտվությամբ և օրական սահմանաչափով։ 403, 429 կամ պաշտպանական էջի դեպքում վթարային արգելափակումը կանգնեցնում է այն։",
    pendingTasks: "Կան սպասող առաջադրանքներ",
    status: {
      REQUEST_RECEIVED: "հայտը ստացվել է",
      CUSTOMER_CONFIRMED: "հաճախորդը հաստատել է",
      PROCUREMENT_PENDING: "սպասում է գնման",
      SUPPLIER_CONFIRMED: "մատակարարը հաստատել է",
      READY_FOR_DELIVERY: "պատրաստ է առաքման",
      OUT_FOR_DELIVERY: "առաքվում է",
      DELIVERED: "առաքված է",
      CUSTOMER_REFUSED: "հաճախորդի մերժում",
      CANCELLED: "չեղարկված է",
      CASH_DUE: "վճարումը սպասվում է",
      CASH_COLLECTED: "կանխիկը ստացվել է",
      CASH_RECONCILED: "դրամարկղը համադրված է",
      CASH_REFUSED: "վճարման մերժում",
      PENDING_OPERATOR: "սպասում է օպերատորին",
      SOURCE_UNAVAILABLE: "չկա մատակարարի մոտ",
      PRELIMINARY_AVAILABLE: "նախնական հասանելի",
      OUT_OF_STOCK: "առկա չէ",
    },
  },
  EN: {
    connected: "API connected",
    killEngaged: "Kill switch engaged",
    networkAvailable: "network fetcher available",
    fixtureOnly: "fixture-only, no live fetch",
    fixtureMode: "FIXTURE ONLY",
    gatedMode: "PERMISSION GATED",
    inMemory: "In-memory data",
    records: "records",
    serverComputed: "server-computed",
    nonTerminal: "non-terminal states",
    operatorQueue: "operator queue",
    liveApi: "API data",
    ordersEyebrow: "Nest Admin API",
    ordersDescription: "Server-authoritative state, procurement and cash-on-delivery controls.",
    searchOrders: "Search orders",
    orderPlaceholder: "Order, customer or phone",
    order: "Order",
    customer: "Customer",
    total: "Total",
    orderStatus: "Order status",
    actions: "Actions",
    items: "items",
    margin: "margin",
    catalogEyebrow: "Local catalog API",
    catalogDescription: "Local API data is displayed here. Start the full server-side Books.am crawl from the Crawler section.",
    searchCatalog: "Search catalog",
    catalogPlaceholder: "Title, author or ISBN",
    book: "Book",
    price: "Price",
    locale: "Locale",
    availability: "Availability",
    observed: "Observed",
    noIsbn: "no ISBN",
    procurementEyebrow: "Manual B2B queue",
    procurementDescription: "Only operator-confirmed outcomes are recorded. Books.am pages open solely for manual review.",
    quotePending: "quote not confirmed",
    reference: "reference",
    crawlerEyebrow: "Safety controls",
    crawlerDescription: "The button runs Playwright on the server and visits every book in Armenian, Russian and English, including images, attributes and all detail sections.",
    mode: "Mode",
    networkFetcher: "Network fetcher",
    dailyBudget: "Daily budget",
    killSwitch: "Kill switch",
    serverReported: "server-reported",
    liveGateOpen: "live gate open",
    liveGateClosed: "live gate closed",
    permissionRecorded: "permission recorded",
    permissionAbsent: "permission absent",
    noIncident: "no incident",
    available: "AVAILABLE",
    off: "OFF",
    engaged: "ENGAGED",
    ready: "READY",
    bundledHtml: "Bundled HTML",
    contractFixtures: "Contract fixtures",
    runtimeGuard: "Runtime guard",
    reason: "Reason",
    engagedAt: "Engaged",
    crawlerNotice: "Live crawling requires server permission and a daily budget. A 403, 429 or challenge page engages the kill switch and stops the run.",
    pendingTasks: "Pending tasks",
    status: {
      REQUEST_RECEIVED: "request received",
      CUSTOMER_CONFIRMED: "customer confirmed",
      PROCUREMENT_PENDING: "awaiting procurement",
      SUPPLIER_CONFIRMED: "supplier confirmed",
      READY_FOR_DELIVERY: "ready for delivery",
      OUT_FOR_DELIVERY: "out for delivery",
      DELIVERED: "delivered",
      CUSTOMER_REFUSED: "customer refused",
      CANCELLED: "cancelled",
      CASH_DUE: "cash due",
      CASH_COLLECTED: "cash collected",
      CASH_RECONCILED: "cash reconciled",
      CASH_REFUSED: "cash refused",
      PENDING_OPERATOR: "pending operator",
      SOURCE_UNAVAILABLE: "supplier unavailable",
      PRELIMINARY_AVAILABLE: "preliminary available",
      OUT_OF_STOCK: "out of stock",
    },
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
  return new Intl.NumberFormat("ru-RU").format(value) + " ֏";
}

const dateLocales: Record<Locale, string> = { RU: "ru-RU", HY: "hy-AM", EN: "en-US" };

function formatDate(value: string | null, locale: Locale) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(dateLocales[locale], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Yerevan" }).format(date);
}

function humanStatus(value: string) {
  return value.toLocaleLowerCase().replaceAll("_", " ");
}

function displayStatus(locale: Locale, value: string) {
  const labels = adminView[locale].status as Record<string, string>;
  return labels[value] ?? humanStatus(value);
}

type AdminApiErrorCode = "HTTP" | "TIMEOUT" | "NETWORK" | "INVALID_RESPONSE";

class AdminApiError extends Error {
  constructor(
    readonly code: AdminApiErrorCode,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSnapshotShape(snapshot: Snapshot) {
  const crawlerValid = isRecord(snapshot.crawler)
    && isRecord(snapshot.crawler.gate)
    && isRecord(snapshot.crawler.budget)
    && isRecord(snapshot.crawler.killSwitch)
    && isRecord(snapshot.crawler.browserRun);
  const dashboardValid = isRecord(snapshot.dashboard)
    && isRecord(snapshot.dashboard.ordersByStatus)
    && isRecord(snapshot.dashboard.procurementsByStatus)
    && isRecord(snapshot.dashboard.crawler);
  const ordersValid = Array.isArray(snapshot.orders) && snapshot.orders.every((order) =>
    isRecord(order) && isRecord(order.customer) && isRecord(order.delivery) && isRecord(order.cod) && Array.isArray(order.items),
  );
  const procurementsValid = Array.isArray(snapshot.procurements) && snapshot.procurements.every((task) =>
    isRecord(task) && Array.isArray(task.items),
  );
  const catalogValid = isRecord(snapshot.catalog)
    && Number.isSafeInteger(snapshot.catalog.total)
    && Array.isArray(snapshot.catalog.items)
    && snapshot.catalog.items.every((book) => isRecord(book) && isRecord(book.price));

  if (!crawlerValid || !dashboardValid || !ordersValid || !procurementsValid || !catalogValid) {
    throw new AdminApiError("INVALID_RESPONSE", "INVALID_RESPONSE");
  }
}

async function apiRequest<T>(
  connection: Connection,
  path: string,
  init?: RequestInit,
  timeoutMs = adminRequestTimeoutMs,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(connection.baseUrl + path, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...requestHeaders(path, connection, Boolean(init?.body)),
        ...init?.headers,
      },
    });
  } catch (cause) {
    clearTimeout(timeout);
    if (controller.signal.aborted) throw new AdminApiError("TIMEOUT", "REQUEST_TIMEOUT");
    throw new AdminApiError("NETWORK", cause instanceof Error ? cause.message : "NETWORK_ERROR");
  }

  if (!response.ok) {
    let detail = String(response.status) + " " + response.statusText;
    try {
      const body = await response.json() as { message?: string | string[]; code?: string };
      const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
      detail = [body.code, message].filter(Boolean).join(": ") || detail;
    } catch {
      if (controller.signal.aborted) {
        clearTimeout(timeout);
        throw new AdminApiError("TIMEOUT", "REQUEST_TIMEOUT");
      }
    }
    clearTimeout(timeout);
    throw new AdminApiError("HTTP", detail, response.status);
  }

  try {
    const result = await response.json() as T;
    clearTimeout(timeout);
    return result;
  } catch {
    clearTimeout(timeout);
    if (controller.signal.aborted) throw new AdminApiError("TIMEOUT", "REQUEST_TIMEOUT");
    throw new AdminApiError("INVALID_RESPONSE", "INVALID_RESPONSE");
  }
}

async function loadSnapshot(connection: Connection, locale: Locale): Promise<Snapshot> {
  const catalogLocale = locale.toLocaleLowerCase();
  const [dashboard, orders, procurements, crawler, catalog] = await Promise.all([
    apiRequest<DashboardData>(connection, "/admin/dashboard"),
    apiRequest<OrderRecord[]>(connection, "/admin/orders"),
    apiRequest<ProcurementTask[]>(connection, "/admin/procurements"),
    apiRequest<CrawlerStatus>(connection, "/admin/crawler/status"),
    apiRequest<{ items: CatalogBook[]; total: number }>(connection, "/catalog/books?locale=" + catalogLocale + "&limit=100"),
  ]);
  const snapshot = { dashboard, orders, procurements, crawler, catalog };
  assertSnapshotShape(snapshot);
  return snapshot;
}

function describeAdminError(cause: unknown, locale: Locale) {
  const ui = adminUi[locale];
  if (cause instanceof AdminApiError) {
    if (cause.code === "TIMEOUT") return ui.requestTimeout;
    if (cause.code === "INVALID_RESPONSE") return ui.invalidResponse;
    if (cause.status !== undefined && isAuthorizationStatus(cause.status)) return ui.sessionExpired;
  }
  return cause instanceof Error ? cause.message : String(cause);
}

function isAuthorizationError(cause: unknown) {
  return cause instanceof AdminApiError
    && cause.status !== undefined
    && isAuthorizationStatus(cause.status);
}

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`inline-flex min-h-6 items-center rounded-full border px-2.5 text-[9px] font-extrabold capitalize ${className}`}>{children}</span>;
}

function LocaleSwitch({ locale, onChange, disabled = false }: { locale: Locale; onChange: (locale: Locale) => void; disabled?: boolean }) {
  const label = adminUi[locale].interfaceLanguage;
  return <div className="flex rounded-lg border border-[#dfe6e2] bg-[#f8faf9] p-0.5" role="group" aria-label={label}>{(["HY", "RU", "EN"] as const).map((item) => <button disabled={disabled} type="button" key={item} aria-pressed={locale === item} onClick={() => onChange(item)} className={"rounded-md px-2 py-1 text-[9px] font-extrabold transition disabled:cursor-not-allowed disabled:opacity-50 " + (locale === item ? "bg-[#183d33] text-white shadow-sm" : "text-[#7d8984] hover:bg-white")}>{item}</button>)}</div>;
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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [validation, setValidation] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let normalized: string;
    try {
      normalized = normalizeAdminApiBase(baseUrl, window.location.origin, defaultApiBase);
    } catch {
      setValidation(t.connect.invalid);
      return;
    }
    setValidation(null);
    await onConnect({ baseUrl: normalized, username, password });
  }

  return (
    <div className="admin-modern fixed inset-0 z-[100] overflow-y-auto bg-[#f4f5fb] p-4 font-sans text-[#17182a] antialiased sm:p-8">
      <div aria-hidden="true" className="fixed inset-x-0 top-0 h-80 bg-gradient-to-br from-[#5a50e7] via-[#39327f] to-[#17182a]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[30px] border border-white/15 bg-white shadow-[0_34px_100px_rgba(30,28,78,0.22)] lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#6258ff] via-[#4a42bd] to-[#1b1c31] p-8 text-white sm:p-11">
            <div aria-hidden="true" className="absolute -right-20 -top-20 size-64 rounded-full border border-white/5 shadow-[0_0_0_40px_rgba(255,255,255,.02),0_0_0_80px_rgba(255,255,255,.012)]" />
            <div className="relative flex h-full min-h-[300px] flex-col">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-[11px_11px_11px_4px] bg-[#f4be66] font-serif text-xl font-black text-[#173b31]">L</span><strong className="font-serif text-xl tracking-wide">LUMI Books</strong></div>
              <div className="my-auto py-12"><p className="inline-flex rounded-full bg-[#d9ff69] px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.17em] text-[#17182a]">{t.connect.eyebrow}</p><h1 className="mt-5 text-4xl font-black tracking-[-.055em] sm:text-5xl">{t.connect.title}</h1><p className="mt-5 max-w-md text-xs leading-6 text-white/55">{t.connect.text}</p></div>
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-[10px] leading-5 text-white/55"><span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-300/10 text-emerald-200">✓</span>{t.connect.security}</div>
            </div>
          </div>
          <div className="flex flex-col justify-center p-7 sm:p-12">
            <div className="mb-8 flex items-center justify-between"><p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-[#8a9690]">NestJS Admin API</p><LocaleSwitch locale={locale} onChange={onLocale} disabled={busy} /></div>
            <form className="space-y-5" onSubmit={submit}>
              <label className="grid gap-2 text-[10px] font-bold text-[#526059]">{t.connect.base}<input required autoComplete="url" spellCheck={false} value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} className="h-12 rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-4 text-xs font-medium outline-none transition focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100" /></label>
              <label className="grid gap-2 text-[10px] font-bold text-[#526059]">{t.connect.login}<input required autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} className="h-12 rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-4 text-xs font-medium outline-none transition focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100" /></label>
              <label className="grid gap-2 text-[10px] font-bold text-[#526059]">{t.connect.password}<input required autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-4 text-xs font-medium outline-none transition focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100" /></label>
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
  const cancellable = isOrderCancellable(order.status);
  return <div className="flex flex-wrap justify-end gap-1.5">
    {next ? <button disabled={busy} type="button" onClick={() => onTransition(order, next)} className="min-h-8 rounded-lg bg-[#183d33] px-2.5 text-[9px] font-bold text-white disabled:opacity-50">{t.action.next}</button> : null}
    {order.status === "OUT_FOR_DELIVERY" && order.cod.status === "CASH_DUE" ? <><button disabled={busy} type="button" onClick={() => onDialog({ kind: "cash-collect", order })} className="min-h-8 rounded-lg bg-emerald-600 px-2.5 text-[9px] font-bold text-white">{t.action.collect}</button><button disabled={busy} type="button" onClick={() => onDialog({ kind: "cash-refuse", order })} className="min-h-8 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[9px] font-bold text-rose-700">{t.action.refuse}</button></> : null}
    {order.status === "OUT_FOR_DELIVERY" && order.cod.status === "CASH_COLLECTED" ? <button disabled={busy} type="button" onClick={() => onDialog({ kind: "cash-reconcile", order })} className="min-h-8 rounded-lg bg-indigo-600 px-2.5 text-[9px] font-bold text-white">{t.action.reconcile}</button> : null}
    {order.status === "OUT_FOR_DELIVERY" && order.cod.status === "CASH_RECONCILED" ? <button disabled={busy} type="button" onClick={() => onTransition(order, "DELIVERED")} className="min-h-8 rounded-lg bg-emerald-600 px-2.5 text-[9px] font-bold text-white">{displayStatus(locale, "DELIVERED")}</button> : null}
    {cancellable ? <button disabled={busy} type="button" onClick={() => onDialog({ kind: "order-cancel", order })} className="min-h-8 rounded-lg border border-[#dfe5e2] bg-white px-2.5 text-[9px] font-bold text-[#6d7a74]">{t.action.cancel}</button> : null}
  </div>;
}

function OrdersTable({ orders, locale, busyId, onTransition, onDialog, empty }: { orders: OrderRecord[]; locale: Locale; busyId: string | null; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void; empty: string }) {
  const v = adminView[locale];
  if (!orders.length) return <EmptyState text={empty} />;
  return <div className="w-full overflow-x-auto"><table className="w-full min-w-[930px] border-collapse whitespace-nowrap text-left"><thead className="bg-[#fafbfa] text-[9px] font-extrabold uppercase tracking-wider text-[#96a09b]"><tr><th className="border-b border-[#e8ecea] px-5 py-3">{v.order}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.customer}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.total}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.orderStatus}</th><th className="border-b border-[#e8ecea] px-4 py-3">COD</th><th className="border-b border-[#e8ecea] px-4 py-3"><span className="sr-only">{v.actions}</span></th></tr></thead><tbody className="text-[11px] text-[#4c5954]">{orders.map((order) => <tr key={order.id} className="align-middle transition hover:bg-[#fbfcfb]"><td className="border-b border-[#eef1ef] px-5 py-3"><strong className="block text-xs text-[#25322d]">{order.orderNumber}</strong><span className="mt-0.5 block text-[9px] text-[#9ba5a0]">{formatDate(order.createdAt, locale)} · {order.items.reduce((sum, item) => sum + item.quantity, 0)} {v.items}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><strong className="block text-[#2a3732]">{order.customer.fullName}</strong><span className="mt-0.5 block text-[9px] text-[#929e98]">{order.customer.phone} · {humanStatus(order.delivery.district)}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><strong className="text-[#26332e]">{formatAmd(order.totalAmd)}</strong><span className="mt-0.5 block text-[9px] text-emerald-700">{v.margin} {formatAmd(order.projectedMarginAmd)}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><Pill className={orderTone[order.status]}>{displayStatus(locale, order.status)}</Pill></td><td className="border-b border-[#eef1ef] px-4 py-3"><span className="block text-[9px] font-bold capitalize text-[#4f5e57]">{displayStatus(locale, order.cod.status)}</span><span className="mt-0.5 block text-[8px] text-[#96a09b]">{formatAmd(order.cod.dueAmd)}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><OrderActions order={order} locale={locale} busy={busyId !== null} onTransition={onTransition} onDialog={onDialog} /></td></tr>)}</tbody></table></div>;
}

function OverviewView({ snapshot, locale, busyId, onTransition, onDialog, go }: { snapshot: Snapshot; locale: Locale; busyId: string | null; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void; go: (section: Section) => void }) {
  const t = copy[locale];
  const v = adminView[locale];
  const total = snapshot.orders.reduce((sum, order) => sum + order.totalAmd, 0);
  const margin = snapshot.orders.reduce((sum, order) => sum + order.projectedMarginAmd, 0);
  const active = snapshot.orders.filter((order) => !["DELIVERED", "CUSTOMER_REFUSED", "CANCELLED"].includes(order.status)).length;
  const pending = snapshot.procurements.filter((task) => task.status === "PENDING_OPERATOR").length;
  return <>
    <section className="relative flex min-h-[220px] flex-col justify-between gap-7 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#1a4538] via-[#14372e] to-[#102b24] p-6 text-white shadow-[0_18px_44px_rgba(21,57,47,0.11)] sm:p-8 lg:flex-row lg:items-center"><div aria-hidden="true" className="absolute -right-20 -top-28 size-80 rounded-full border border-white/5 shadow-[0_0_0_45px_rgba(255,255,255,.018),0_0_0_90px_rgba(255,255,255,.012)]" /><div className="relative z-10 max-w-3xl"><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#f0bd68]">LUMI OPERATIONS · {formatDate(snapshot.dashboard.generatedAt, locale)}</p><h1 className="mt-2 font-serif text-3xl font-medium tracking-tight sm:text-5xl">{t.nav.overview}</h1><p className="mt-3 max-w-2xl text-xs leading-5 text-white/60">{snapshot.dashboard.persistence === "IN_MEMORY_DEVELOPMENT_ADAPTER" ? v.inMemory : snapshot.dashboard.persistence} · {snapshot.crawler.mode === "FIXTURE_ONLY" ? v.fixtureMode : v.gatedMode}</p><div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => go("orders")} className="min-h-10 rounded-xl bg-[#f2bd68] px-4 text-xs font-extrabold text-[#263a32]">{t.nav.orders} →</button><button type="button" onClick={() => go("procurement")} className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold">{t.nav.procurement}</button></div></div><div className="relative z-10 flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 lg:w-auto"><span className={`grid size-11 place-items-center rounded-full font-black ${snapshot.crawler.killSwitch.engaged ? "bg-rose-300/15 text-rose-200" : "bg-emerald-300/10 text-emerald-200"}`}>{snapshot.crawler.killSwitch.engaged ? "!" : "✓"}</span><div><strong className="block text-xs">{snapshot.crawler.killSwitch.engaged ? v.killEngaged : v.connected}</strong><span className="mt-1 block text-[10px] text-white/45">{snapshot.crawler.networkFetcherImplemented ? v.networkAvailable : v.fixtureOnly}</span></div></div></section>
    <section className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4"><MetricCard label={t.kpi.sales} value={formatAmd(total)} detail={snapshot.orders.length + " " + v.records} tone="green" icon="֏" /><MetricCard label={t.kpi.margin} value={formatAmd(margin)} detail={v.serverComputed} tone="purple" icon="↗" /><MetricCard label={t.kpi.active} value={String(active)} detail={v.nonTerminal} tone="blue" icon="▤" /><MetricCard label={t.kpi.procurement} value={String(pending)} detail={v.operatorQueue} tone="amber" icon="◎" /></section>
    <section className={`${panelClass} mt-4`}><PanelHeader eyebrow={v.liveApi} title={t.nav.orders} action={<button type="button" onClick={() => go("orders")} className="text-[10px] font-bold text-[#4e6b61]">{t.nav.orders} →</button>} /><OrdersTable orders={snapshot.orders.slice(0, 5)} locale={locale} busyId={busyId} onTransition={onTransition} onDialog={onDialog} empty={t.common.empty} /></section>
  </>;
}

function OrdersView({ orders, locale, busyId, onTransition, onDialog }: { orders: OrderRecord[]; locale: Locale; busyId: string | null; onTransition: (order: OrderRecord, status: OrderStatus) => void; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  const v = adminView[locale];
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => { const needle = query.trim().toLocaleLowerCase(); return orders.filter((order) => !needle || `${order.orderNumber} ${order.customer.fullName} ${order.customer.phone} ${order.status}`.toLocaleLowerCase().includes(needle)); }, [orders, query]);
  return <><SectionHeading eyebrow={v.ordersEyebrow} title={t.nav.orders} description={v.ordersDescription} /><section className={panelClass}><div className="border-b border-[#e3e9e6] p-3"><label className="flex h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-[#dee5e1] bg-[#fafbfa] px-3"><span aria-hidden="true">⌕</span><span className="sr-only">{v.searchOrders}</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={v.orderPlaceholder} className="w-full bg-transparent text-[11px] outline-none" /></label></div><OrdersTable orders={filtered} locale={locale} busyId={busyId} onTransition={onTransition} onDialog={onDialog} empty={t.common.empty} /></section></>;
}

function CatalogView({ catalog, locale, connection }: { catalog: Snapshot["catalog"]; locale: Locale; connection: Connection }) {
  const t = copy[locale];
  const v = adminView[locale];
  const editor = catalogEditorCopy[locale];
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<AdminCatalogListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingBook, setLoadingBook] = useState<string | null>(null);
  const [refreshingBook, setRefreshingBook] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminCatalogBookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ offset: String(offset), limit: "50" });
      if (query.trim()) params.set("q", query.trim());
      void apiRequest<AdminCatalogListResponse>(connection, "/admin/catalog/books?" + params.toString())
        .then((response) => {
          if (!active) return;
          setResult(response);
          setError(null);
        })
        .catch((cause) => { if (active) setError(describeAdminError(cause, locale)); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [connection, locale, offset, query, refreshKey]);

  async function openEditor(id: string) {
    setLoadingBook(id);
    setError(null);
    try {
      const book = await apiRequest<AdminCatalogBookDetail>(connection, "/admin/catalog/books/" + id);
      setSelected({ ...book, manualEdited: true });
    } catch (cause) {
      setError(describeAdminError(cause, locale));
    } finally {
      setLoadingBook(null);
    }
  }

  async function saveBook(payload: Record<string, unknown>) {
    if (!selected) return;
    const updated = await apiRequest<AdminCatalogBookDetail>(
      connection,
      "/admin/catalog/books/" + selected.id,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    setSelected(null);
    setRefreshKey((value) => value + 1);
    return updated;
  }

  async function refreshBook(id: string) {
    if (!window.confirm(editor.refreshConfirm)) return;
    setRefreshingBook(id);
    setError(null);
    setNotice(null);
    try {
      await apiRequest(
        connection,
        `/admin/catalog/books/${id}/refresh`,
        { method: "POST" },
        120_000,
      );
      setNotice(editor.refreshed);
      setRefreshKey((value) => value + 1);
    } catch (cause) {
      setError(describeAdminError(cause, locale));
    } finally {
      setRefreshingBook(null);
    }
  }

  const items = result?.items ?? [];
  const total = result?.total ?? catalog.total;
  return <>
    <SectionHeading eyebrow={v.catalogEyebrow} title={t.nav.catalog} description={editor.description} />
    <section className={panelClass}>
      <div className="flex items-center justify-between gap-3 border-b border-[#e3e9e6] p-3">
        <label className="flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-[#dee5e1] bg-[#fafbfa] px-3">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">{v.searchCatalog}</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder={v.catalogPlaceholder} className="w-full bg-transparent text-[11px] outline-none" />
        </label>
        <span className="hidden text-[10px] font-bold text-[#8c9792] sm:block">{total}</span>
      </div>
      {error ? <div role="alert" className="m-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] text-rose-700">{error}</div> : null}
      {notice ? <div role="status" className="m-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-[10px] text-emerald-700">{notice}</div> : null}
      {loading && !result ? <div className="grid min-h-48 place-items-center text-xs text-[#7d8984]">{t.common.loading}</div> : null}
      {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] border-collapse text-left"><thead className="bg-[#fafbfa] text-[9px] uppercase tracking-wider text-[#96a09b]"><tr><th className="border-b border-[#e8ecea] px-5 py-3">{v.book}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.price}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.locale}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.availability}</th><th className="border-b border-[#e8ecea] px-4 py-3">{v.observed}</th><th className="border-b border-[#e8ecea] px-4 py-3"><span className="sr-only">{v.actions}</span></th></tr></thead><tbody>{items.map((book) => <tr key={book.id} className="text-[11px] transition hover:bg-[#fbfcfb]"><td className="border-b border-[#eef1ef] px-5 py-3"><div className="flex items-center gap-3">{book.coverImageUrl ? <img alt="" className="h-14 w-10 rounded object-contain shadow-sm" referrerPolicy="no-referrer" src={book.coverImageUrl} /> : <span className="grid h-14 w-10 place-items-center rounded bg-[#edf1ef]">◇</span>}<div><strong className="block max-w-xl">{book.title}</strong><span className="mt-0.5 block text-[9px] text-[#8c9993]">{book.author} · {book.productCode ?? book.supplierSku}</span></div></div></td><td className="border-b border-[#eef1ef] px-4 py-3 font-bold">{formatAmd(book.sourcePriceAmd)}</td><td className="border-b border-[#eef1ef] px-4 py-3 uppercase">{book.availableLocales.join(" / ")}</td><td className="border-b border-[#eef1ef] px-4 py-3"><Pill className={book.availability === "PRELIMINARY_AVAILABLE" ? "border-emerald-100 bg-emerald-50 text-emerald-700" : "border-rose-100 bg-rose-50 text-rose-700"}>{displayStatus(locale, book.availability)}</Pill></td><td className="border-b border-[#eef1ef] px-4 py-3"><span className="block">{formatDate(book.updatedAt, locale)}</span><span className={`mt-1 block text-[8px] font-bold ${book.manualEdited ? "text-amber-700" : "text-[#98a19d]"}`}>{book.manualEdited ? editor.edited : editor.automatic}</span></td><td className="border-b border-[#eef1ef] px-4 py-3"><div className="flex flex-wrap justify-end gap-2"><button disabled={refreshingBook !== null || loadingBook !== null} type="button" onClick={() => void refreshBook(book.id)} className="min-h-9 rounded-lg border border-[#cfd9d4] bg-white px-3 text-[9px] font-bold text-[#315e50] disabled:opacity-50">{refreshingBook === book.id ? editor.refreshing : editor.refresh}</button><button disabled={loadingBook !== null || refreshingBook !== null} type="button" onClick={() => void openEditor(book.id)} className="min-h-9 rounded-lg bg-[#183d33] px-3 text-[9px] font-bold text-white disabled:opacity-50">{loadingBook === book.id ? editor.loading : editor.edit}</button></div></td></tr>)}</tbody></table></div> : !loading ? <EmptyState text={t.common.empty} /> : null}
      <div className="flex items-center justify-between border-t border-[#edf1ef] p-3"><button disabled={offset === 0 || loading} type="button" onClick={() => setOffset(Math.max(0, offset - 50))} className={secondaryButtonClass}>{editor.previous}</button><span className="text-[9px] font-bold text-[#8c9792]">{total ? `${offset + 1}–${Math.min(offset + 50, total)} / ${total}` : "0"}</span><button disabled={offset + 50 >= total || loading} type="button" onClick={() => setOffset(offset + 50)} className={secondaryButtonClass}>{editor.next}</button></div>
    </section>
    {selected ? <BookEditorModal key={selected.id} book={selected} locale={locale} onClose={() => setSelected(null)} onSave={saveBook} /> : null}
  </>;
}

function localizedCategoryName(
  translations: Array<{ locale: "hy" | "ru" | "en"; name: string }>,
  locale: Locale,
): string {
  const preferred = locale.toLocaleLowerCase();
  return translations.find((item) => item.locale === preferred)?.name
    ?? translations.find((item) => item.locale === "hy")?.name
    ?? translations[0]?.name
    ?? "—";
}

function CategoriesView({ locale, connection }: { locale: Locale; connection: Connection }) {
  const t = copy[locale];
  const ui = categoryEditorCopy[locale];
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<AdminCategoriesResponse | null>(null);
  const [selected, setSelected] = useState<AdminCategoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const pageSize = 100;

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ offset: String(offset), limit: String(pageSize) });
      if (query.trim()) params.set("q", query.trim());
      void apiRequest<AdminCategoriesResponse>(
        connection,
        `/admin/catalog/categories?${params.toString()}`,
      )
        .then((response) => {
          if (!active) return;
          setResult(response);
          setError(null);
        })
        .catch((cause) => { if (active) setError(describeAdminError(cause, locale)); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timeout); };
  }, [connection, locale, offset, query, refreshKey]);

  async function openEditor(id: string) {
    setLoadingId(id);
    setError(null);
    try {
      const category = await apiRequest<AdminCategoryDetail>(
        connection,
        `/admin/catalog/categories/${id}`,
      );
      setSelected({ ...category, manualEdited: true });
    } catch (cause) {
      setError(describeAdminError(cause, locale));
    } finally {
      setLoadingId(null);
    }
  }

  async function saveCategory(payload: Record<string, unknown>) {
    if (!selected) return;
    const updated = await apiRequest<AdminCategoryDetail>(
      connection,
      `/admin/catalog/categories/${selected.id}`,
      { method: "PATCH", body: JSON.stringify(payload) },
    );
    setSelected(null);
    setRefreshKey((value) => value + 1);
    return updated;
  }

  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  return <>
    <SectionHeading eyebrow={ui.eyebrow} title={t.nav.categories} description={ui.description} />
    <section className={panelClass}>
      <div className="flex items-center justify-between gap-3 border-b border-[#e3e9e6] p-3">
        <label className="flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-[#dee5e1] bg-[#fafbfa] px-3">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">{ui.search}</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder={ui.search} className="w-full bg-transparent text-[11px] outline-none" />
        </label>
        <span className="text-[10px] font-bold text-[#8c9792]">{total}</span>
      </div>
      {error ? <div role="alert" className="m-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] text-rose-700">{error}</div> : null}
      {loading && !result ? <div className="grid min-h-48 place-items-center text-xs text-[#7d8984]">{t.common.loading}</div> : null}
      {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-left"><thead className="bg-[#fafbfa] text-[9px] uppercase tracking-wider text-[#96a09b]"><tr><th className="border-b border-[#e8ecea] px-5 py-3">{ui.category}</th><th className="border-b border-[#e8ecea] px-4 py-3">{ui.parent}</th><th className="border-b border-[#e8ecea] px-4 py-3">{ui.position}</th><th className="border-b border-[#e8ecea] px-4 py-3">{ui.books}</th><th className="border-b border-[#e8ecea] px-4 py-3">{ui.children}</th><th className="border-b border-[#e8ecea] px-4 py-3" /></tr></thead><tbody>{items.map((category) => <tr key={category.id} className="text-[11px] transition hover:bg-[#fbfcfb]"><td className="border-b border-[#eef1ef] px-5 py-3"><strong className="block max-w-lg">{localizedCategoryName(category.translations, locale)}</strong><span className="mt-1 block text-[8px] text-[#929d98]">#{category.supplierCategoryId} · <span className={category.manualEdited ? "text-amber-700" : ""}>{category.manualEdited ? ui.manual : ui.automatic}</span></span></td><td className="border-b border-[#eef1ef] px-4 py-3">{category.parent ? `#${category.parent.supplierCategoryId}` : ui.root}</td><td className="border-b border-[#eef1ef] px-4 py-3">{category.position}</td><td className="border-b border-[#eef1ef] px-4 py-3">{category._count.books}</td><td className="border-b border-[#eef1ef] px-4 py-3">{category._count.children}</td><td className="border-b border-[#eef1ef] px-4 py-3 text-right"><button disabled={loadingId !== null} type="button" onClick={() => void openEditor(category.id)} className="min-h-9 rounded-lg bg-[#183d33] px-3 text-[9px] font-bold text-white disabled:opacity-50">{loadingId === category.id ? ui.loading : ui.edit}</button></td></tr>)}</tbody></table></div> : !loading ? <EmptyState text={t.common.empty} /> : null}
      <div className="flex items-center justify-between border-t border-[#edf1ef] p-3"><button disabled={offset === 0 || loading} type="button" onClick={() => setOffset(Math.max(0, offset - pageSize))} className={secondaryButtonClass}>{ui.previous}</button><span className="text-[9px] font-bold text-[#8c9792]">{total ? `${offset + 1}–${Math.min(offset + pageSize, total)} / ${total}` : "0"}</span><button disabled={offset + pageSize >= total || loading} type="button" onClick={() => setOffset(offset + pageSize)} className={secondaryButtonClass}>{ui.next}</button></div>
    </section>
    {selected ? <CategoryEditorModal key={selected.id} category={selected} locale={locale} onClose={() => setSelected(null)} onSave={saveCategory} /> : null}
  </>;
}

function CategoryEditorModal({ category, locale, onClose, onSave }: { category: AdminCategoryDetail; locale: Locale; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<AdminCategoryDetail | void> }) {
  const ui = categoryEditorCopy[locale];
  const preferredLocale = locale.toLocaleLowerCase() as "hy" | "ru" | "en";
  const [draft, setDraft] = useState(category);
  const [activeLocale, setActiveLocale] = useState<"hy" | "ru" | "en">(category.translations.some((item) => item.locale === preferredLocale) ? preferredLocale : category.translations[0]?.locale ?? "ru");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = draft.translations.find((item) => item.locale === activeLocale) ?? draft.translations[0];
  const inputClass = "min-h-11 w-full rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-3 text-[11px] outline-none focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100";
  const labelClass = "grid gap-1.5 text-[9px] font-bold uppercase tracking-[.04em] text-[#66736d]";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        parentId: draft.parentId,
        position: draft.position,
        manualEdited: draft.manualEdited,
        translations: draft.translations.map(({ locale: translationLocale, name }) => ({
          locale: translationLocale,
          name: name.trim(),
        })),
      });
    } catch (cause) {
      setError(describeAdminError(cause, locale));
    } finally {
      setSaving(false);
    }
  }

  if (!selected) return null;
  return <div className="fixed inset-0 z-[250] bg-[#0d211b]/70 p-2 backdrop-blur-sm sm:p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="category-editor-title" className="mx-auto flex h-full max-h-[780px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between gap-4 border-b border-[#e5eae7] px-5 py-4"><div><p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#8b9691]">{ui.editor}</p><h2 id="category-editor-title" className="mt-1 font-serif text-2xl font-semibold">{selected.name}</h2><p className="mt-1 text-[9px] text-[#919b96]">Books.am #{category.supplierCategoryId}</p></div><button disabled={saving} type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl bg-[#f0f3f1] text-xl">×</button></header><form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>{ui.parent}<select value={draft.parentId ?? ""} onChange={(event) => setDraft({ ...draft, parentId: event.target.value || null })} className={inputClass}><option value="">{ui.root}</option>{draft.parentOptions.map((option) => <option value={option.id} key={option.id}>#{option.supplierCategoryId} · {localizedCategoryName(option.translations, locale)}</option>)}</select></label><label className={labelClass}>{ui.position}<input min="0" max="100000" type="number" value={draft.position} onChange={(event) => setDraft({ ...draft, position: Number(event.target.value) })} className={inputClass} /></label></div><label aria-label={ui.protect} className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-[10px] text-amber-900"><input type="checkbox" checked={draft.manualEdited} onChange={(event) => setDraft({ ...draft, manualEdited: event.target.checked })} className="mt-0.5 size-4 accent-[#315e50]" /><span><strong className="block">{ui.protect}</strong><span className="mt-1 block text-[9px] text-amber-800/75">{ui.protectHint}</span></span></label><section className="mt-5 rounded-2xl border border-[#e4e9e6]"><div className="flex items-center justify-between border-b border-[#e9edeb] p-4"><h3 className="font-serif text-lg font-semibold">HY / RU / EN</h3><div className="flex rounded-xl bg-[#f1f4f2] p-1">{draft.translations.map((translation) => <button key={translation.locale} type="button" onClick={() => setActiveLocale(translation.locale)} className={`rounded-lg px-4 py-2 text-[10px] font-extrabold uppercase ${activeLocale === translation.locale ? "bg-[#183d33] text-white" : "text-[#69766f]"}`}>{translation.locale}</button>)}</div></div><div className="p-4"><label className={labelClass}>{ui.category}<input required value={selected.name} onChange={(event) => setDraft((current) => ({ ...current, translations: current.translations.map((translation) => translation.locale === activeLocale ? { ...translation, name: event.target.value } : translation) }))} className={inputClass} /></label><p className="mt-3 break-all text-[9px] text-[#8a9590]">{selected.sourceUrl}</p></div></section></div><footer className="flex items-center justify-between gap-3 border-t border-[#e5eae7] px-5 py-3">{error ? <span role="alert" className="text-[10px] font-semibold text-rose-700">{error}</span> : <span className="text-[9px] text-[#8a9590]">{ui.protectHint}</span>}<div className="flex gap-2"><button disabled={saving} type="button" onClick={onClose} className={secondaryButtonClass}>{copy[locale].common.close}</button><button disabled={saving} type="submit" className={primaryButtonClass}>{saving ? copy[locale].common.refreshing : ui.save}</button></div></footer></form></section></div>;
}

function BookEditorModal({ book, locale, onClose, onSave }: { book: AdminCatalogBookDetail; locale: Locale; onClose: () => void; onSave: (payload: Record<string, unknown>) => Promise<AdminCatalogBookDetail | void> }) {
  const ui = catalogEditorCopy[locale];
  const [draft, setDraft] = useState(book);
  const preferredLocale = locale.toLocaleLowerCase() as "hy" | "ru" | "en";
  const [activeLocale, setActiveLocale] = useState<"hy" | "ru" | "en">(book.localizations.some((item) => item.locale === preferredLocale) ? preferredLocale : book.localizations[0]?.locale ?? "ru");
  const [jsonFields, setJsonFields] = useState<Record<string, { attributes: string; sections: string }>>(() => Object.fromEntries(book.localizations.map((item) => [item.locale, { attributes: JSON.stringify(item.attributes, null, 2), sections: JSON.stringify(item.detailSections, null, 2) }])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = draft.localizations.find((item) => item.locale === activeLocale) ?? draft.localizations[0];
  const inputClass = "min-h-11 w-full rounded-xl border border-[#dce4e0] bg-[#fafbfa] px-3 text-[11px] outline-none focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100";
  const labelClass = "grid gap-1.5 text-[9px] font-bold uppercase tracking-[.04em] text-[#66736d]";

  function updateLocalization(field: keyof AdminBookLocalization, value: unknown) {
    setDraft((current) => ({ ...current, localizations: current.localizations.map((item) => item.locale === activeLocale ? { ...item, [field]: value } : item) }));
  }

  function toggleCategory(categoryId: string) {
    setDraft((current) => ({
      ...current,
      categoryIds: current.categoryIds.includes(categoryId)
        ? current.categoryIds.filter((id) => id !== categoryId)
        : [...current.categoryIds, categoryId],
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const localizations = draft.localizations.map((item) => {
        const json = jsonFields[item.locale];
        const attributes = JSON.parse(json?.attributes ?? "[]") as unknown;
        const detailSections = JSON.parse(json?.sections ?? "[]") as unknown;
        if (!Array.isArray(attributes) || !Array.isArray(detailSections)) throw new Error(ui.invalidJson);
        return {
          locale: item.locale,
          title: item.title.trim(),
          author: item.author.trim(),
          description: item.description,
          languageLabel: item.languageLabel?.trim() || null,
          isbn: item.isbn?.trim() || null,
          publisher: item.publisher?.trim() || null,
          productCode: item.productCode.trim(),
          weight: item.weight?.trim() || null,
          barcode: item.barcode?.trim() || null,
          isNew: item.isNew,
          pageCount: item.pageCount,
          coverType: item.coverType?.trim() || null,
          dimensions: item.dimensions?.trim() || null,
          publicationYear: item.publicationYear,
          series: item.series?.trim() || null,
          imageUrls: item.imageUrls,
          attributes,
          detailSections,
        };
      });
      await onSave({ slug: draft.slug.trim(), language: draft.language, sourcePriceAmd: draft.sourcePriceAmd, availability: draft.availability, manualEdited: draft.manualEdited, categoryIds: draft.categoryIds, localizations });
    } catch (cause) {
      setError(cause instanceof SyntaxError ? ui.invalidJson : describeAdminError(cause, locale));
    } finally {
      setSaving(false);
    }
  }

  if (!selected) return null;
  // Dynamic translated label text is paired with controls inside each label.
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <div className="fixed inset-0 z-[250] bg-[#0d211b]/70 p-2 backdrop-blur-sm sm:p-5" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="book-editor-title" className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#e5eae7] px-4 py-4 sm:px-6"><div><p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#8b9691]">{ui.editor}</p><h2 id="book-editor-title" className="mt-1 max-w-4xl font-serif text-2xl font-semibold">{selected.title}</h2><p className="mt-1 text-[9px] text-[#919b96]">{ui.immutable}: {book.id}</p></div><button disabled={saving} type="button" onClick={onClose} aria-label={ui.close} className="grid size-9 place-items-center rounded-xl bg-[#f0f3f1] text-xl">×</button></header><form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}><div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><section className="rounded-2xl border border-[#e4e9e6] bg-white p-4"><h3 className="font-serif text-lg font-semibold">{ui.general}</h3><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className={labelClass}>{ui.sku}<input readOnly value={draft.supplierSku} className={inputClass + " text-[#8a9590]"} /></label><label className={labelClass}>{ui.slug}<input required value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} className={inputClass} /></label><label className={labelClass}>{ui.sourcePrice}<input required min="1" type="number" value={draft.sourcePriceAmd} onChange={(event) => setDraft({ ...draft, sourcePriceAmd: Number(event.target.value) })} className={inputClass} /></label><label className={labelClass}>{ui.language}<select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as AdminCatalogBookDetail["language"] })} className={inputClass}><option value="hy">HY</option><option value="ru">RU</option><option value="en">EN</option></select></label><label className={labelClass}>{ui.availability}<select value={draft.availability} onChange={(event) => setDraft({ ...draft, availability: event.target.value as AdminCatalogBookDetail["availability"] })} className={inputClass}><option value="PRELIMINARY_AVAILABLE">PRELIMINARY_AVAILABLE</option><option value="OUT_OF_STOCK">OUT_OF_STOCK</option></select></label><label className={labelClass + " md:col-span-2 xl:col-span-3"}>{ui.sourceUrl}<input readOnly value={draft.sourceUrl} className={inputClass + " text-[#8a9590]"} /></label></div><label className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-[10px] text-amber-900"><input type="checkbox" checked={draft.manualEdited} onChange={(event) => setDraft({ ...draft, manualEdited: event.target.checked })} className="mt-0.5 size-4 accent-[#315e50]" /><span><strong className="block">{ui.protect}</strong><span className="mt-1 block text-[9px] text-amber-800/75">{ui.protectHint}</span></span></label><div className="mt-4"><h3 className="font-serif text-lg font-semibold">{ui.categories}</h3><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-[#dce4e0] bg-[#fafbfa] p-3 sm:grid-cols-2 lg:grid-cols-3">{draft.categoryOptions.map((category) => { const translated = category.translations.find((item) => item.locale === preferredLocale) ?? category.translations[0]; return <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-2 text-[10px]" key={category.id}><input type="checkbox" checked={draft.categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} className="mt-0.5 size-4 shrink-0 accent-[#315e50]" /><span><strong className="block normal-case">{translated?.name ?? category.supplierCategoryId}</strong><small className="text-[8px] text-[#929c97]">#{category.supplierCategoryId}</small></span></label>; })}</div></div></section><section className="mt-4 rounded-2xl border border-[#e4e9e6] bg-white"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9edeb] p-4"><h3 className="font-serif text-lg font-semibold">{ui.localization}</h3><div className="flex rounded-xl bg-[#f1f4f2] p-1">{draft.localizations.map((item) => <button key={item.locale} type="button" onClick={() => setActiveLocale(item.locale)} className={`rounded-lg px-4 py-2 text-[10px] font-extrabold uppercase ${activeLocale === item.locale ? "bg-[#183d33] text-white" : "text-[#69766f]"}`}>{item.locale}</button>)}</div></div><div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2"><div className="grid content-start gap-4"><label className={labelClass}>{ui.title}<input required value={selected.title} onChange={(event) => updateLocalization("title", event.target.value)} className={inputClass} /></label><label className={labelClass}>{ui.author}<input value={selected.author} onChange={(event) => updateLocalization("author", event.target.value)} className={inputClass} /></label><label className={labelClass}>{ui.descriptionField}<textarea rows={7} value={selected.description} onChange={(event) => updateLocalization("description", event.target.value)} className={inputClass + " resize-y py-3 normal-case"} /></label><div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>{ui.productCode}<input required value={selected.productCode} onChange={(event) => updateLocalization("productCode", event.target.value)} className={inputClass} /></label><label className={labelClass}>{ui.languageLabel}<input value={selected.languageLabel ?? ""} onChange={(event) => updateLocalization("languageLabel", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.publisher}<input value={selected.publisher ?? ""} onChange={(event) => updateLocalization("publisher", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.isbn}<input value={selected.isbn ?? ""} onChange={(event) => updateLocalization("isbn", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.weight}<input value={selected.weight ?? ""} onChange={(event) => updateLocalization("weight", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.barcode}<input value={selected.barcode ?? ""} onChange={(event) => updateLocalization("barcode", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.newness}<select value={selected.isNew === null ? "" : String(selected.isNew)} onChange={(event) => updateLocalization("isNew", event.target.value === "" ? null : event.target.value === "true")} className={inputClass}><option value="">{ui.unknown}</option><option value="true">{ui.yes}</option><option value="false">{ui.no}</option></select></label><label className={labelClass}>{ui.pages}<input min="1" type="number" value={selected.pageCount ?? ""} onChange={(event) => updateLocalization("pageCount", event.target.value ? Number(event.target.value) : null)} className={inputClass} /></label><label className={labelClass}>{ui.year}<input min="1" max="9999" type="number" value={selected.publicationYear ?? ""} onChange={(event) => updateLocalization("publicationYear", event.target.value ? Number(event.target.value) : null)} className={inputClass} /></label><label className={labelClass}>{ui.cover}<input value={selected.coverType ?? ""} onChange={(event) => updateLocalization("coverType", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.dimensions}<input value={selected.dimensions ?? ""} onChange={(event) => updateLocalization("dimensions", event.target.value || null)} className={inputClass} /></label><label className={labelClass}>{ui.series}<input value={selected.series ?? ""} onChange={(event) => updateLocalization("series", event.target.value || null)} className={inputClass} /></label></div></div><div className="grid content-start gap-4"><div className="grid grid-cols-[96px_1fr] gap-4">{selected.imageUrls[0] ? <img alt="" className="h-36 w-24 rounded-lg bg-[#f3f4f2] object-contain shadow" referrerPolicy="no-referrer" src={selected.imageUrls[0]} /> : <span className="grid h-36 w-24 place-items-center rounded-lg bg-[#f1f3f2] text-2xl">◇</span>}<label className={labelClass}>{ui.images}<textarea rows={7} value={selected.imageUrls.join("\n")} onChange={(event) => updateLocalization("imageUrls", event.target.value.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean))} className={inputClass + " resize-y py-3 normal-case"} /></label></div><label className={labelClass}>{ui.attributes}<textarea rows={12} value={jsonFields[activeLocale]?.attributes ?? "[]"} onChange={(event) => setJsonFields({ ...jsonFields, [activeLocale]: { ...(jsonFields[activeLocale] ?? { sections: "[]" }), attributes: event.target.value } })} className={inputClass + " resize-y py-3 font-mono text-[10px] normal-case"} /></label><label className={labelClass}>{ui.sections}<textarea rows={12} value={jsonFields[activeLocale]?.sections ?? "[]"} onChange={(event) => setJsonFields({ ...jsonFields, [activeLocale]: { ...(jsonFields[activeLocale] ?? { attributes: "[]" }), sections: event.target.value } })} className={inputClass + " resize-y py-3 font-mono text-[10px] normal-case"} /></label><div className="rounded-xl bg-[#f7f9f8] p-3 text-[9px] text-[#7d8984]"><strong className="block">{ui.parserVersion}: {selected.parserVersion}</strong><span className="mt-1 block break-all">{ui.sourceUrl}: {selected.sourceUrl}</span></div></div></div></section></div><footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#e5eae7] bg-white px-4 py-3 sm:px-6">{error ? <span role="alert" className="text-[10px] font-semibold text-rose-700">{error}</span> : <span className="text-[9px] text-[#8a9590]">{ui.protectHint}</span>}<div className="flex gap-2"><button disabled={saving} type="button" onClick={onClose} className={secondaryButtonClass}>{ui.close}</button><button disabled={saving} type="submit" className={primaryButtonClass}>{saving ? copy[locale].common.refreshing : ui.save}</button></div></footer></form></section></div>;
}

function ProcurementView({ tasks, orders, locale, busyId, onDialog }: { tasks: ProcurementTask[]; orders: OrderRecord[]; locale: Locale; busyId: string | null; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  const v = adminView[locale];

  return <>
    <SectionHeading eyebrow={v.procurementEyebrow} title={t.nav.procurement} description={v.procurementDescription} />
    <section className={panelClass}>
      {tasks.length ? <div className="divide-y divide-[#edf1ef]">
        {tasks.map((task) => {
          const actions = procurementActionVisibility(task, orders);
          return <article key={task.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(220px,1fr)_140px_160px_auto] lg:items-center">
            <div>
              <strong className="block text-sm">{task.orderNumber}</strong>
              <div className="mt-2 space-y-2">
                {task.items.map((item) => <div key={task.id + "-" + item.productId} className="rounded-lg bg-[#f8faf9] px-2.5 py-2">
                  <span className="block text-[9px] font-semibold text-[#44524c]">{item.title} × {item.quantity} · {formatAmd(item.observedSourceUnitPriceAmd)}</span>
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" title={item.sourceUrl} className="mt-1 inline-flex items-center gap-1 text-[8px] font-bold text-indigo-700 underline decoration-indigo-200 underline-offset-2">
                    <span aria-hidden="true">Books.am ↗</span>
                    <span className="sr-only">External Books.am URL: </span>
                    {t.action.openSupplier}
                  </a>
                </div>)}
              </div>
              {task.operatorNote ? <p className="mt-2 text-[9px] text-[#78613b]">{task.operatorNote}</p> : null}
            </div>
            <div>
              <span className="text-[8px] uppercase text-[#929d98]">{task.supplierName} · {v.observed}</span>
              <strong className="mt-1 block text-xs">{formatAmd(task.supplierItemsSubtotalAmd)}</strong>
              <span className="mt-0.5 block text-[8px] text-[#9aa49f]">{task.supplierTotalAmd === null ? v.quotePending : formatAmd(task.supplierTotalAmd)}</span>
            </div>
            <div>
              <Pill className={procurementTone[task.status]}>{displayStatus(locale, task.status)}</Pill>
              {task.supplierReference ? <span className="mt-1 block text-[8px] text-[#8b9691]">{v.reference}: {task.supplierReference}</span> : null}
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {actions.canConfirm ? <button disabled={busyId !== null} type="button" onClick={() => onDialog({ kind: "proc-confirm", task })} className="min-h-9 rounded-lg bg-[#183d33] px-3 text-[9px] font-bold text-white">{t.action.procConfirm}</button> : null}
              {task.status === "PENDING_OPERATOR" && actions.canCancel ? <button disabled={busyId !== null} type="button" onClick={() => onDialog({ kind: "proc-unavailable", task })} className="min-h-9 rounded-lg border border-rose-200 bg-rose-50 px-3 text-[9px] font-bold text-rose-700">{t.action.unavailable}</button> : null}
              {actions.canCancel ? <button disabled={busyId !== null} type="button" onClick={() => onDialog({ kind: "proc-cancel", task })} className="min-h-9 rounded-lg border border-[#dfe5e2] bg-white px-3 text-[9px] font-bold text-[#6d7a74]">{t.action.procCancel}</button> : null}
            </div>
          </article>;
        })}
      </div> : <EmptyState text={t.common.empty} />}
    </section>
  </>;
}

function CrawlerView({ crawler, locale, busy, lastResult, onParse, onRun, onDialog }: { crawler: CrawlerStatus; locale: Locale; busy: boolean; lastResult: unknown; onParse: (fixture: "book-detail" | "book-price-conflict") => void; onRun: () => void; onDialog: (action: DialogAction) => void }) {
  const t = copy[locale];
  const v = adminView[locale];
  const run = crawlerRunCopy[locale];
  const crawling = crawler.browserRun.status === "RUNNING" || crawler.browserRun.status === "STOPPING";
  const result = crawler.browserRun.status === "IDLE" ? lastResult : crawler.browserRun;
  return <><SectionHeading eyebrow={v.crawlerEyebrow} title={t.nav.crawler} description={v.crawlerDescription} action={<button disabled={busy || !crawler.liveRunAllowed} type="button" onClick={onRun} className={primaryButtonClass}>{crawling ? run.running : run.run}</button>} /><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={v.mode} value={crawler.mode === "FIXTURE_ONLY" ? v.fixtureMode : v.gatedMode} detail={v.serverReported} tone="blue" icon="◎" /><MetricCard label={v.networkFetcher} value={crawler.browserRun.status} detail={`${crawler.browserRun.imported} imported · ${crawler.browserRun.catalogPagesVisited} pages · ${crawler.browserRun.catalogSegmentsCompleted}/${crawler.browserRun.catalogSegmentsDiscovered} segments`} tone={crawling ? "amber" : "green"} icon="⌁" /><MetricCard label={v.dailyBudget} value={`${crawler.budget.remaining}/${crawler.budget.limit}`} detail={crawler.gate.writtenPermission ? v.permissionRecorded : v.permissionAbsent} tone="amber" icon="#" /><MetricCard label={v.killSwitch} value={crawler.killSwitch.engaged ? v.engaged : v.ready} detail={crawler.killSwitch.reason ?? v.noIncident} tone={crawler.killSwitch.engaged ? "amber" : "green"} icon="!" /></section><div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]"><section className={panelClass}><PanelHeader eyebrow={result ? run.result : v.bundledHtml} title={v.contractFixtures} /><div className="grid gap-3 p-5 sm:grid-cols-2"><button disabled={busy || crawling} type="button" onClick={() => onParse("book-detail")} className={`${secondaryButtonClass} justify-between`}>book-detail <span>→</span></button><button disabled={busy || crawling} type="button" onClick={() => onParse("book-price-conflict")} className={`${secondaryButtonClass} justify-between`}>price-conflict <span>→</span></button></div>{result ? <pre className="max-h-64 overflow-auto border-t border-[#edf1ef] bg-[#f8faf9] p-5 text-[9px] leading-4 text-[#435149]">{JSON.stringify(result, null, 2)}</pre> : <EmptyState text={t.common.empty} />}</section><aside className={panelClass}><PanelHeader eyebrow={v.runtimeGuard} title={v.killSwitch} action={crawler.killSwitch.engaged ? <Pill className="border-rose-100 bg-rose-50 text-rose-700">{v.engaged}</Pill> : <Pill className="border-emerald-100 bg-emerald-50 text-emerald-700">{v.ready}</Pill>} /><div className="p-5"><p className="text-[10px] leading-5 text-[#65736c]">{v.crawlerNotice}</p><dl className="mt-5 space-y-3 border-y border-[#edf1ef] py-4 text-[9px]"><div className="flex justify-between gap-4"><dt className="text-[#8b9791]">{v.reason}</dt><dd className="text-right font-bold">{crawler.killSwitch.reason ?? "—"}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#8b9791]">{v.engagedAt}</dt><dd className="text-right font-bold">{formatDate(crawler.killSwitch.engagedAt, locale)}</dd></div></dl>{crawler.killSwitch.engaged ? <button disabled={busy} type="button" onClick={() => onDialog({ kind: "crawler-resume" })} className={`${primaryButtonClass} mt-5 w-full`}>{t.action.resume}</button> : null}</div></aside></div></>;
}

function ActionDialogView({ action, locale, busy, error, onClose, onSubmit }: { action: DialogAction; locale: Locale; busy: boolean; error: string | null; onClose: () => void; onSubmit: (values: Record<string, string>) => Promise<void> }) {
  const t = copy[locale];
  const ui = adminUi[locale];
  const config = action.kind === "order-cancel"
    ? { title: ui.cancelOrderTitle, description: ui.cancelOrderText, label: "", field: null, placeholder: "", min: 0, max: 0, singleLine: false }
    : action.kind === "cash-collect"
      ? { title: t.action.collect, description: "", label: ui.receiptLabel, field: "fiscalReceiptNumber", placeholder: ui.receiptPlaceholder, min: 3, max: 100, singleLine: true }
      : action.kind === "cash-reconcile"
        ? { title: t.action.reconcile, description: "", label: ui.reconciliationLabel, field: "reconciliationReference", placeholder: ui.reconciliationPlaceholder, min: 3, max: 120, singleLine: true }
        : action.kind === "cash-refuse"
          ? { title: t.action.refuse, description: "", label: ui.reasonLabel, field: "reason", placeholder: ui.refusalPlaceholder, min: 3, max: 500, singleLine: false }
          : action.kind === "proc-confirm"
            ? { title: t.action.procConfirm, description: "", label: ui.supplierReferenceLabel, field: "supplierReference", placeholder: ui.supplierReferencePlaceholder, min: 2, max: 120, singleLine: true }
            : action.kind === "proc-unavailable"
              ? { title: t.action.unavailable, description: "", label: ui.operatorNoteLabel, field: "note", placeholder: ui.unavailablePlaceholder, min: 3, max: 500, singleLine: false }
              : action.kind === "proc-cancel"
                ? { title: t.action.procCancel, description: "", label: ui.operatorNoteLabel, field: "note", placeholder: ui.procurementCancelPlaceholder, min: 3, max: 500, singleLine: false }
                : { title: t.action.resume, description: "", label: ui.resumeReasonLabel, field: "reason", placeholder: ui.resumeReasonPlaceholder, min: 8, max: 300, singleLine: false };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config.field) {
      await onSubmit({});
      return;
    }

    const form = new FormData(event.currentTarget);
    const rawValue = String(form.get(config.field) ?? "");
    const normalized = action.kind === "cash-collect" ? normalizeReceiptNumber(rawValue) : rawValue.trim();
    if (action.kind === "cash-collect" && !normalized) {
      const control = event.currentTarget.elements.namedItem(config.field) as HTMLInputElement | null;
      control?.setCustomValidity(ui.receiptInvalid);
      control?.reportValidity();
      return;
    }
    await onSubmit({ [config.field]: normalized ?? "" });
  }

  const fieldClass = "w-full rounded-xl border border-[#dce4e0] bg-[#fafbfa] p-3 text-xs font-medium outline-none focus:border-[#315e50] focus:ring-3 focus:ring-emerald-100";
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-[#0e211b]/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="action-title" className="w-full max-w-md rounded-2xl border border-white/20 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-extrabold uppercase tracking-[0.15em] text-[#8a9690]">{ui.serverCommand}</p><h2 id="action-title" className="mt-1 font-serif text-2xl font-semibold">{config.title}</h2></div><button disabled={busy} type="button" onClick={onClose} aria-label={t.common.close} className="grid size-8 place-items-center rounded-lg bg-[#f1f4f2] text-lg">×</button></div><form className="mt-6" onSubmit={submit}>{config.field ? <label className="grid gap-2 text-[10px] font-bold text-[#526059]">{config.label}{config.singleLine ? <input required minLength={config.min} maxLength={config.max} name={config.field} placeholder={config.placeholder} onInput={(event) => event.currentTarget.setCustomValidity("")} className={fieldClass + " h-12"} /> : <textarea required minLength={config.min} maxLength={config.max} name={config.field} rows={3} placeholder={config.placeholder} className={fieldClass + " resize-y"} />}</label> : <p className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-xs leading-5 text-rose-800"><strong className="block">{action.kind === "order-cancel" ? action.order.orderNumber : ""}</strong>{config.description}</p>}{error ? <div role="alert" className="mt-3 rounded-xl border border-rose-100 bg-rose-50 p-3 text-[10px] text-rose-700">{error}</div> : null}<div className="mt-5 flex justify-end gap-2"><button disabled={busy} type="button" onClick={onClose} className={secondaryButtonClass}>{t.common.cancel}</button><button disabled={busy} type="submit" className={action.kind === "order-cancel" ? "inline-flex min-h-10 items-center justify-center rounded-xl bg-rose-700 px-4 text-xs font-bold text-white disabled:opacity-50" : primaryButtonClass}>{busy ? t.common.refreshing : action.kind === "order-cancel" ? t.common.confirm : t.common.save}</button></div></form></section></div>;
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
  const connectLock = useRef(false);
  const refreshLock = useRef(false);
  const operationLock = useRef(false);
  const t = copy[locale];
  const ui = adminUi[locale];
  const v = adminView[locale];

  useEffect(() => {
    const previous = document.documentElement.lang;
    document.documentElement.lang = locale.toLocaleLowerCase();
    return () => { document.documentElement.lang = previous; };
  }, [locale]);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), noticeLifetimeMs);
    return () => clearTimeout(timeout);
  }, [notice]);

  const crawlerRunning = snapshot?.crawler.browserRun.status === "RUNNING" || snapshot?.crawler.browserRun.status === "STOPPING";
  useEffect(() => {
    if (!connection || !crawlerRunning) return;
    const activeConnection = connection;
    const interval = window.setInterval(() => {
      if (refreshLock.current || operationLock.current) return;
      refreshLock.current = true;
      void loadSnapshot(activeConnection, locale)
        .then((data) => setSnapshot(data))
        .catch((cause) => setError(describeAdminError(cause, locale)))
        .finally(() => { refreshLock.current = false; });
    }, 3_000);
    return () => window.clearInterval(interval);
  }, [connection, crawlerRunning, locale]);

  function resetConnection(message: string | null = null) {
    connectLock.current = false;
    refreshLock.current = false;
    operationLock.current = false;
    setConnection(null);
    setSnapshot(null);
    setError(message);
    setNotice(null);
    setBusyId(null);
    setDialog(null);
    setDialogError(null);
    setLastFixtureResult(null);
  }

  async function connect(next: Connection) {
    if (connectLock.current) return;
    connectLock.current = true;
    setConnecting(true);
    setError(null);
    try {
      const data = await loadSnapshot(next, locale);
      setConnection(next);
      setSnapshot(data);
      setNotice(v.connected);
    } catch (cause) {
      setError(describeAdminError(cause, locale));
    } finally {
      connectLock.current = false;
      setConnecting(false);
    }
  }

  async function refresh(active = connection, nextLocale = locale, allowDuringOperation = false) {
    if (!active || refreshLock.current || (operationLock.current && !allowDuringOperation)) return false;
    refreshLock.current = true;
    setRefreshing(true);
    setError(null);
    try {
      setSnapshot(await loadSnapshot(active, nextLocale));
      return true;
    } catch (cause) {
      const message = describeAdminError(cause, nextLocale);
      if (isAuthorizationError(cause)) resetConnection(message);
      else setError(message);
      return false;
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  }

  function changeLocale(next: Locale) {
    if (refreshLock.current || operationLock.current) return;
    setLocale(next);
    if (connection) void refresh(connection, next);
  }

  async function mutate(path: string, body: unknown, label: string, id: string) {
    if (!connection || operationLock.current || refreshLock.current) return false;
    operationLock.current = true;
    setBusyId(id);
    setDialogError(null);
    setError(null);
    try {
      await apiRequest(connection, path, { method: path.includes("/status") ? "PATCH" : "POST", body: JSON.stringify(body) });
      setNotice(label);
      const refreshed = await refresh(connection, locale, true);
      if (!refreshed) setNotice(label + " · " + ui.refreshAfterSuccess);
      return true;
    } catch (cause) {
      const message = cause instanceof AdminApiError && cause.code === "TIMEOUT"
        ? ui.mutationTimeout
        : describeAdminError(cause, locale);
      if (isAuthorizationError(cause)) resetConnection(message);
      else {
        setDialogError(message);
        setError(message);
      }
      return false;
    } finally {
      operationLock.current = false;
      setBusyId(null);
    }
  }

  async function transitionOrder(order: OrderRecord, status: OrderStatus) {
    await mutate("/admin/orders/" + order.id + "/status", { status }, order.orderNumber + " → " + displayStatus(locale, status), order.id);
  }

  async function submitDialog(values: Record<string, string>) {
    if (!dialog) return;
    let success = false;
    if (dialog.kind === "order-cancel") success = await mutate("/admin/orders/" + dialog.order.id + "/status", { status: "CANCELLED" }, dialog.order.orderNumber + ": " + t.action.cancel, dialog.order.id);
    if (dialog.kind === "cash-collect") success = await mutate("/admin/orders/" + dialog.order.id + "/cash/collect", values, dialog.order.orderNumber + ": " + t.action.collect, dialog.order.id);
    if (dialog.kind === "cash-reconcile") success = await mutate("/admin/orders/" + dialog.order.id + "/cash/reconcile", values, dialog.order.orderNumber + ": " + t.action.reconcile, dialog.order.id);
    if (dialog.kind === "cash-refuse") success = await mutate("/admin/orders/" + dialog.order.id + "/cash/refuse", values, dialog.order.orderNumber + ": " + t.action.refuse, dialog.order.id);
    if (dialog.kind === "proc-confirm") success = await mutate("/admin/procurements/" + dialog.task.id + "/transition", { status: "SUPPLIER_CONFIRMED", ...values }, dialog.task.orderNumber + ": " + t.action.procConfirm, dialog.task.id);
    if (dialog.kind === "proc-unavailable") success = await mutate("/admin/procurements/" + dialog.task.id + "/transition", { status: "SOURCE_UNAVAILABLE", ...values }, dialog.task.orderNumber + ": " + t.action.unavailable, dialog.task.id);
    if (dialog.kind === "proc-cancel") success = await mutate("/admin/procurements/" + dialog.task.id + "/transition", { status: "CANCELLED", ...values }, dialog.task.orderNumber + ": " + t.action.procCancel, dialog.task.id);
    if (dialog.kind === "crawler-resume") success = await mutate("/admin/crawler/resume", values, t.action.resume, "crawler");
    if (success) setDialog(null);
  }

  async function parseFixture(fixture: "book-detail" | "book-price-conflict") {
    if (!connection || operationLock.current || refreshLock.current) return;
    operationLock.current = true;
    setBusyId("crawler");
    setError(null);
    try {
      const result = await apiRequest<unknown>(connection, "/admin/crawler/parse-fixture", { method: "POST", body: JSON.stringify({ fixture }) });
      setLastFixtureResult(result);
      setNotice(fixture + ": parsed by server");
      const refreshed = await refresh(connection, locale, true);
      if (!refreshed) setNotice(fixture + " · " + ui.refreshAfterSuccess);
    } catch (cause) {
      const message = cause instanceof AdminApiError && cause.code === "TIMEOUT"
        ? ui.mutationTimeout
        : describeAdminError(cause, locale);
      if (isAuthorizationError(cause)) resetConnection(message);
      else setError(message);
    } finally {
      operationLock.current = false;
      setBusyId(null);
    }
  }

  async function runCrawler() {
    if (!connection || operationLock.current || refreshLock.current) return;
    operationLock.current = true;
    setBusyId("crawler");
    setError(null);
    try {
      const result = await apiRequest<unknown>(connection, "/admin/crawler/browser-run", { method: "POST" });
      setLastFixtureResult(result);
      setNotice(crawlerRunCopy[locale].started);
      await refresh(connection, locale, true);
    } catch (cause) {
      const message = describeAdminError(cause, locale);
      if (isAuthorizationError(cause)) resetConnection(message);
      else setError(message);
      await refresh(connection, locale, true);
    } finally {
      operationLock.current = false;
      setBusyId(null);
    }
  }

  function disconnect() {
    resetConnection();
  }

  if (!connection || !snapshot) return <ConnectScreen locale={locale} onLocale={setLocale} busy={connecting} error={error} onConnect={connect} />;

  return <div className="admin-modern fixed inset-0 z-[100] flex overflow-hidden bg-[#f4f5fb] font-sans text-[#17182a] antialiased">
    <aside aria-label="Admin navigation" className="hidden h-full w-[78px] shrink-0 flex-col bg-gradient-to-b from-[#173c32] to-[#102d26] px-2.5 py-5 text-white md:flex xl:w-[248px] xl:px-4 xl:py-6"><div className="flex items-center justify-center gap-3 px-1 xl:justify-start xl:px-2"><span className="grid size-9 place-items-center rounded-[10px_10px_10px_3px] bg-[#f4be66] font-serif text-xl font-black text-[#173b31]">L</span><div className="hidden xl:block"><strong className="block font-serif text-xl tracking-wide">LUMI Books</strong><span className="text-[9px] uppercase tracking-wider text-white/40">{t.connect.title}</span></div></div><nav className="mt-7 flex flex-col gap-1">{navigation.map((item) => <button key={item.id} type="button" aria-label={t.nav[item.id]} title={t.nav[item.id]} onClick={() => setSection(item.id)} aria-current={section === item.id ? "page" : undefined} className={`relative flex items-center justify-center gap-3 rounded-xl px-2 py-3 text-left transition xl:justify-start xl:px-3 ${section === item.id ? "bg-white/10 text-white before:absolute before:-left-2.5 before:h-6 before:w-[3px] before:bg-[#f2bc63] xl:before:-left-4" : "text-white/60 hover:bg-white/[.07] hover:text-white"}`}><span aria-hidden="true" className="grid size-5 place-items-center text-base">{item.icon}</span><span className="hidden text-xs font-semibold xl:block">{t.nav[item.id]}</span>{item.id === "procurement" && snapshot.procurements.some((task) => task.status === "PENDING_OPERATOR") ? <i className="absolute right-2 size-2 rounded-full bg-amber-400 xl:ml-auto" aria-label={adminView[locale].pendingTasks} /> : null}</button>)}</nav><div className="mt-auto border-t border-white/10 pt-4"><div className="hidden rounded-xl border border-white/10 bg-black/10 p-3 xl:block"><strong className="block truncate text-[10px]">{connection.baseUrl}</strong><span className="mt-1 block text-[9px] text-white/40">{snapshot.dashboard.persistence}</span></div></div></aside>
    <div className="relative flex min-w-0 flex-1 flex-col"><header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-[#e3e9e6] bg-white/95 px-3 backdrop-blur sm:px-6 lg:px-8"><div className="flex items-center gap-2 md:hidden"><span className="grid size-8 place-items-center rounded-[9px_9px_9px_3px] bg-[#f4be66] font-serif text-base font-black text-[#173b31]">L</span><strong className="font-serif text-lg">LUMI</strong></div><div className="hidden items-center gap-2 text-xs md:flex"><span className="text-[#99a29e]">Admin</span><i className="not-italic text-[#c2c9c6]">/</i><strong>{t.nav[section]}</strong></div><div className="flex items-center gap-2"><LocaleSwitch locale={locale} onChange={changeLocale} disabled={refreshing || busyId !== null} /><button disabled={refreshing || busyId !== null} type="button" aria-label={refreshing ? t.common.refreshing : t.common.refresh} onClick={() => void refresh()} className="grid size-9 place-items-center rounded-xl border border-[#dfe7e1] bg-[#f8fbf9] text-sm text-[#4d5e57] sm:flex sm:w-auto sm:gap-2 sm:px-3 sm:text-[10px] sm:font-bold"><span className={refreshing ? "animate-spin" : ""}>↻</span><span className="hidden lg:inline">{refreshing ? t.common.refreshing : t.common.refresh}</span></button><button disabled={busyId !== null} type="button" onClick={disconnect} aria-label={t.common.disconnect} className="grid size-9 place-items-center rounded-xl border border-[#e2e7e4] bg-white text-[9px] font-bold text-[#66736d] disabled:opacity-50 sm:flex sm:w-auto sm:px-3"><span aria-hidden="true" className="sm:hidden">×</span><span className="hidden sm:inline">{t.common.disconnect}</span></button></div></header>
      <nav aria-label="Admin sections" className="flex min-h-[52px] shrink-0 gap-1 overflow-x-auto border-b border-[#e3e9e6] bg-white px-2 py-1.5 md:hidden">{navigation.map((item) => <button type="button" key={item.id} aria-current={section === item.id ? "page" : undefined} onClick={() => setSection(item.id)} className={`flex min-w-max items-center gap-1.5 rounded-lg px-3 text-[9px] font-bold ${section === item.id ? "bg-[#183d33] text-white" : "text-[#7b8882]"}`}><span aria-hidden="true">{item.icon}</span>{t.nav[item.id]}</button>)}</nav>
      {error ? <div role="alert" className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[10px] text-rose-700 sm:mx-6 lg:mx-8"><span><strong>{t.common.error}:</strong> {error}</span><button type="button" onClick={() => void refresh()} className="shrink-0 font-bold underline">{t.common.retry}</button></div> : null}
      <main className="mx-auto w-full max-w-[1500px] flex-1 overflow-y-auto px-3 py-4 pb-20 sm:px-6 sm:py-6 lg:px-8">
        {refreshing && !snapshot ? <div className="grid min-h-[60vh] place-items-center"><p className="text-xs text-[#7c8983]">{t.common.loading}</p></div> : null}
        {section === "overview" ? <OverviewView snapshot={snapshot} locale={locale} busyId={busyId} onTransition={(order, status) => void transitionOrder(order, status)} onDialog={(action) => { setDialogError(null); setDialog(action); }} go={setSection} /> : null}
        {section === "orders" ? <OrdersView orders={snapshot.orders} locale={locale} busyId={busyId} onTransition={(order, status) => void transitionOrder(order, status)} onDialog={(action) => { setDialogError(null); setDialog(action); }} /> : null}
        {section === "catalog" ? <CatalogView catalog={snapshot.catalog} locale={locale} connection={connection} /> : null}
        {section === "categories" ? <CategoriesView locale={locale} connection={connection} /> : null}
        {section === "procurement" ? <ProcurementView tasks={snapshot.procurements} orders={snapshot.orders} locale={locale} busyId={busyId} onDialog={(action) => { setDialogError(null); setDialog(action); }} /> : null}
        {section === "crawler" ? <CrawlerView crawler={snapshot.crawler} locale={locale} busy={busyId !== null} lastResult={lastFixtureResult} onParse={(fixture) => void parseFixture(fixture)} onRun={() => void runCrawler()} onDialog={(action) => { setDialogError(null); setDialog(action); }} /> : null}
      </main>
      {notice ? <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none absolute bottom-4 right-4 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl bg-[#1a352d]/95 px-4 py-3 text-[10px] text-white shadow-xl"><span className="grid size-5 place-items-center rounded-full bg-emerald-300 font-black text-[#204a3d]">✓</span>{notice}</div> : null}
    </div>
    {dialog ? <ActionDialogView action={dialog} locale={locale} busy={busyId !== null} error={dialogError} onClose={() => { if (!busyId) setDialog(null); }} onSubmit={submitDialog} /> : null}
  </div>;
}
