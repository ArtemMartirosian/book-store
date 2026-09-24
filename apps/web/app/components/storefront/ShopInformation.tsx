import Link from "next/link";
import { brandName, BRAND_DESCRIPTIONS } from "../../lib/brand";
import { getShopInfo } from "../../lib/shop-info.mjs";
import { localized, type Locale } from "./i18n";
import { container, cx } from "./ui";

const copy = {
  ru: {
    contacts: "Связь с магазином «Гркасер»", information: "О заказе и доставке",
    contactIntro: "Вопрос о книге или заказе? Используйте доступные способы связи ниже.",
    noContacts: "После отправки заказа мы свяжемся с вами по указанному номеру, чтобы подтвердить книги и доставку.",
    phone: "Телефон", email: "Электронная почта", hours: "Часы ответа",
    order: "Как оформить заказ", orderText: "Выберите книги, добавьте их в корзину и укажите имя, телефон и адрес в Ереване. Регистрация не нужна.",
    confirmation: "Подтверждение", confirmationText: "Наличие и точное издание подтверждаются при обработке заказа. Итоговая сумма видна в корзине; изменение цены требует вашего подтверждения.",
    delivery: "Доставка и оплата", deliveryText: "Доставляем по Еревану. Стоимость доставки показана отдельно в корзине, время согласуем по телефону. Оплата наличными при получении.",
    data: "Данные для заказа", dataText: "Имя, телефон, адрес и комментарий отправляются вместе с заказом для его обработки и доставки. Корзина и избранное сохраняются в этом браузере. Незавершённая отправка заказа также сохраняется здесь до получения результата, чтобы можно было повторить запрос после обрыва связи.",
    documents: "Документы магазина", terms: "Условия продажи", privacy: "Конфиденциальность", returns: "Условия возврата",
    catalog: "Выбрать книги", cart: "Перейти в корзину",
  },
  hy: {
    contacts: "Կապ Գրքասերի հետ", information: "Պատվեր և առաքում",
    contactIntro: "Հարց ունե՞ք գրքի կամ պատվերի մասին։ Օգտագործեք ստորև նշված կապի միջոցները։",
    noContacts: "Պատվերն ուղարկելուց հետո կկապվենք նշված հեռախոսահամարով՝ գրքերն ու առաքումը հաստատելու համար։",
    phone: "Հեռախոս", email: "Էլեկտրոնային փոստ", hours: "Պատասխանի ժամեր",
    order: "Ինչպես պատվիրել", orderText: "Ընտրեք գրքերը, ավելացրեք զամբյուղ և նշեք անունը, հեռախոսահամարն ու Երևանի հասցեն։ Գրանցում պետք չէ։",
    confirmation: "Հաստատում", confirmationText: "Առկայությունն ու ճշգրիտ հրատարակությունը հաստատվում են պատվերը մշակելիս։ Վերջնական գումարը երևում է զամբյուղում, իսկ գնի փոփոխությունը պահանջում է ձեր հաստատումը։",
    delivery: "Առաքում և վճարում", deliveryText: "Առաքում ենք Երևանում։ Առաքման արժեքը զամբյուղում նշվում է առանձին, իսկ ժամը համաձայնեցնում ենք հեռախոսով։ Վճարումը՝ կանխիկ, ստանալիս։",
    data: "Պատվերի տվյալները", dataText: "Անունը, հեռախոսը, հասցեն և մեկնաբանությունն ուղարկվում են պատվերի հետ՝ այն մշակելու և առաքելու համար։ Զամբյուղն ու նախընտրելիները պահվում են այս դիտարկիչում։ Անավարտ հարցումը նույնպես պահվում է այստեղ մինչև արդյունքը ստանալը՝ կապի ընդհատումից հետո այն կրկնելու համար։",
    documents: "Խանութի փաստաթղթեր", terms: "Վաճառքի պայմաններ", privacy: "Գաղտնիություն", returns: "Վերադարձի պայմաններ",
    catalog: "Ընտրել գրքեր", cart: "Գնալ զամբյուղ",
  },
  en: {
    contacts: "Contact Grqaser", information: "Ordering and delivery",
    contactIntro: "Have a question about a book or an order? Use the available contact options below.",
    noContacts: "After you place an order, we will contact you on the number you provide to confirm your books and delivery.",
    phone: "Phone", email: "Email", hours: "Response hours",
    order: "How to order", orderText: "Choose your books, add them to your cart and enter your name, phone number and Yerevan address. No registration is needed.",
    confirmation: "Confirmation", confirmationText: "Availability and the exact edition are confirmed when your order is processed. The total is shown in your cart; a price change requires your confirmation.",
    delivery: "Delivery and payment", deliveryText: "We deliver across Yerevan. The delivery fee is shown separately in your cart, and the delivery time is agreed by phone. Payment is in cash on delivery.",
    data: "Order details", dataText: "Your name, phone number, address and comment are sent with your order for processing and delivery. Your cart and favorites are saved in this browser. An unfinished order request is also stored here until its result is confirmed so it can be retried after a lost connection.",
    documents: "Store documents", terms: "Terms of sale", privacy: "Privacy", returns: "Returns policy",
    catalog: "Browse books", cart: "Go to cart",
  },
} as const;

