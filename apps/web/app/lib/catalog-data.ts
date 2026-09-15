import type { AdminOrder, Book, CrawlEvent } from "./types";

export const books: Book[] = [
  {
    id: "d1e7c1be-74e2-4c7a-9e9d-4aee1bc12301",
    slug: "narek",
    title: "Մատյան ողբերգության",
    author: "Գրիգոր Նարեկացի",
    category: "Հայ դասական",
    language: "Հայերեն",
    sourcePrice: 5200,
    price: 5700,
    rating: 4.9,
    reviews: 86,
    year: 2024,
    pages: 624,
    binding: "Կոշտ կազմ",
    isbn: "978-9939-68-999-2",
    availability: "observed",
    observedAt: "14 авг., 10:42",
    badge: "Выбор редакции",
    accent: "amber",
    coverLabel: "ՆԱՐԵԿ",
    description:
      "Монументальное произведение армянской духовной литературы в тщательно подготовленном современном издании.",
  },
  {
    id: "29f69fbb-569c-45df-9293-a7f8a31c3331",
    slug: "the-little-prince",
    title: "Маленький принц",
    author: "Антуан де Сент-Экзюпери",
    category: "Классика",
    language: "Русский",
    sourcePrice: 2700,
    price: 3200,
    rating: 4.8,
    reviews: 142,
    year: 2025,
    pages: 112,
    binding: "Твёрдый переплёт",
    isbn: "978-5-17-149999-8",
    availability: "reserved",
    observedAt: "14 авг., 10:38",
    badge: "В наличии",
    accent: "blue",
    coverLabel: "LE PETIT\nPRINCE",
    description:
      "История о дружбе, ответственности и способности видеть главное — издание для домашней библиотеки и подарка.",
  },
  {
    id: "a17da6f2-e994-48d1-a4c4-fbb402f78737",
    slug: "atomic-habits",
    title: "Атомные привычки",
    author: "Джеймс Клир",
    category: "Саморазвитие",
    language: "Русский",
    sourcePrice: 6200,
    price: 6700,
    rating: 4.7,
    reviews: 97,
    year: 2024,
    pages: 304,
    binding: "Твёрдый переплёт",
    isbn: "978-5-04-116577-8",
    availability: "observed",
    observedAt: "14 авг., 10:31",
    badge: "Бестселлер",
    accent: "coral",
    coverLabel: "ATOMIC\nHABITS",
    description:
      "Практическая система небольших изменений, которые помогают выстраивать устойчивые привычки без резких рывков.",
  },
  {
    id: "720a3034-fd32-4d9e-a6a0-78a1bec13404",
    slug: "one-hundred-years",
    title: "Сто лет одиночества",
    author: "Габриэль Гарсиа Маркес",
    category: "Роман",
    language: "Русский",
    sourcePrice: 4500,
    price: 5000,
    rating: 4.9,
    reviews: 118,
    year: 2023,
    pages: 480,
    binding: "Твёрдый переплёт",
    isbn: "978-5-17-090999-1",
    availability: "observed",
    observedAt: "14 авг., 10:29",
    accent: "mint",
    coverLabel: "CIEN AÑOS\nDE SOLEDAD",
    description:
      "Семейная сага, в которой история, память и магическое восприятие мира складываются в единый миф.",
  },
  {
    id: "e6f5c76e-7c93-4c5a-8ca1-05964d913505",
    slug: "sapiens",
    title: "Sapiens. Краткая история человечества",
    author: "Юваль Ной Харари",
    category: "Нон-фикшн",
    language: "Русский",
    sourcePrice: 6900,
    price: 7400,
    rating: 4.6,
    reviews: 73,
    year: 2024,
    pages: 512,
    binding: "Твёрдый переплёт",
    isbn: "978-5-00139-999-9",
    availability: "observed",
    observedAt: "14 авг., 10:22",
    badge: "Популярное",
    accent: "sand",
    coverLabel: "SAPIENS",
    description:
      "Большой обзор ключевых поворотов человеческой истории — от когнитивной революции до технологического настоящего.",
  },
  {
    id: "51e3034d-eec6-4f3c-81c6-f91043a13606",
    slug: "creative-act",
    title: "The Creative Act",
    author: "Rick Rubin",
    category: "Творчество",
    language: "English",
    sourcePrice: 8800,
    price: 9300,
    rating: 4.7,
    reviews: 44,
    year: 2023,
    pages: 432,
    binding: "Hardcover",
    isbn: "978-0-593-65588-6",
    availability: "observed",
    observedAt: "14 авг., 10:18",
    badge: "На английском",
    accent: "violet",
    coverLabel: "THE\nCREATIVE\nACT",
    description:
      "A thoughtful collection of observations about attention, practice, and the conditions that help creative work emerge.",
  },
  {
    id: "99ce814c-53e2-4ced-9874-01d36a713707",
    slug: "nineteen-eighty-four",
    title: "1984",
    author: "Джордж Оруэлл",
    category: "Антиутопия",
    language: "Русский",
    sourcePrice: 3100,
    price: 3600,
    rating: 4.8,
    reviews: 205,
    year: 2025,
    pages: 352,
    binding: "Мягкая обложка",
    isbn: "978-5-17-150198-1",
    availability: "observed",
    observedAt: "14 авг., 10:12",
    accent: "coral",
    coverLabel: "1984",
    description:
      "Классический роман о языке, власти и хрупкости личной свободы в мире тотального наблюдения.",
  },
  {
    id: "4ad0fc5d-3739-49b7-84fa-11d895a13808",
    slug: "the-stranger",
    title: "Посторонний",
    author: "Альбер Камю",
    category: "Классика",
    language: "Русский",
    sourcePrice: 2800,
    price: 3300,
    rating: 4.6,
    reviews: 64,
    year: 2024,
    pages: 192,
    binding: "Мягкая обложка",
    isbn: "978-5-17-112811-9",
    availability: "unavailable",
    observedAt: "14 авг., 09:58",
    accent: "blue",
    coverLabel: "L'ÉTRANGER",
    description:
      "Лаконичный роман о человеке перед лицом общественных ожиданий, случайности и абсурда.",
  },
];

