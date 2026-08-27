import { getOrderRequestNotice } from './order-notices';

describe('getOrderRequestNotice', () => {
  it.each([
    [
      'hy',
      'Սա հայտ է։ Առկայությունը և կոնկրետ հրատարակությունը օպերատորը կհաստատի մինչև գնումը։ Վճարումը՝ ստանալու պահին։',
    ],
    [
      'ru',
      'Это заявка. Наличие и точное издание будут подтверждены оператором до закупки. Оплата — при получении.',
    ],
    [
      'en',
      'This is a request. An operator will confirm availability and the exact edition before purchase. Payment is due on delivery.',
    ],
  ] as const)('returns the %s purchase-request notice', (locale, expected) => {
    expect(getOrderRequestNotice(locale)).toBe(expected);
  });
});
