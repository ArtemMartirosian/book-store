import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UrlEligibilityDecision } from './crawler.types';

const ALLOWED_HOSTS = new Set(['books.am', 'www.books.am']);
const BLOCKED_SEGMENTS = new Set([
  'catalog',
  'checkout',
  'customer',
  'account',
  'login',
  'auth',
  'oauth',
  'cart',
  'wishlist',
  'rest',
  'graphql',
  'admin',
  'media',
]);
const LOCALES = new Set(['am', 'ru', 'en']);
const SAFE_SEGMENT = /^[\p{L}\p{N}][\p{L}\p{N}._~-]*$/u;

@Injectable()
export class CrawlerUrlPolicyService {
  constructor(private readonly config: ConfigService) {}

  evaluate(rawUrl: string): UrlEligibilityDecision {
    if (rawUrl.length > 2_048) return this.denied('PATH_NOT_ALLOWED');
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return this.denied('INVALID_URL');
    }

    if (url.protocol !== 'https:') return this.denied('HTTPS_REQUIRED');
    if (!ALLOWED_HOSTS.has(url.hostname.toLocaleLowerCase())) {
      return this.denied('HOST_NOT_ALLOWED');
    }
    if (url.port) return this.denied('PORT_NOT_ALLOWED');
    if (url.username || url.password) return this.denied('CREDENTIALS_NOT_ALLOWED');
    if (url.search || url.hash) return this.denied('QUERY_OR_FRAGMENT_NOT_ALLOWED');

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(url.pathname);
    } catch {
      return this.denied('PATH_NOT_ALLOWED');
    }
    if (decodedPath.includes('\\') || decodedPath.includes('//')) {
      return this.denied('PATH_NOT_ALLOWED');
    }

    const segments = decodedPath.split('/').filter(Boolean);
    const locale = segments[0]?.toLocaleLowerCase();
    if (!locale || !LOCALES.has(locale)) return this.denied('LOCALE_PREFIX_REQUIRED');
    const productSegments = segments.slice(1);
    if (productSegments.length === 0) return this.denied('PATH_NOT_ALLOWED');
    if (productSegments.some((segment) => BLOCKED_SEGMENTS.has(segment.toLocaleLowerCase()))) {
      return this.denied('BLOCKED_PATH');
    }
    if (productSegments.some((segment) => !SAFE_SEGMENT.test(segment))) {
      return this.denied('PATH_NOT_ALLOWED');
    }
    if (!productSegments.at(-1)?.toLocaleLowerCase().endsWith('.html')) {
      return this.denied('PATH_NOT_ALLOWED');
    }

    url.hostname = 'www.books.am';
    return {
      eligible: true,
      normalizedUrl: url.toString(),
      reason: 'ALLOWED_SEO_PRODUCT_URL',
    };
  }

  assertLiveModeConfigured(): void {
    const gate = this.getLiveGateStatus();
    if (!gate.allowed) {
      throw new ForbiddenException({
        code: 'LIVE_CRAWLER_DISABLED',
        message:
          'Live crawling requires production plus explicit enablement, written permission and a positive budget.',
        unmet: gate.unmet,
      });
    }
  }

  getLiveGateStatus(): {
    allowed: boolean;
    production: boolean;
    liveEnabled: boolean;
    writtenPermission: boolean;
    dailyRequestBudget: number;
    unmet: string[];
  } {
    const production = this.config.get<string>('NODE_ENV', 'development') === 'production';
    const liveEnabled = this.config.get<boolean>('CRAWLER_LIVE_ENABLED', false);
    const permission = this.config.get<boolean>('CRAWLER_WRITTEN_PERMISSION', false);
    const budget = this.config.get<number>('CRAWLER_DAILY_REQUEST_BUDGET', 0);
    const unmet = [
      ...(!production ? ['NODE_ENV_PRODUCTION_REQUIRED'] : []),
      ...(!liveEnabled ? ['CRAWLER_LIVE_ENABLED_REQUIRED'] : []),
      ...(!permission ? ['CRAWLER_WRITTEN_PERMISSION_REQUIRED'] : []),
      ...(budget < 1 ? ['POSITIVE_DAILY_REQUEST_BUDGET_REQUIRED'] : []),
    ];
    return {
      allowed: unmet.length === 0,
      production,
      liveEnabled,
      writtenPermission: permission,
      dailyRequestBudget: budget,
      unmet,
    };
  }

  private denied(reason: UrlEligibilityDecision['reason']): UrlEligibilityDecision {
    return { eligible: false, normalizedUrl: null, reason };
  }
}
