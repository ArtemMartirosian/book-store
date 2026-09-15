import type { OrderRecord } from './order.model';

const ORDER_REQUEST_NOTICES: Readonly<Record<OrderRecord['locale'], string>> = {
  hy: 'Պատվերը ստացվել է։ Մենք կկապվենք ձեզ հետ՝ գրքերի առկայությունն ու ընտրված հրատարակությունը հաստատելու համար։ Վճարումը՝ կանխիկ, ստանալու պահին։',
  ru: 'Заказ получен. Мы свяжемся с вами, чтобы подтвердить наличие и точное издание. Оплата наличными при получении.',
  en: 'We have received your order. We will contact you to confirm availability and the exact edition. Pay in cash on delivery.',
};

export const getOrderRequestNotice = (locale: OrderRecord['locale']): string =>
  ORDER_REQUEST_NOTICES[locale];
