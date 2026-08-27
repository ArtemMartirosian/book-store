import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BooksHtmlParserService } from './books-html-parser.service';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import { CrawlerHttpFetcherService } from './crawler-http-fetcher.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerPipelineService } from './crawler-pipeline.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import { InMemoryCrawlerSnapshotRepository } from './crawler-snapshot.repository';
import type { CrawlerFetchedDocument } from './crawler.types';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';
import { CrawlerXmlDiscoveryService } from './crawler-xml-discovery.service';

const stream = async function* (value: string): AsyncIterable<Uint8Array> {
  yield new TextEncoder().encode(value);
};

const document = (
  url: string,
  contentType: string,
  value: string,
): CrawlerFetchedDocument => ({
  requestedUrl: url,
  finalUrl: url,
  status: 200,
  contentType,
  etag: null,
  lastModified: null,
  body: stream(value),
  redirectCount: 0,
});

const notModified = (url: string): CrawlerFetchedDocument => ({
  requestedUrl: url,
  finalUrl: url,
  status: 304,
  contentType: null,
  etag: null,
  lastModified: null,
  body: null,
  redirectCount: 0,
});

describe('CrawlerPipelineService', () => {
  it('normalizes a mocked fixture observation through a bounded child sitemap index', async () => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'production',
      CRAWLER_LIVE_ENABLED: true,
      CRAWLER_WRITTEN_PERMISSION: true,
      CRAWLER_DAILY_REQUEST_BUDGET: 20,
      CRAWLER_MAX_SITEMAP_URLS: 20,
      CRAWLER_MAX_PRODUCTS_PER_RUN: 5,
      CRAWLER_MAX_CHILD_SITEMAPS_PER_RUN: 2,
    };
    const config = {
      get: <T>(key: string, fallback: T): T => (values[key] as T | undefined) ?? fallback,
    } as unknown as ConfigService;
    const fixture = readFileSync(join(__dirname, 'fixtures', 'book-detail.html'), 'utf8');
    const fetcher = {
      fetch: jest.fn(async (url: string, kind: string) => {
        if (kind === 'PRODUCT_HTML') return document(url, 'text/html', fixture);
        if (url.endsWith('sitemap_hy.xml')) {
          return document(
            url,
            'application/xml',
            '<sitemapindex><sitemap><loc>https://www.books.am/pub/sitemap/catalog_hy_books.xml</loc></sitemap></sitemapindex>',
          );
        }
        if (url.endsWith('catalog_hy_books.xml')) {
          return document(
            url,
            'application/xml',
            '<urlset><url><loc>https://www.books.am/am/fixture-book-detail.html</loc></url></urlset>',
          );
        }
        return document(url, 'application/xml', '<urlset />');
      }),
    } as unknown as CrawlerHttpFetcherService;
    const killSwitch = new CrawlerKillSwitchService();
    const snapshots = new InMemoryCrawlerSnapshotRepository();
    const pipeline = new CrawlerPipelineService(
      config,
      new CrawlerUrlPolicyService(config),
      new CrawlerSitemapPolicyService(),
      fetcher,
      new CrawlerXmlDiscoveryService(),
      new BooksHtmlParserService(),
      new CrawlerChallengeDetectorService(),
      killSwitch,
      new CrawlerRequestBudgetService(config),
      snapshots,
    );

    const result = await pipeline.runOnce();

    expect(result).toMatchObject({
      childSitemapsQueued: 1,
      sitemapsFetched: 4,
      productsAttempted: 1,
      normalized: 1,
      quarantined: 0,
    });
    const recent = await snapshots.listRecent(10);
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({
      outcome: 'NORMALIZED',
      snapshot: { supplierSku: 'FIXTURE-HY-001', sourcePriceAmd: 3800 },
    });
  });

  it('refuses live execution outside production before using the fetch adapter', async () => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'test',
      CRAWLER_LIVE_ENABLED: true,
      CRAWLER_WRITTEN_PERMISSION: true,
      CRAWLER_DAILY_REQUEST_BUDGET: 10,
    };
    const config = {
      get: <T>(key: string, fallback: T): T => (values[key] as T | undefined) ?? fallback,
    } as unknown as ConfigService;
    const fetch = jest.fn();
    const pipeline = new CrawlerPipelineService(
      config,
      new CrawlerUrlPolicyService(config),
      new CrawlerSitemapPolicyService(),
      { fetch } as unknown as CrawlerHttpFetcherService,
      new CrawlerXmlDiscoveryService(),
      new BooksHtmlParserService(),
      new CrawlerChallengeDetectorService(),
      new CrawlerKillSwitchService(),
      new CrawlerRequestBudgetService(config),
      new InMemoryCrawlerSnapshotRepository(),
    );

    await expect(pipeline.runOnce()).rejects.toBeDefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drains pending URLs across runs and refreshes oldest known URLs after sitemap 304', async () => {
    const values: Record<string, unknown> = {
      NODE_ENV: 'production',
      CRAWLER_LIVE_ENABLED: true,
      CRAWLER_WRITTEN_PERMISSION: true,
      CRAWLER_DAILY_REQUEST_BUDGET: 50,
      CRAWLER_MAX_SITEMAP_URLS: 20,
      CRAWLER_MAX_PRODUCTS_PER_RUN: 1,
      CRAWLER_MAX_CHILD_SITEMAPS_PER_RUN: 0,
      CRAWLER_MAX_KNOWN_PRODUCT_URLS: 20,
      CRAWLER_PRODUCT_REFRESH_INTERVAL_MS: 0,
    };
    const config = {
      get: <T>(key: string, fallback: T): T => (values[key] as T | undefined) ?? fallback,
    } as unknown as ConfigService;
    const fixture = readFileSync(join(__dirname, 'fixtures', 'book-detail.html'), 'utf8');
    const sitemapCalls = new Map<string, number>();
    const productCalls: string[] = [];
    const firstUrl = 'https://www.books.am/am/fixture-book-detail.html';
    const secondUrl = 'https://www.books.am/am/second-fixture-book.html';
    const fetcher = {
      fetch: jest.fn(async (url: string, kind: string) => {
        if (kind === 'PRODUCT_HTML') {
          productCalls.push(url);
          return document(url, 'text/html', fixture);
        }
        const priorCalls = sitemapCalls.get(url) ?? 0;
        sitemapCalls.set(url, priorCalls + 1);
        if (priorCalls > 0) return notModified(url);
        if (url.endsWith('sitemap_hy.xml')) {
          return document(
            url,
            'application/xml',
            `<urlset><loc>${firstUrl}</loc><loc>${secondUrl}</loc></urlset>`,
          );
        }
        return document(url, 'application/xml', '<urlset />');
      }),
    } as unknown as CrawlerHttpFetcherService;
    const killSwitch = new CrawlerKillSwitchService();
    const snapshots = new InMemoryCrawlerSnapshotRepository();
    const pipeline = new CrawlerPipelineService(
      config,
      new CrawlerUrlPolicyService(config),
      new CrawlerSitemapPolicyService(),
      fetcher,
      new CrawlerXmlDiscoveryService(),
      new BooksHtmlParserService(),
      new CrawlerChallengeDetectorService(),
      killSwitch,
      new CrawlerRequestBudgetService(config),
      snapshots,
    );

    const first = await pipeline.runOnce();
    const second = await pipeline.runOnce();
    const third = await pipeline.runOnce();

    expect(productCalls).toEqual([firstUrl, secondUrl, firstUrl]);
    expect(first.queueAtEnd.pending).toBe(1);
    expect(second.sitemapsNotModified).toBe(3);
    expect(second.queueAtEnd.pending).toBe(0);
    expect(third.sitemapsNotModified).toBe(3);
    expect(third.productsAttempted).toBe(1);
  });
});
