"use client";

import Link from "next/link";
import { useStorefront } from "./StorefrontShell";
import { localized } from "./i18n";
import { container, cx, eyebrow, sectionTitle } from "./ui";

const accountCopy = {
  ru: { overline: "Для читателя", title: "Ваш книжный уголок.", intro: "Избранное и корзина доступны в этом браузере. Чтобы оформить заказ, регистрация не нужна.", favorites: "Избранное", favoritesHint: "Книги, которые вы сохранили на потом.", cart: "Корзина", cartHint: "Проверьте выбранные книги и оформите заказ.", catalog: "Найти новую книгу", catalogHint: "Знакомые авторы, новые истории и издания на трёх языках.", notice: "Доставляем по Еревану за 1 000 ֏. Оплата наличными при получении. Наличие и детали доставки подтвердим при обработке заказа.", browser: "Корзина и избранное не синхронизируются между устройствами и могут очиститься при удалении данных браузера." },
  hy: { overline: "Ընթերցողի համար", title: "Ձեր գրքային անկյունը։", intro: "Նախընտրած գրքերն ու զամբյուղը հասանելի են այս դիտարկիչում։ Պատվեր ձևակերպելու համար գրանցում պետք չէ։", favorites: "Նախընտրած գրքեր", favoritesHint: "Գրքեր, որոնք պահել եք հետագայի համար։", cart: "Զամբյուղ", cartHint: "Ստուգեք ընտրված գրքերն ու ձևակերպեք պատվերը։", catalog: "Գտնել նոր գիրք", catalogHint: "Ծանոթ հեղինակներ, նոր պատմություններ և հրատարակություններ երեք լեզվով։", notice: "Առաքում ենք Երևանում՝ 1 000 ֏ արժեքով։ Վճարումը՝ կանխիկ, ստանալիս։ Առկայությունն ու առաքման մանրամասները կհաստատենք պատվերը մշակելիս։", browser: "Զամբյուղն ու նախընտրած գրքերը չեն համաժամեցվում սարքերի միջև և կարող են ջնջվել դիտարկիչի տվյալները մաքրելիս։" },
  en: { overline: "For readers", title: "Your book corner.", intro: "Your favorites and cart are available in this browser. No registration is needed to place an order.", favorites: "Favorites", favoritesHint: "The books you have saved for later.", cart: "Shopping cart", cartHint: "Review your selected books and place an order.", catalog: "Find your next book", catalogHint: "Familiar authors, new stories and editions in three languages.", notice: "Delivery across Yerevan is 1,000 ֏. Pay cash on delivery. We confirm availability and delivery details while processing your order.", browser: "Your cart and favorites do not sync between devices and may be cleared when you delete browser data." },
} as const;

export function AccountPage() {
  const { locale, favorites, cartCount } = useStorefront();
  const t = accountCopy[locale];
  const links = [
    { path: "/favorites", title: t.favorites, text: t.favoritesHint, icon: "♡", count: favorites.length },
    { path: "/cart", title: t.cart, text: t.cartHint, icon: "↗", count: cartCount },
    { path: "/catalog", title: t.catalog, text: t.catalogHint, icon: "⌕", count: null },
  ];

  return (
    <div className="min-h-[70vh] bg-[#f7f8fc] py-12 text-[#18192d] max-sm:py-7">
      <div className={container}>
        <section className="overflow-hidden rounded-[20px] border border-[#e3e5ef] bg-[#f0eeff] p-10 max-sm:p-6">
          <span className={cx(eyebrow, "text-[#6258ff]")}>{t.overline}</span>
          <h1 className={cx(sectionTitle, "my-5 max-w-[800px] text-[#18192d]")}>{t.title}</h1>
          <p className="max-w-[640px] text-base leading-8 text-[#727789]">{t.intro}</p>
        </section>
        <nav className="mt-8 grid grid-cols-3 gap-5 max-lg:grid-cols-1" aria-label={t.overline}>
          {links.map((link) => <Link className="group flex min-h-56 flex-col rounded-2xl border border-[#e3e5ef] bg-[#ffffff] p-7 transition duration-200 hover:border-[#b4adff] hover:bg-[#f0eeff]/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6258ff]" href={localized(locale, link.path)} key={link.path}>
            <div className="flex items-center justify-between"><span className="grid size-12 place-items-center rounded-full border border-[#e3e5ef] text-2xl text-[#6258ff]" aria-hidden="true">{link.icon}</span>{link.count !== null ? <span className="font-display text-3xl font-normal text-[#6258ff]">{link.count}</span> : null}</div>
            <h2 className="font-display mt-6 text-2xl font-normal tracking-[-.02em] group-hover:text-[#6258ff]">{link.title}</h2><p className="mt-2 text-sm leading-6 text-[#727789]">{link.text}</p>
          </Link>)}
        </nav>
        <p className="mt-9 max-w-[900px] border-t border-[#e3e5ef] pt-6 text-sm leading-7 text-[#727789]">{t.notice}</p>
        <p className="mt-3 max-w-[900px] text-sm leading-6 text-[#727789]">{t.browser}</p>
      </div>
    </div>
  );
}
