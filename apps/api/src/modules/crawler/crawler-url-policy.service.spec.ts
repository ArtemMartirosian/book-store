import { ConfigService } from '@nestjs/config';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';

describe('CrawlerUrlPolicyService', () => {
  const config = {
    get: <T>(_key: string, fallback: T): T => fallback,
  } as unknown as ConfigService;
  const policy = new CrawlerUrlPolicyService(config);

  it('allows only HTTPS Books.am locale SEO product pages', () => {
    expect(policy.evaluate('https://books.am/am/example-book.html')).toMatchObject({
      eligible: true,
      normalizedUrl: 'https://www.books.am/am/example-book.html',
    });
  });

  it.each([
    'http://www.books.am/am/example.html',
    'https://shop.books.am/am/example.html',
    'https://www.books.am/catalog/product/view/id/123',
    'https://www.books.am/am/example.html?tracking=1',
    'https://www.books.am/customer/account.html',
    'https://www.books.am/am/not-a-product',
  ])('rejects unsafe URL %s', (url) => {
    expect(policy.evaluate(url).eligible).toBe(false);
  });
});
