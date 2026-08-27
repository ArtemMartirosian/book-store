import type { OrderRecord } from './order.model';

const ORDER_REQUEST_NOTICES: Readonly<Record<OrderRecord['locale'], string>> = {
  hy: 'Սա հայտ է։ Առկայությունը և կոնկրետ հրատարակությունը օպերատորը կհաստատի մինչև գնումը։ Վճարումը՝ ստանալու պահին։',
  ru: 'Это заявка. Наличие и точное издание будут подтверждены оператором до закупки. Оплата — при получении.',
  en: 'This is a request. An operator will confirm availability and the exact edition before purchase. Payment is due on delivery.',
};

export const getOrderRequestNotice = (locale: OrderRecord['locale']): string =>
  ORDER_REQUEST_NOTICES[locale];
