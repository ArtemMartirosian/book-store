export const CRAWLER_FIXTURES = ['book-detail', 'book-price-conflict'] as const;
export type CrawlerFixtureName = (typeof CRAWLER_FIXTURES)[number];

export const BOOKS_SITEMAPS = [
  { locale: 'hy', url: 'https://www.books.am/pub/sitemap/sitemap_hy.xml' },
  { locale: 'ru', url: 'https://www.books.am/pub/sitemap/sitemap_ru.xml' },
  { locale: 'en', url: 'https://www.books.am/pub/sitemap/sitemap_en.xml' },
] as const;

export type CrawlerLocale = (typeof BOOKS_SITEMAPS)[number]['locale'];
export type CrawlerDocumentKind = 'SITEMAP_XML' | 'PRODUCT_HTML';

export interface ParsedBookAttribute {
  code: string | null;
  label: string;
  value: string;
}

export interface ParsedBookDetailSection {
  code: string | null;
  title: string;
  content: string;
  attributes: ParsedBookAttribute[];
}

export interface UrlEligibilityDecision {
  eligible: boolean;
  normalizedUrl: string | null;
  reason:
    | 'ALLOWED_SEO_PRODUCT_URL'
    | 'INVALID_URL'
    | 'HTTPS_REQUIRED'
    | 'HOST_NOT_ALLOWED'
    | 'PORT_NOT_ALLOWED'
    | 'CREDENTIALS_NOT_ALLOWED'
    | 'QUERY_OR_FRAGMENT_NOT_ALLOWED'
    | 'LOCALE_PREFIX_REQUIRED'
    | 'PATH_NOT_ALLOWED'
    | 'BLOCKED_PATH';
}

export interface ParsedBookSnapshot {
  parserVersion: 'books-html-v3';
  sourceUrl: string;
  canonicalUrl: string;
  supplierSku: string;
  productCode: string;
  title: string;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  language: string | null;
  weight: string | null;
  barcode: string | null;
  isNew: boolean | null;
  pageCount: number | null;
  coverType: string | null;
  dimensions: string | null;
  publicationYear: number | null;
  series: string | null;
  imageUrl: string | null;
  imageUrls: string[];
  attributes: ParsedBookAttribute[];
  detailSections: ParsedBookDetailSection[];
  sourcePriceAmd: number;
  currency: 'AMD';
  preliminarilySalable: boolean;
  observedAt: string;
  warnings: string[];
  quarantineReason: 'PARSER_CONFLICT' | null;
}

export interface CrawlerKillSwitchState {
  engaged: boolean;
  reason: string | null;
  sourceUrl: string | null;
  engagedAt: string | null;
  resetAt: string | null;
  resetReason: string | null;
}

export interface CrawlerConditionalHeaders {
  etag: string | null;
  lastModified: string | null;
}

export interface CrawlerFetchedDocument {
  requestedUrl: string;
  finalUrl: string;
  status: 200 | 304;
  contentType: string | null;
  etag: string | null;
  lastModified: string | null;
  body: AsyncIterable<Uint8Array> | null;
  redirectCount: number;
}

export type CrawlerObservationOutcome =
  | 'NORMALIZED'
  | 'QUARANTINED'
  | 'NOT_MODIFIED';

export interface CrawlerObservation {
  id: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  outcome: CrawlerObservationOutcome;
  snapshot: ParsedBookSnapshot | null;
  quarantineReasons: string[];
  warnings: string[];
  observedAt: string;
  response: {
    status: number | null;
    contentType: string | null;
    etag: string | null;
    lastModified: string | null;
  };
}

export interface CrawlerDiscoveryResult {
  urls: string[];
  bytesRead: number;
  truncated: boolean;
  challengeDetected: boolean;
}

export interface CrawlerRequestBudgetState {
  dateUtc: string;
  limit: number;
  used: number;
  remaining: number;
  persistence: 'IN_MEMORY_PROCESS_LOCAL';
}

export interface CrawlerProductQueueState {
  known: number;
  pending: number;
  leased: number;
  refreshDue: number;
  capacity: number;
  persistence: 'IN_MEMORY_PROCESS_LOCAL';
}

export type CrawlerBrowserRunStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'STOPPING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'STOPPED'
  | 'FAILED';

export interface CrawlerBrowserRunState {
  status: CrawlerBrowserRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  currentUrl: string | null;
  resumeCatalogUrl: string | null;
  catalogPagesVisited: number;
  discoveredProducts: number;
  productsAttempted: number;
  imported: number;
  quarantined: number;
  failedProducts: number;
  navigationRetries: number;
  productsSkipped: number;
  catalogSegmentsDiscovered: number;
  catalogSegmentsCompleted: number;
  activeCatalogSegment: string | null;
  finishReason: string | null;
  errors: Array<{ sourceUrl: string; code: string }>;
}
