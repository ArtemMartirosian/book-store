import {
  BadGatewayException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import type {
  CrawlerConditionalHeaders,
  CrawlerDocumentKind,
  CrawlerFetchedDocument,
} from './crawler.types';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';

export type CrawlerFetch = (input: string, init: RequestInit) => Promise<Response>;
export const CRAWLER_FETCH = Symbol('CRAWLER_FETCH');

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const XML_CONTENT_TYPES = new Set([
  'application/xml',
  'text/xml',
  'application/rss+xml',
]);
const HTML_CONTENT_TYPES = new Set(['text/html', 'application/xhtml+xml']);

@Injectable()
export class CrawlerHttpFetcherService {
  private lastRequestStartedAt = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly budget: CrawlerRequestBudgetService,
    private readonly killSwitch: CrawlerKillSwitchService,
    private readonly sitemapPolicy: CrawlerSitemapPolicyService,
    private readonly productPolicy: CrawlerUrlPolicyService,
    private readonly challengeDetector: CrawlerChallengeDetectorService,
    @Inject(CRAWLER_FETCH) private readonly transport: CrawlerFetch,
  ) {}

  async fetch(
    rawUrl: string,
    kind: CrawlerDocumentKind,
    conditional: CrawlerConditionalHeaders = { etag: null, lastModified: null },
  ): Promise<CrawlerFetchedDocument> {
    const requestedUrl = this.assertAllowed(rawUrl, kind);
    const maxRedirects = this.integerConfig('CRAWLER_MAX_REDIRECTS', 1, 0, 2);
    let currentUrl = requestedUrl;

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      this.killSwitch.assertOperational();
      this.budget.reserve();
      await this.waitForRateSlot();

      const attempt = await this.performFetch(currentUrl, kind, conditional);
      const { response } = attempt;
      let bodyOwnsAttempt = false;
      try {
        this.killSwitch.observeHttpStatus(response.status, currentUrl);
        if (response.status === 403 || response.status === 429) {
          await response.body?.cancel();
          throw new ServiceUnavailableException({
            code: 'CRAWLER_KILL_SWITCH_ENGAGED',
            status: response.status,
          });
        }

        if (REDIRECT_STATUSES.has(response.status)) {
          await response.body?.cancel();
          if (redirectCount >= maxRedirects) {
            throw new BadGatewayException({ code: 'CRAWLER_REDIRECT_LIMIT_EXCEEDED' });
          }
          const location = response.headers.get('location');
          if (!location) {
            throw new BadGatewayException({ code: 'CRAWLER_REDIRECT_WITHOUT_LOCATION' });
          }
          currentUrl = this.assertAllowed(new URL(location, currentUrl).toString(), kind);
          continue;
        }

        const contentType = this.mediaType(response.headers.get('content-type'));
        if (response.status === 304) {
          await response.body?.cancel();
          if (!conditional.etag && !conditional.lastModified) {
            throw new BadGatewayException({
              code: 'CRAWLER_UNEXPECTED_NOT_MODIFIED',
            });
          }
          return {
            requestedUrl,
            finalUrl: currentUrl,
            status: 304,
            contentType,
            etag: response.headers.get('etag'),
            lastModified: response.headers.get('last-modified'),
            body: null,
            redirectCount,
          };
        }

        const acceptedTypes = kind === 'SITEMAP_XML' ? XML_CONTENT_TYPES : HTML_CONTENT_TYPES;
        if (!contentType || !acceptedTypes.has(contentType)) {
          await this.inspectRejectedResponse(response, currentUrl, contentType);
          throw new BadGatewayException({
            code: 'CRAWLER_CONTENT_TYPE_REJECTED',
            contentType,
          });
        }
        if (!response.ok || response.status !== 200) {
          await this.inspectRejectedResponse(response, currentUrl, contentType);
          throw new BadGatewayException({
            code: 'CRAWLER_UPSTREAM_STATUS_REJECTED',
            status: response.status,
          });
        }
        if (!response.body) {
          throw new BadGatewayException({ code: 'CRAWLER_EMPTY_RESPONSE_BODY' });
        }
        const maxBytes = this.maxResponseBytes(kind);
        const declaredBytes = Number(response.headers.get('content-length'));
        if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
          await response.body.cancel();
          throw new BadGatewayException({
            code: 'CRAWLER_RESPONSE_MAX_BYTES_EXCEEDED',
          });
        }

        bodyOwnsAttempt = true;
        return {
          requestedUrl,
          finalUrl: currentUrl,
          status: 200,
          contentType,
          etag: response.headers.get('etag'),
          lastModified: response.headers.get('last-modified'),
          body: this.limitBody(
            response.body,
            maxBytes,
            attempt.signal,
            attempt.dispose,
          ),
          redirectCount,
        };
      } catch (error) {
        if (attempt.signal.aborted) {
          throw new ServiceUnavailableException({ code: 'CRAWLER_FETCH_TIMEOUT' });
        }
        throw error;
      } finally {
        if (!bodyOwnsAttempt) attempt.dispose();
      }
    }

    throw new BadGatewayException({ code: 'CRAWLER_REDIRECT_LIMIT_EXCEEDED' });
  }

  private async performFetch(
    url: string,
    kind: CrawlerDocumentKind,
    conditional: CrawlerConditionalHeaders,
  ): Promise<{ response: Response; signal: AbortSignal; dispose: () => void }> {
    const controller = new AbortController();
    const timeoutMs = this.integerConfig('CRAWLER_REQUEST_TIMEOUT_MS', 10_000, 500, 30_000);
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = new Headers({
      accept:
        kind === 'SITEMAP_XML'
          ? 'application/xml,text/xml;q=0.9'
          : 'text/html,application/xhtml+xml;q=0.9',
      'user-agent': this.config.get<string>(
        'CRAWLER_USER_AGENT',
        'LUMIBooksCatalogBot/0.1 (+mailto:crawler-ops@lumi.am)',
      ),
    });
    if (conditional.etag) headers.set('if-none-match', conditional.etag);
    if (conditional.lastModified) {
      headers.set('if-modified-since', conditional.lastModified);
    }

    try {
      const response = await this.transport(url, {
        method: 'GET',
        headers,
        redirect: 'manual',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      });
      return {
        response,
        signal: controller.signal,
        dispose: () => clearTimeout(timeout),
      };
    } catch (error) {
      clearTimeout(timeout);
      if (controller.signal.aborted) {
        throw new ServiceUnavailableException({ code: 'CRAWLER_FETCH_TIMEOUT' });
      }
      if (
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      throw new BadGatewayException({ code: 'CRAWLER_UPSTREAM_FETCH_FAILED' });
    }
  }

  private assertAllowed(rawUrl: string, kind: CrawlerDocumentKind): string {
    if (kind === 'SITEMAP_XML') {
      const normalized = this.sitemapPolicy.normalize(rawUrl);
      if (normalized) return normalized;
      throw new ForbiddenException({ code: 'SITEMAP_URL_NOT_ALLOWLISTED' });
    }

    const decision = this.productPolicy.evaluate(rawUrl);
    if (decision.eligible && decision.normalizedUrl) return decision.normalizedUrl;
    throw new ForbiddenException({ code: 'PRODUCT_URL_NOT_ALLOWED', reason: decision.reason });
  }

  private async waitForRateSlot(): Promise<void> {
    const delayMs = this.integerConfig('CRAWLER_MIN_REQUEST_DELAY_MS', 1_000, 0, 60_000);
    const waitMs = Math.max(this.lastRequestStartedAt + delayMs - Date.now(), 0);
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.lastRequestStartedAt = Date.now();
  }

  private async inspectRejectedResponse(
    response: Response,
    sourceUrl: string,
    contentType: string | null,
  ): Promise<void> {
    if (!contentType || !HTML_CONTENT_TYPES.has(contentType) || !response.body) {
      await response.body?.cancel();
      return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let preview = '';
    try {
      while (preview.length < 65_536) {
        const next = await reader.read();
        if (next.done) break;
        preview += decoder.decode(next.value, { stream: true });
      }
      preview += decoder.decode();
    } finally {
      await reader.cancel();
    }
    if (this.challengeDetector.isChallenge(preview)) {
      this.killSwitch.observeChallenge(sourceUrl);
    }
  }

  private async *limitBody(
    body: ReadableStream<Uint8Array>,
    maxBytes: number,
    signal: AbortSignal,
    dispose: () => void,
  ): AsyncIterable<Uint8Array> {
    const reader = body.getReader();
    let total = 0;
    try {
      while (true) {
        let next: ReadableStreamReadResult<Uint8Array>;
        try {
          next = await reader.read();
        } catch (error) {
          if (signal.aborted) {
            throw new ServiceUnavailableException({ code: 'CRAWLER_FETCH_TIMEOUT' });
          }
          throw error;
        }
        if (signal.aborted) {
          throw new ServiceUnavailableException({ code: 'CRAWLER_FETCH_TIMEOUT' });
        }
        if (next.done) return;
        total += next.value.byteLength;
        if (total > maxBytes) {
          throw new BadGatewayException({ code: 'CRAWLER_RESPONSE_MAX_BYTES_EXCEEDED' });
        }
        yield next.value;
      }
    } finally {
      dispose();
      await reader.cancel();
    }
  }

  private maxResponseBytes(kind: CrawlerDocumentKind): number {
    if (kind === 'SITEMAP_XML') {
      return this.integerConfig(
        'CRAWLER_MAX_SITEMAP_BYTES',
        33_554_432,
        1_024,
        67_108_864,
      );
    }
    return this.integerConfig('CRAWLER_MAX_RESPONSE_BYTES', 2_097_152, 1_024, 10_485_760);
  }

  private mediaType(value: string | null): string | null {
    return value?.split(';', 1)[0]?.trim().toLocaleLowerCase() || null;
  }

  private integerConfig(name: string, fallback: number, min: number, max: number): number {
    const configured = Math.trunc(this.config.get<number>(name, fallback));
    return Math.min(Math.max(configured, min), max);
  }
}
