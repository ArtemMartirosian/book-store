import type { Locale } from "./i18n";

export const localeMeta = {
  ru: {
    home: { title: "Книги с доставкой по Еревану", description: "Современный книжный магазин на армянском, русском и английском языках." },
    catalog: { title: "Каталог", description: "Книги на трёх языках с доставкой по Еревану." },
    cart: { title: "Корзина", description: "Проверьте книги, доставку и оставьте заявку LUMI." },
    account: { title: "Личный кабинет", description: "Заказы, сохранённые книги и контакты покупателя LUMI." },
  },
  hy: {
    home: { title: "Գրքեր՝ առաքմամբ Երևանում", description: "Ժամանակակից գրախանութ՝ հայերեն, ռուսերեն և անգլերեն գրքերով։" },
    catalog: { title: "Գրացուցակ", description: "Գրքեր երեք լեզվով՝ առաքմամբ Երևանում։" },
    cart: { title: "Զամբյուղ", description: "Ստուգեք գրքերը, առաքումը և ուղարկեք LUMI հայտը։" },
    account: { title: "Անձնական էջ", description: "LUMI պատվերներ, պահպանված գրքեր և կոնտակտներ։" },
  },
  en: {
    home: { title: "Books delivered across Yerevan", description: "A contemporary bookstore with Armenian, Russian and English books." },
    catalog: { title: "Catalog", description: "Books in three languages, delivered across Yerevan." },
    cart: { title: "Cart", description: "Review your books and delivery details before sending a LUMI request." },
    account: { title: "Account", description: "Your LUMI orders, saved books and contact details." },
  },
} as const satisfies Record<Locale, Record<"home" | "catalog" | "cart" | "account", { title: string; description: string }>>;
