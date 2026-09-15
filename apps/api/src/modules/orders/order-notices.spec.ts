import { getOrderRequestNotice } from './order-notices';

describe('getOrderRequestNotice', () => {
  it.each([
    [
      'hy',
      'Պատվերը ստացվել է։ Մենք կկապվենք ձեզ հետ՝ գրքերի առկայությունն ու ընտրված հրատարակությունը հաստատելու համար։ Վճարումը՝ կանխիկ, ստանալու պահին։',
    ],
    [
      'ru',
      'Заказ получен. Мы свяжемся с вами, чтобы подтвердить наличие и точное издание. Оплата наличными при получении.',
    ],
    [
      'en',
      'We have received your order. We will contact you to confirm availability and the exact edition. Pay in cash on delivery.',
    ],
  ] as const)('returns the %s store order notice', (locale, expected) => {
    expect(getOrderRequestNotice(locale)).toBe(expected);
  });
});
