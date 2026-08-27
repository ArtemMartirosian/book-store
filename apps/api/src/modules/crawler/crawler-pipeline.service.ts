import {
  ConflictException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { BooksHtmlParserService } from './books-html-parser.service';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import { CrawlerHttpFetcherService } from './crawler-http-fetcher.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import { CrawlerSnapshotRepository } from './crawler-snapshot.repository';
import type {
  CrawlerFetchedDocument,
  CrawlerLocale,
  CrawlerObservation,
  ParsedBookSnapshot,
} from './crawler.types';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';
import { CrawlerXmlDiscoveryService } from './crawler-xml-discovery.service';

@Injectable()
export class CrawlerPipelineService {
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly urlPolicy: CrawlerUrlPolicyService,
    private readonly sitemapPolicy: CrawlerSitemapPolicyService,
    private readonly fetcher: CrawlerHttpFetcherService,
    private readonly discovery: CrawlerXmlDiscoveryService,
    private readonly parser: BooksHtmlParserService,
    private readonly challengeDetector: CrawlerChallengeDetectorService,
    private readonly killSwitch: CrawlerKillSwitchService,
    private readonly budget: CrawlerRequestBudgetService,
    private readonly snapshots: CrawlerSnapshotRepository,
  ) {}

  getDryRunPlan() {
    const gate = this.urlPolicy.getLiveGateStatus();
    const maxProducts = this.integerConfig('CRAWLER_MAX_PRODUCTS_PER_RUN', 50, 1, 500);
    const maxChildSitemaps = this.integerConfig(
      'CRAWLER_MAX_CHILD_SITEMAPS_PER_RUN',
      20,
      0,
      100,
    );
    const sitemapTargets = this.sitemapPolicy.listAllowed();
    const refreshIntervalMs = this.productRefreshIntervalMs();
    const now = new Date().toISOString();
    const plannedDocuments = sitemapTargets.length + maxChildSitemaps + maxProducts;
    const maxRedirects = this.integerConfig('CRAWLER_MAX_REDIRECTS', 1, 0, 2);
    return {
      dryRun: true,
      networkRequestsPerformed: 0,
      runnable: gate.allowed && !this.killSwitch.getState().engaged,
      gate,
      sitemapTargets,
      sitemapPolicy: 'EXACT_ROOTS_AND_BOUNDED_LOCALE_CHILDREN',
      productPolicy: 'HTTPS_LOCALE_SEO_HTML_ONLY',
      maxSitemapUrls: this.integerConfig(
        'CRAWLER_MAX_SITEMAP_URLS',
        200_000,
        1,
        500_000,
      ),
      maxProducts,
      maxChildSitemaps,
      maxSitemapDepth: 1,
      maximumPlannedDocuments: plannedDocuments,
      maximumPlannedHttpAttempts: plannedDocuments * (maxRedirects + 1),
      productRefreshIntervalMs: refreshIntervalMs,
      productQueue: this.snapshots.getProductQueueState(
        refreshIntervalMs,
        now,
        this.productQueueCapacity(),
      ),
      budget: this.budget.getState(),
      repository: {
        adapter: 'IN_MEMORY',
        persistence: 'PROCESS_LOCAL_NON_DURABLE',
      },
      killSwitch: this.killSwitch.getState(),
    };
  }

  async listObservations(limit = 25) {
    return {
      repository: 'IN_MEMORY_PROCESS_LOCAL',
      observations: await this.snapshots.listRecent(limit),
    };
  }

  getProductQueueStatus() {
    return this.snapshots.getProductQueueState(
      this.productRefreshIntervalMs(),
      new Date().toISOString(),
      this.productQueueCapacity(),
    );
  }

  async runOnce() {
    this.killSwitch.assertOperational();
    this.urlPolicy.assertLiveModeConfigured();
    if (this.running) {
      throw new ConflictException({ code: 'CRAWLER_RUN_ALREADY_IN_PROGRESS' });
    }

    this.running = true;
    const startedAt = new Date().toISOString();
    const refreshIntervalMs = this.productRefreshIntervalMs();
    const report = {
      mode: 'PERMISSION_GATED_HTML' as const,
      startedAt,
      completedAt: null as string | null,
      sitemapTargets: this.sitemapPolicy.listAllowed().length,
      sitemapsFetched: 0,
      sitemapsNotModified: 0,
      childSitemapsQueued: 0,
      discoveredUrls: 0,
      eligibleUrls: 0,
      rejectedUrls: 0,
      enqueuedProducts: 0,
      duplicateProducts: 0,
      queueCapacityDrops: 0,
      leasedProducts: 0,
      productsAttempted: 0,
      normalized: 0,
      quarantined: 0,
      notModified: 0,
      errors: [] as Array<{ sourceUrl: string; code: string }>,
      budget: this.budget.getState(),
      killSwitch: this.killSwitch.getState(),
      repository: 'IN_MEMORY_PROCESS_LOCAL' as const,
      queueAtStart: this.snapshots.getProductQueueState(
        refreshIntervalMs,
        startedAt,
        this.productQueueCapacity(),
      ),
      queueAtEnd: this.snapshots.getProductQueueState(
        refreshIntervalMs,
        startedAt,
        this.productQueueCapacity(),
      ),
    };

    try {
      const productUrls = new Set<string>();
      const seenSitemaps = new Set<string>();
      const maxSitemapUrls = this.integerConfig(
        'CRAWLER_MAX_SITEMAP_URLS',
        200_000,
        1,
        500_000,
      );
      const maxSitemapBytes = this.integerConfig(
        'CRAWLER_MAX_SITEMAP_BYTES',
        33_554_432,
        1_024,
        67_108_864,
      );
      const maxChildSitemaps = this.integerConfig(
        'CRAWLER_MAX_CHILD_SITEMAPS_PER_RUN',
        20,
        0,
        100,
      );
      const sitemapQueue: Array<{
        url: string;
        locale: CrawlerLocale;
        depth: 0 | 1;
      }> = this.sitemapPolicy
        .listAllowed()
        .map((target) => ({ ...target, depth: 0 as const }));
      for (const target of sitemapQueue) seenSitemaps.add(target.url);
      let discoverySlotsUsed = 0;

      while (sitemapQueue.length > 0) {
        const sitemap = sitemapQueue.shift()!;
        if (
          this.killSwitch.getState().engaged ||
          discoverySlotsUsed >= maxSitemapUrls ||
          this.budget.getState().remaining < 1
        ) {
          break;
        }
        try {
          const conditional = await this.snapshots.findConditionalHeaders(sitemap.url);
          const fetched = await this.fetcher.fetch(
            sitemap.url,
            'SITEMAP_XML',
            conditional,
          );
          if (fetched.status === 304) {
            report.sitemapsNotModified += 1;
            continue;
          }
          report.sitemapsFetched += 1;
          const discovered = await this.discovery.discover(fetched.body!, {
            maxBytes: maxSitemapBytes,
            maxUrls: maxSitemapUrls - discoverySlotsUsed,
          });
          if (discovered.challengeDetected) {
            this.killSwitch.observeChallenge(sitemap.url);
            report.errors.push({
              sourceUrl: sitemap.url,
              code: 'UPSTREAM_CHALLENGE_DETECTED',
            });
            continue;
          }
          report.discoveredUrls += discovered.urls.length;
          discoverySlotsUsed += discovered.urls.length;
          if (discovered.truncated) {
            report.errors.push({
              sourceUrl: sitemap.url,
              code: 'SITEMAP_DISCOVERY_TRUNCATED',
            });
          } else {
            await this.snapshots.saveConditionalHeaders(sitemap.url, {
              etag: fetched.etag,
              lastModified: fetched.lastModified,
            });
          }
          for (const rawUrl of discovered.urls) {
            const decision = this.urlPolicy.evaluate(rawUrl);
            if (decision.eligible && decision.normalizedUrl) {
              productUrls.add(decision.normalizedUrl);
              continue;
            }

            const child = this.sitemapPolicy.normalizeChild(rawUrl, sitemap.locale);
            if (
              child &&
              sitemap.depth === 0 &&
              !seenSitemaps.has(child) &&
              report.childSitemapsQueued < maxChildSitemaps
            ) {
              seenSitemaps.add(child);
              sitemapQueue.push({ url: child, locale: sitemap.locale, depth: 1 });
              report.childSitemapsQueued += 1;
              continue;
            }
            report.rejectedUrls += 1;
          }
        } catch (error) {
          report.errors.push({ sourceUrl: sitemap.url, code: this.errorCode(error) });
        }
      }

      report.eligibleUrls = productUrls.size;
      const queued = await this.snapshots.enqueueProductUrls(
        [...productUrls],
        this.productQueueCapacity(),
        new Date().toISOString(),
      );
      report.enqueuedProducts = queued.added;
      report.duplicateProducts = queued.duplicates;
      report.queueCapacityDrops = queued.droppedAtCapacity;
      const maxProducts = this.integerConfig('CRAWLER_MAX_PRODUCTS_PER_RUN', 50, 1, 500);
      const leased = await this.snapshots.leaseProducts(
        Math.min(maxProducts, this.budget.getState().remaining),
        refreshIntervalMs,
        new Date().toISOString(),
      );
      report.leasedProducts = leased.length;
      const unfinished = new Set(leased);
      try {
        for (const productUrl of leased) {
          if (
            this.killSwitch.getState().engaged ||
            this.budget.getState().remaining < 1
          ) {
            break;
          }
          report.productsAttempted += 1;
          const outcome = await this.processProduct(productUrl);
          if (outcome === 'NORMALIZED') report.normalized += 1;
          if (outcome === 'QUARANTINED') report.quarantined += 1;
          if (outcome === 'NOT_MODIFIED') report.notModified += 1;
          await this.snapshots.completeProductAttempt(
            productUrl,
            new Date().toISOString(),
          );
          unfinished.delete(productUrl);
        }
      } finally {
        await this.snapshots.releaseProductLeases([...unfinished]);
      }

      return report;
    } finally {
      report.completedAt = new Date().toISOString();
      report.budget = this.budget.getState();
      report.killSwitch = this.killSwitch.getState();
      report.queueAtEnd = this.snapshots.getProductQueueState(
        refreshIntervalMs,
        report.completedAt,
        this.productQueueCapacity(),
      );
      this.running = false;
    }
  }

  private async processProduct(
    sourceUrl: string,
  ): Promise<CrawlerObservation['outcome']> {
    let fetched: CrawlerFetchedDocument | null = null;
    try {
      const conditional = await this.snapshots.findConditionalHeaders(sourceUrl);
      fetched = await this.fetcher.fetch(sourceUrl, 'PRODUCT_HTML', conditional);
      if (fetched.status === 304) {
        const observation = this.observation(sourceUrl, fetched, 'NOT_MODIFIED');
        await this.snapshots.save(observation);
        return observation.outcome;
      }

      const html = await this.collectUtf8(fetched.body!);
      if (this.challengeDetector.isChallenge(html)) {
        this.killSwitch.observeChallenge(sourceUrl);
        const observation = this.observation(sourceUrl, fetched, 'QUARANTINED', null, [
          'UPSTREAM_CHALLENGE_DETECTED',
        ]);
        await this.snapshots.save(observation);
        return observation.outcome;
      }

      const parsed = this.parser.parse(html, fetched.finalUrl);
      const canonical = this.urlPolicy.evaluate(parsed.canonicalUrl);
      if (!canonical.eligible || !canonical.normalizedUrl) {
        const observation = this.observation(sourceUrl, fetched, 'QUARANTINED', null, [
          `CANONICAL_${canonical.reason}`,
        ]);
        await this.snapshots.save(observation);
        return observation.outcome;
      }

      const normalized: ParsedBookSnapshot = {
        ...parsed,
        sourceUrl,
        canonicalUrl: canonical.normalizedUrl,
      };
      const outcome = normalized.quarantineReason ? 'QUARANTINED' : 'NORMALIZED';
      const observation = this.observation(
        sourceUrl,
        fetched,
        outcome,
        normalized,
        normalized.quarantineReason ? [normalized.quarantineReason] : [],
      );
      await this.snapshots.save(observation);
      return observation.outcome;
    } catch (error) {
      const observation = this.observation(sourceUrl, fetched, 'QUARANTINED', null, [
        this.errorCode(error),
      ]);
      await this.snapshots.save(observation);
      return observation.outcome;
    }
  }

  private observation(
    sourceUrl: string,
    fetched: CrawlerFetchedDocument | null,
    outcome: CrawlerObservation['outcome'],
    snapshot: ParsedBookSnapshot | null = null,
    quarantineReasons: string[] = [],
  ): CrawlerObservation {
    return {
      id: randomUUID(),
      sourceUrl,
      canonicalUrl: snapshot?.canonicalUrl ?? null,
      outcome,
      snapshot,
      quarantineReasons,
      warnings: snapshot?.warnings ?? [],
      observedAt: new Date().toISOString(),
      response: {
        status: fetched?.status ?? null,
        contentType: fetched?.contentType ?? null,
        etag: fetched?.etag ?? null,
        lastModified: fetched?.lastModified ?? null,
      },
    };
  }

  private async collectUtf8(body: AsyncIterable<Uint8Array>): Promise<string> {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let value = '';
    try {
      for await (const chunk of body) value += decoder.decode(chunk, { stream: true });
      return value + decoder.decode();
    } catch (error) {
      if (error instanceof TypeError) {
        throw new HttpException({ code: 'CRAWLER_INVALID_UTF8' }, 502);
      }
      throw error;
    }
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'object' && response && 'code' in response) {
        const code = (response as { code?: unknown }).code;
        if (typeof code === 'string') return code;
      }
      return `HTTP_${error.getStatus()}`;
    }
    return error instanceof Error ? error.name : 'UNKNOWN_CRAWLER_ERROR';
  }

  private integerConfig(name: string, fallback: number, min: number, max: number): number {
    const configured = Math.trunc(this.config.get<number>(name, fallback));
    return Math.min(Math.max(configured, min), max);
  }

  private productRefreshIntervalMs(): number {
    return this.integerConfig(
      'CRAWLER_PRODUCT_REFRESH_INTERVAL_MS',
      86_400_000,
      0,
      2_592_000_000,
    );
  }

  private productQueueCapacity(): number {
    return this.integerConfig(
      'CRAWLER_MAX_KNOWN_PRODUCT_URLS',
      250_000,
      1,
      500_000,
    );
  }
}