export const catalogLanguageDefinitions = [
  { slug: "hy", value: "Հայերեն" },
  { slug: "ru", value: "Русский" },
  { slug: "en", value: "English" },
] as const;

export const catalogCategoryDefinitions = [
  { slug: "classics", value: "Классика" },
  { slug: "self-development", value: "Саморазвитие" },
  { slug: "novel", value: "Роман" },
  { slug: "non-fiction", value: "Нон-фикшн" },
  { slug: "creativity", value: "Творчество" },
  { slug: "dystopia", value: "Антиутопия" },
  { slug: "armenian-classics", value: "Հայ դասական" },
] as const;

export const storefrontFacets = [
  { slug: "hy", kind: "language", value: "Հայերեն", accent: "amber", symbol: "Ա" },
  { slug: "ru", kind: "language", value: "Русский", accent: "coral", symbol: "Я" },
  { slug: "en", kind: "language", value: "English", accent: "blue", symbol: "Aa" },
  { slug: "classics", kind: "category", value: "Классика", accent: "mint", symbol: "∞" },
  { slug: "self-development", kind: "category", value: "Саморазвитие", accent: "violet", symbol: "↗" },
  { slug: "non-fiction", kind: "category", value: "Нон-фикшн", accent: "sand", symbol: "✦" },
] as const;

export function booksForFacet(facet: (typeof storefrontFacets)[number]) {
  return books.filter((book) => facet.kind === "language" ? book.language === facet.value : book.category === facet.value);
}

export function newestBooks(limit = 5) {
  return [...books].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (b.rating ?? 0) - (a.rating ?? 0)).slice(0, limit);
}

export function popularBooks(limit = 5) {
  return [...books]
    .sort((a, b) => (b.rating ?? 0) * Math.log10((b.reviews ?? 0) + 10) - (a.rating ?? 0) * Math.log10((a.reviews ?? 0) + 10))
    .slice(0, limit);
}

export const adminOrders: AdminOrder[] = [
  { id: "#1048", customer: "Анна Мартиросян", items: 2, total: 9900, status: "Новая заявка", procurement: "Ожидает", createdAt: "10:36", zone: "Кентрон" },
  { id: "#1047", customer: "Давид Саркисян", items: 1, total: 8400, status: "Проверка", procurement: "Ожидает", createdAt: "10:11", zone: "Арабкир" },
  { id: "#1046", customer: "Мария Григорян", items: 3, total: 16100, status: "Закупка", procurement: "Подтверждено", createdAt: "09:42", zone: "Нор Норк" },
  { id: "#1045", customer: "Arman Petrosyan", items: 2, total: 11700, status: "У курьера", procurement: "Подтверждено", createdAt: "Вчера", zone: "Давташен" },
  { id: "#1044", customer: "Լիլիթ Ավետիսյան", items: 1, total: 6700, status: "Доставлен", procurement: "Не требуется", createdAt: "Вчера", zone: "Кентрон" },
];

export const crawlEvents: CrawlEvent[] = [
  { id: "cr_7191", url: "/am/narek-2024", stage: "published", status: 200, observedAt: "10:42", note: "Цена обновлена: 5 200 AMD" },
  { id: "cr_7190", url: "/ru/atomic-habits", stage: "fetched", status: 200, observedAt: "10:31", note: "DOM без изменений" },
  { id: "cr_7189", url: "/en/creative-act", stage: "quarantine", status: 200, observedAt: "10:18", note: "Не найден вес — требуется проверка" },
  { id: "cr_7188", url: "/ru/the-stranger", stage: "published", status: 200, observedAt: "09:58", note: "Недоступно для заказа" },
];

export function formatAmd(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ֏`;
}

export function getBookBySlug(slug: string) {
  return books.find((book) => book.slug === slug);
}
