import type { Locale } from "./i18n";

export const localeMeta = {
  ru: {
    home: { title: "Книги с доставкой по Еревану", description: "Современный книжный магазин на армянском, русском и английском языках." },
    catalog: { title: "Каталог", description: "Книги на трёх языках с доставкой по Еревану." },
    cart: { title: "Корзина", description: "Оформите заказ в LUMI Books с доставкой по Еревану и оплатой при получении." },
    account: { title: "Личный кабинет", description: "LUMI Books — выбирайте книги и оформляйте заказы без регистрации." },
  },
  hy: {
    home: { title: "Գրքեր՝ առաքմամբ Երևանում", description: "Ժամանակակից գրախանութ՝ հայերեն, ռուսերեն և անգլերեն գրքերով։" },
    catalog: { title: "Գրացուցակ", description: "Գրքեր երեք լեզվով՝ առաքմամբ Երևանում։" },
    cart: { title: "Զամբյուղ", description: "Պատվիրեք LUMI Books-ում՝ առաքմամբ Երևանում և վճարմամբ ստանալիս։" },
    account: { title: "Անձնական էջ", description: "LUMI Books․ ընտրեք գրքերը և պատվիրեք առանց գրանցման։" },
  },
  en: {
    home: { title: "Books delivered across Yerevan", description: "A contemporary bookstore with Armenian, Russian and English books." },
    catalog: { title: "Catalog", description: "Books in three languages, delivered across Yerevan." },
    cart: { title: "Cart", description: "Order from LUMI Books with delivery across Yerevan and payment on arrival." },
    account: { title: "Account", description: "LUMI Books — discover books and place orders without registering." },
  },
} as const satisfies Record<Locale, Record<"home" | "catalog" | "cart" | "account", { title: string; description: string }>>;