const helpCopy = {
  hy: { about: "Գրքասերի մասին", faq: "Հաճախ տրվող հարցեր", questions: ["Պե՞տք է գրանցվել պատվիրելու համար։", "Ինչպե՞ս է հաստատվում պատվերը։", "Ինչպե՞ս վճարել և ստանալ գրքերը։"] },
  ru: { about: "О магазине «Гркасер»", faq: "Частые вопросы", questions: ["Нужно ли регистрироваться для заказа?", "Как подтверждается заказ?", "Как оплатить и получить книги?"] },
  en: { about: "About Grqaser", faq: "Frequently asked questions", questions: ["Do I need an account to order?", "How is my order confirmed?", "How do payment and delivery work?"] },
} as const;

export function shopInformationTitle(locale: Locale, section: "contacts" | "information") {
  return copy[locale][section];
}

export function ShopInformation({ locale, section }: { locale: Locale; section: "contacts" | "information" }) {
  const t = copy[locale];
  const help = helpCopy[locale];
  const info = getShopInfo(process.env);
  const contacts = [
    ...(info.phone ? [{ title: t.phone, ...info.phone }] : []),
    ...(info.email ? [{ title: t.email, ...info.email }] : []),
    ...(info.telegram ? [{ title: "Telegram", label: "Telegram ↗", href: info.telegram }] : []),
    ...(info.whatsapp ? [{ title: "WhatsApp", label: "WhatsApp ↗", href: info.whatsapp }] : []),
  ];
  return (
    <section className={cx(container, "min-h-[70vh] py-14 pb-20 text-[#18192d] max-sm:py-9")}>
      <p className="text-xs font-medium uppercase tracking-[.18em] text-[#6258ff]">{brandName(locale)}</p>
      <h1 className="font-display mt-5 max-w-4xl text-[clamp(2.6rem,5vw,4.5rem)] font-normal leading-[1.08] tracking-[-.03em]">{t[section]}</h1>
      {section === "contacts" ? <>
        <p className="mt-6 max-w-2xl text-base leading-7 text-[#727789]">{contacts.length ? t.contactIntro : t.noContacts}</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {contacts.map(({ title, label, href }) => <a key={href} href={href} className="rounded-2xl border border-[#e3e5ef] bg-[#ffffff] p-7 transition hover:border-[#b4adff] hover:bg-[#f0eeff]/40"><span className="block text-sm text-[#727789]">{title}</span><strong className="mt-3 block break-all text-xl font-medium text-[#6258ff]">{label}</strong></a>)}
        </div>
        {info.hours && <p className="mt-6 text-base"><strong>{t.hours}: </strong>{info.hours}</p>}
      </> : <>
        <article id="about" className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-7 max-sm:p-6">
          <h2 className="text-2xl font-bold tracking-[-.03em]">{help.about}</h2>
          <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--muted)]">{BRAND_DESCRIPTIONS[locale]}</p>
        </article>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {(["order", "confirmation", "delivery", "data"] as const).map((key) => <article id={key} key={key} className="rounded-2xl border border-[#e3e5ef] bg-white p-7 max-sm:p-6"><h2 className="font-display text-2xl font-bold tracking-[-.02em]">{t[key]}</h2><p className="mt-4 text-base leading-8 text-[#727789]">{t[(key + "Text") as "orderText" | "confirmationText" | "deliveryText" | "dataText"]}</p></article>)}
        </div>
        <section id="faq" className="mt-10 rounded-2xl border border-[var(--line)] bg-white p-7 max-sm:p-6">
          <h2 className="mb-5 text-2xl font-bold tracking-[-.03em]">{help.faq}</h2>
          {help.questions.map((question, index) => <details key={question} className="border-t border-[var(--line)] py-4"><summary className="min-h-11 cursor-pointer py-2 text-base font-semibold">{question}</summary><p className="max-w-3xl py-3 text-base leading-8 text-[var(--muted)]">{[t.orderText, t.confirmationText, t.deliveryText][index]}</p></details>)}
        </section>
      </>}
      {info.documents.length > 0 && <section className="mt-10"><h2 className="font-display text-2xl font-normal tracking-[-.02em]">{t.documents}</h2><div className="mt-3 flex flex-wrap gap-4">{info.documents.map(({ kind, url }) => <a className="inline-flex min-h-11 items-center text-base text-[#6258ff] underline" href={url!} key={kind}>{t[kind as "terms" | "privacy" | "returns"]} ↗</a>)}</div></section>}
      <nav className="mt-10 flex flex-wrap gap-4 border-t border-[#e3e5ef] pt-7">
        <Link className="inline-flex min-h-12 items-center rounded-xl bg-[#6258ff] px-6 text-sm font-medium text-white transition hover:bg-[#5147e2]" href={localized(locale, "/catalog")}>{t.catalog}</Link>
        <Link className="inline-flex min-h-12 items-center rounded-xl border border-[#e3e5ef] bg-[#ffffff] px-6 text-sm font-medium transition hover:bg-[#f0eeff]" href={localized(locale, "/cart")}>{t.cart}</Link>
        <Link className="inline-flex min-h-12 items-center px-2 text-base text-[#6258ff] underline" href={localized(locale, section === "contacts" ? "/information" : "/contacts")}>{section === "contacts" ? t.information : t.contacts}</Link>
      </nav>
    </section>
  );
}
