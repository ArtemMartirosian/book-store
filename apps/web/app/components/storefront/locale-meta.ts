import type { Locale } from "./i18n";

export const localeMeta = {
  hy: {
    home: { title: "Առցանց գրախանութ Երևանում", description: "Գրքասեր՝ հայերեն, ռուսերեն և անգլերեն գրքեր։ Ընտրեք և պատվիրեք առցանց՝ առաքմամբ Երևանում և կանխիկ վճարմամբ ստանալիս։" },
    catalog: { title: "Գրքերի կատալոգ", description: "Գրքասերի գրացուցակում գտեք գրքեր ըստ հեղինակի, վերնագրի և լեզվի։ Հայերեն, ռուսերեն և անգլերեն գրքեր՝ առաքմամբ Երևանում։" },
    cart: { title: "Զամբյուղ", description: "Ստուգեք ընտրված գրքերը և ձևակերպեք Գրքասերի պատվերը՝ առաքմամբ Երևանում և վճարմամբ ստանալիս։" },
    account: { title: "Անձնական էջ", description: "Ձեր գրքերը, նախընտրելիներն ու պատվերները Գրքասեր առցանց գրախանութում։" },
    favorites: { title: "Նախընտրելի գրքեր", description: "Այս դիտարկիչում պահպանված ձեր նախընտրելի գրքերը Գրքասերում։" },
    search: { title: "Գրքերի ընդլայնված որոնում", description: "Գտեք գիրքը Գրքասերում ըստ անվանման, հեղինակի, ISBN-ի կամ հրատարակչի։" },
    contacts: { title: "Կապ գրախանութի հետ", description: "Գրքասեր առցանց գրախանութի կապի միջոցները։ Հարցեր գրքերի, պատվերի հաստատման և Երևանի առաքման մասին։" },
    information: { title: "Գրքերի պատվեր, առաքում և վճարում", description: "Ինչպես պատվիրել Գրքասերում․ առկայության հաստատում, առաքում Երևանում և կանխիկ վճարում ստանալիս։ Ծանոթացեք պատվերի պայմաններին։" },
  },
  ru: {
    home: { title: "Книжный интернет-магазин в Ереване", description: "Гркасер — книги на армянском, русском и английском языках. Выбирайте книги онлайн с доставкой по Еревану и оплатой наличными при получении." },
    catalog: { title: "Каталог книг", description: "Найдите книгу в каталоге Гркасер по автору, названию и языку. Книги на армянском, русском и английском с доставкой по Еревану." },
    cart: { title: "Корзина", description: "Проверьте выбранные книги и оформите заказ в Гркасер с доставкой по Еревану и оплатой при получении." },
    account: { title: "Личный кабинет", description: "Ваши книги, избранное и заказы в книжном интернет-магазине Гркасер." },
    favorites: { title: "Избранные книги", description: "Книги Гркасер, которые вы сохранили в избранном в этом браузере." },
    search: { title: "Расширенный поиск книг", description: "Найдите книгу в Гркасер по названию, автору, ISBN или издательству." },
    contacts: { title: "Контакты книжного магазина", description: "Как связаться с книжным интернет-магазином Гркасер по вопросам о книгах, подтверждении заказа и доставке по Еревану." },
    information: { title: "Заказ, доставка и оплата книг", description: "Как заказать книги в Гркасер: подтверждение наличия, доставка по Еревану и оплата наличными при получении. Условия оформления заказа." },
  },
  en: {
    home: { title: "Online bookstore in Yerevan", description: "Discover Armenian, Russian and English books at Grqaser. Order books online with delivery across Yerevan and pay cash on delivery." },
    catalog: { title: "Book catalog", description: "Browse Grqaser books by author, title and language. Armenian, Russian and English books available to order with delivery across Yerevan." },
    cart: { title: "Shopping cart", description: "Review your books and place your Grqaser order with delivery across Yerevan and cash payment on arrival." },
    account: { title: "Your account", description: "Your books, favorites and orders at the Grqaser online bookstore." },
    favorites: { title: "Favorite books", description: "Your favorite Grqaser books saved in this browser." },
    search: { title: "Advanced book search", description: "Find books at Grqaser by title, author, ISBN or publisher." },
    contacts: { title: "Contact the bookstore", description: "Contact the Grqaser online bookstore with questions about books, order confirmation and delivery across Yerevan." },
    information: { title: "Book orders, delivery and payment", description: "How to order books at Grqaser: availability confirmation, delivery across Yerevan and cash on delivery. Learn about the ordering process." },
  },
} as const satisfies Record<Locale, Record<"home" | "catalog" | "cart" | "account" | "favorites" | "search" | "contacts" | "information", { title: string; description: string }>>;
