import { ConfigService } from '@nestjs/config';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import {
  type CrawlerFetch,
  CrawlerHttpFetcherService,
} from './crawler-http-fetcher.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';

const configWith = (overrides: Record<string, unknown> = {}): ConfigService => {
  const values: Record<string, unknown> = {
    NODE_ENV: 'production',
    CRAWLER_LIVE_ENABLED: true,
    CRAWLER_WRITTEN_PERMISSION: true,
    CRAWLER_DAILY_REQUEST_BUDGET: 20,
    CRAWLER_MIN_REQUEST_DELAY_MS: 0,
    CRAWLER_REQUEST_TIMEOUT_MS: 1_000,
    CRAWLER_MAX_RESPONSE_BYTES: 1_024,
    CRAWLER_MAX_REDIRECTS: 1,
    CRAWLER_USER_AGENT: 'LUMIBooksCatalogBot/test (+mailto:test@lumi.am)',
    ...overrides,
  };
  return {
    get: <T>(key: string, fallback: T): T => (values[key] as T | undefined) ?? fallback,
  } as unknown as ConfigService;
};

const createFetcher = (
  transport: CrawlerFetch,
  overrides: Record<string, unknown> = {},
) => {
  const config = configWith(overrides);
  const killSwitch = new CrawlerKillSwitchService();
  const budget = new CrawlerRequestBudgetService(config);
  return {
    killSwitch,
    budget,
    fetcher: new CrawlerHttpFetcherService(
      config,
      budget,
      killSwitch,
      new CrawlerSitemapPolicyService(),
      new CrawlerUrlPolicyService(config),
      new CrawlerChallengeDetectorService(),
      transport,
    ),
  };
};

const consume = async (body: AsyncIterable<Uint8Array> | null): Promise<number> => {
  let bytes = 0;
  if (!body) return bytes;
  for await (const chunk of body) bytes += chunk.byteLength;
  return bytes;
};

describe('CrawlerHttpFetcherService', () => {
  it('uses an identifiable cookie-free manual request and conditional headers', async () => {
    const transport = jest.fn(
      async (_input: string, _init: RequestInit): Promise<Response> =>
        new Response('<urlset />', {
          status: 200,
          headers: { 'content-type': 'application/xml', etag: '"v2"' },
        }),
    );
    const { fetcher } = createFetcher(transport);
    const result = await fetcher.fetch(
      'https://www.books.am/pub/sitemap/sitemap_hy.xml',
      'SITEMAP_XML',
      { etag: '"v1"', lastModified: 'Wed, 01 Jan 2025 00:00:00 GMT' },
    );

    const init = transport.mock.calls[0]?.[1];
    const headers = new Headers(init?.headers);
    expect(init).toMatchObject({
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
    });
    expect(headers.get('user-agent')).toContain('LUMIBooksCatalogBot');
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('if-none-match')).toBe('"v1"');
    expect(headers.get('if-modified-since')).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
    expect(await consume(result.body)).toBeGreaterThan(0);
  });

  it('latches immediately on upstream 403', async () => {
    const { fetcher, killSwitch } = createFetcher(async () =>
      new Response('forbidden', { status: 403, headers: { 'content-type': 'text/html' } }),
    );
    await expect(
      fetcher.fetch('https://www.books.am/am/example.html', 'PRODUCT_HTML'),
    ).rejects.toBeDefined();
    expect(killSwitch.getState()).toMatchObject({
      engaged: true,
      reason: 'UPSTREAM_HTTP_403',
    });
  });

  it('latches on a challenge document masquerading as a sitemap', async () => {
    const { fetcher, killSwitch } = createFetcher(async () =>
      new Response('<html><title>Just a moment...</title></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    await expect(
      fetcher.fetch(
        'https://www.books.am/pub/sitemap/sitemap_en.xml',
        'SITEMAP_XML',
      ),
    ).rejects.toBeDefined();
    expect(killSwitch.getState().reason).toBe('UPSTREAM_CHALLENGE_DETECTED');
  });

  it('enforces the response byte ceiling while streaming', async () => {
    const { fetcher } = createFetcher(
      async () =>
        new Response('x'.repeat(1_025), {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      { CRAWLER_MAX_RESPONSE_BYTES: 1_024 },
    );
    const result = await fetcher.fetch(
      'https://www.books.am/am/example.html',
      'PRODUCT_HTML',
    );
    await expect(consume(result.body)).rejects.toBeDefined();
  });

  it('rejects a redirect outside the allowlist', async () => {
    const { fetcher } = createFetcher(async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'https://example.com/escape.html' },
      }),
    );
    await expect(
      fetcher.fetch('https://www.books.am/am/example.html', 'PRODUCT_HTML'),
    ).rejects.toBeDefined();
  });

  it('spends the daily budget before each HTTP attempt', async () => {
    const transport = jest.fn(
      async () =>
        new Response('<html />', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
    );
    const { fetcher } = createFetcher(transport, {
      CRAWLER_DAILY_REQUEST_BUDGET: 1,
    });
    const first = await fetcher.fetch(
      'https://www.books.am/am/example.html',
      'PRODUCT_HTML',
    );
    await consume(first.body);
    await expect(
      fetcher.fetch('https://www.books.am/am/second.html', 'PRODUCT_HTML'),
    ).rejects.toBeDefined();
    expect(transport).toHaveBeenCalledTimes(1);
  });
});
