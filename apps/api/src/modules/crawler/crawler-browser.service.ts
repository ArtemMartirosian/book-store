import {
  BadRequestException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { load } from 'cheerio';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import type { BookRecord, StoreLocale } from '../catalog/book.model';
import {
  CATALOG_REPOSITORY,
  type CatalogRepository,
} from '../catalog/repositories/catalog.repository';
import { BooksHtmlParserService } from './books-html-parser.service';
import { CrawlerCatalogDiscoveryService } from './crawler-catalog-discovery.service';
import { CrawlerCheckpointRepository } from './crawler-checkpoint.repository';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import type {
  CrawlerBrowserRunState,
  ParsedBookSnapshot,
} from './crawler.types';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';

const DEFAULT_CATALOG_URL =
  'https://www.books.am/ru/catalog/category/view/s/knigi/id/7463/';
const ALLOWED_HOSTS = new Set(['books.am', 'www.books.am']);
const PRODUCT_PATH = /^\/(am|ru|en)\/catalog\/product\/view\/id\/(\d+)(?:\/category\/\d+)?\/?$/u;

const initialState = (): CrawlerBrowserRunState => ({
  status: 'IDLE',
  startedAt: null,
  completedAt: null,
  currentUrl: null,
  resumeCatalogUrl: null,
  catalogPagesVisited: 0,
  discoveredProducts: 0,
  productsAttempted: 0,
  imported: 0,
  quarantined: 0,
  failedProducts: 0,
  navigationRetries: 0,
  productsSkipped: 0,
  catalogSegmentsDiscovered: 0,
  catalogSegmentsCompleted: 0,
  activeCatalogSegment: null,
  finishReason: null,
  errors: [],
});

@Injectable()
export class CrawlerBrowserService implements OnModuleInit, OnModuleDestroy {
  private state = initialState();
  private browser: BrowserContext | null = null;
  private job: Promise<void> | null = null;
  private refreshingBookIds = new Set<string>();
  private stopRequested = false;
  private shuttingDown = false;
  private finishingProduct = false;
  private catalogSegments: string[] = [];
  private completedCatalogSegments = new Set<string>();

  constructor(
    private readonly config: ConfigService,
    private readonly checkpoints: CrawlerCheckpointRepository,
    private readonly catalogDiscovery: CrawlerCatalogDiscoveryService,
    private readonly policy: CrawlerUrlPolicyService,
    private readonly parser: BooksHtmlParserService,
    private readonly challengeDetector: CrawlerChallengeDetectorService,
    private readonly killSwitch: CrawlerKillSwitchService,
    private readonly budget: CrawlerRequestBudgetService,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const saved = await this.checkpoints.load();
    if (!saved) return;
    const savedState = saved.state;
    const wasInterrupted =
      savedState.status === 'RUNNING' ||
      (savedState.status === 'PAUSED' && savedState.finishReason === 'PROCESS_SHUTDOWN');
    this.catalogSegments = saved.catalogSegments;
    this.completedCatalogSegments = new Set(saved.completedCatalogSegments);
    this.state = {
      ...savedState,
      status: wasInterrupted
        ? 'PAUSED'
        : savedState.status === 'STOPPING'
          ? 'STOPPED'
          : savedState.status,
      currentUrl: null,
      finishReason:
        wasInterrupted
          ? 'PROCESS_RESTART_REQUIRES_OPERATOR'
          : savedState.status === 'STOPPING'
          ? 'OPERATOR_STOP_REQUESTED'
          : savedState.finishReason,
    };
    await this.persistState();
  }

  start(): CrawlerBrowserRunState {
    this.killSwitch.assertOperational();
    this.policy.assertLiveModeConfigured();
    if (this.job || ['RUNNING', 'STOPPING'].includes(this.state.status)) {
      throw new ConflictException({ code: 'CRAWLER_BROWSER_RUN_ALREADY_IN_PROGRESS' });
    }

    const resumable =
      Boolean(this.state.resumeCatalogUrl) &&
      ['PAUSED', 'FAILED', 'STOPPED', 'RUNNING'].includes(this.state.status);
    const resumeCatalogUrl = resumable
      ? this.state.resumeCatalogUrl!
      : this.catalogStartUrl();
    const previous = resumable ? this.state : initialState();
    if (!resumable) {
      this.catalogSegments = [];
      this.completedCatalogSegments.clear();
    }
    this.stopRequested = false;
    this.shuttingDown = false;
    this.state = {
      ...previous,
      status: 'RUNNING',
      startedAt: resumable
        ? previous.startedAt ?? new Date().toISOString()
        : new Date().toISOString(),
      completedAt: null,
      currentUrl: resumeCatalogUrl,
      resumeCatalogUrl,
      finishReason: null,
    };
    const activeSegment = this.catalogDiscovery.segmentUrl(resumeCatalogUrl);
    this.completedCatalogSegments.delete(activeSegment);
    this.enqueueCatalogSegment(activeSegment);
    this.state.activeCatalogSegment = activeSegment;
    this.job = this.execute(resumeCatalogUrl).finally(() => {
      this.job = null;
    });
    return this.getState();
  }

  stop(): CrawlerBrowserRunState {
    if (this.state.status === 'RUNNING') {
      this.stopRequested = true;
      this.state.status = 'STOPPING';
      this.state.finishReason = 'OPERATOR_STOP_REQUESTED';
      void this.persistState().catch(() => undefined);
    }
    return this.getState();
  }

  getState(): CrawlerBrowserRunState {
    return structuredClone(this.state);
  }

  async refreshBook(bookId: string): Promise<{
    bookId: string;
    localesUpdated: StoreLocale[];
    refreshedAt: string;
  }> {
    this.killSwitch.assertOperational();
    this.policy.assertLiveModeConfigured();
    if (this.job) {
      throw new ConflictException({ code: 'CRAWLER_BROWSER_RUN_ALREADY_IN_PROGRESS' });
    }
    if (this.refreshingBookIds.has(bookId)) {
      throw new ConflictException({ code: 'BOOK_REFRESH_ALREADY_IN_PROGRESS' });
    }
    const existing = await this.catalog.findById(bookId);
    if (!existing) throw new NotFoundException({ code: 'BOOK_NOT_FOUND' });
    const productId = existing.slug.match(/^books-am-(\d+)$/u)?.[1];
    if (!productId) {
      throw new BadRequestException({ code: 'BOOK_IS_NOT_A_BOOKS_AM_PRODUCT' });
    }

    this.refreshingBookIds.add(bookId);
    let profileDirectory: string | null = null;
    let context: BrowserContext | null = null;
    try {
      profileDirectory = await mkdtemp(join(tmpdir(), 'lumi-book-refresh-'));
      context = await chromium.launchPersistentContext(profileDirectory, {
        headless: true,
        executablePath: this.config.get<string>(
          'CRAWLER_BROWSER_EXECUTABLE',
          '/usr/bin/chromium-browser',
        ),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        locale: 'ru-RU',
        extraHTTPHeaders: { 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7' },
      });
      const page = context.pages()[0] ?? (await context.newPage());
      await page.route('**/*', async (route) => {
        if (route.request().resourceType() === 'document') await route.continue();
        else await route.abort();
      });
      const parsedRecords: BookRecord[] = [];
      for (const product of this.allLocalizedProductUrls(productId)) {
        this.budget.reserve();
        const response = await page.goto(product.url, {
          waitUntil: 'commit',
          timeout: this.integerConfig(
            'CRAWLER_BROWSER_NAVIGATION_TIMEOUT_MS',
            60_000,
            1_000,
            120_000,
          ),
        });
        const status = response?.status() ?? 0;
        if (status === 403 || status === 429) {
          this.killSwitch.observeHttpStatus(status, product.url);
        }
        if (status < 200 || status >= 400) {
          throw new Error(`UPSTREAM_HTTP_${status || 'NO_RESPONSE'}`);
        }
        const html = await response!.text();
        if (this.challengeDetector.isChallenge(html)) {
          this.killSwitch.observeChallenge(product.url);
          throw new Error('UPSTREAM_CHALLENGE_DETECTED');
        }
        const parsed = this.parser.parse(html, page.url());
        if (parsed.quarantineReason) throw new Error(parsed.quarantineReason);
        parsedRecords.push(this.toBookRecord(parsed, product));
        await this.delay();
      }
      for (const record of parsedRecords) await this.catalog.upsert(record, { force: true });
      return {
        bookId,
        localesUpdated: parsedRecords.map(({ locale }) => locale),
        refreshedAt: new Date().toISOString(),
      };
    } finally {
      this.refreshingBookIds.delete(bookId);
      await context?.close().catch(() => undefined);
      if (profileDirectory) {
        await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined);
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.job) return;
    this.shuttingDown = true;
    this.state.status = 'PAUSED';
    this.state.finishReason = 'PROCESS_SHUTDOWN';
    this.state.currentUrl = null;
    await this.persistState().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    await this.job.catch(() => undefined);
  }

  private async execute(startUrl: string): Promise<void> {
    let profileDirectory: string | null = null;
    try {
      await this.persistState();
      profileDirectory = await mkdtemp(join(tmpdir(), 'lumi-books-crawler-'));
      this.browser = await chromium.launchPersistentContext(profileDirectory, {
        headless: true,
        executablePath: this.config.get<string>(
          'CRAWLER_BROWSER_EXECUTABLE',
          '/usr/bin/chromium-browser',
        ),
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        locale: 'ru-RU',
        extraHTTPHeaders: { 'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.7' },
      });
      const page = this.browser.pages()[0] ?? (await this.browser.newPage());
      await page.route('**/*', async (route) => {
        const type = route.request().resourceType();
        if (type === 'document') await route.continue();
        else await route.abort();
      });
      const categorySegments = await this.prepareCategories(page, startUrl);
      this.prependCatalogSegments(categorySegments);
      const startLocation = this.catalogDiscovery.categoryLocation(startUrl);
      const firstBookSegment =
        startLocation.categoryId === '7463'
          ? this.catalogSegments.find(
              (segment) => !this.completedCatalogSegments.has(segment),
            ) ?? startUrl
          : startUrl;
      await this.crawlCatalogSegments(page, firstBookSegment);
    } catch (error) {
      if (this.isBudgetExhausted(error)) {
        this.state.status = 'PAUSED';
        this.state.finishReason = 'DAILY_REQUEST_BUDGET_EXHAUSTED';
      } else if (this.killSwitch.getState().engaged) {
        this.state.status = 'STOPPED';
        this.state.finishReason = this.killSwitch.getState().reason;
      } else if (this.shuttingDown) {
        this.state.status = 'PAUSED';
        this.state.finishReason = 'PROCESS_SHUTDOWN';
      } else if (this.stopRequested) {
        this.state.status = 'STOPPED';
        this.state.finishReason = 'OPERATOR_STOP_REQUESTED';
      } else {
        this.state.status = 'FAILED';
        this.state.finishReason = this.errorCode(error);
        this.pushError(this.state.currentUrl ?? startUrl, this.errorCode(error));
      }
    } finally {
      await this.browser?.close().catch(() => undefined);
      this.browser = null;
      if (profileDirectory) {
        await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined);
      }
      if (
        !this.shuttingDown &&
        (this.state.status === 'RUNNING' || this.state.status === 'STOPPING')
      ) {
        this.state.status = this.stopRequested ? 'STOPPED' : 'COMPLETED';
        this.state.finishReason = this.stopRequested
          ? 'OPERATOR_STOP_REQUESTED'
          : 'CATALOG_EXHAUSTED';
        if (!this.stopRequested) this.state.resumeCatalogUrl = null;
      }
      this.state.currentUrl = null;
      this.state.completedAt = new Date().toISOString();
      await this.persistState().catch(() => undefined);
    }
  }

  private async crawlCatalogSegments(page: Page, startUrl: string): Promise<void> {
    const seenProductIds = new Set<string>();
    const attemptedProductIds = new Set<string>();
    let activeSegment = this.catalogDiscovery.segmentUrl(startUrl);
    let resumeUrl = this.catalogDiscovery.normalizePageUrl(startUrl);
    this.completedCatalogSegments.delete(activeSegment);
    this.enqueueCatalogSegment(activeSegment);

    for (;;) {
      this.state.activeCatalogSegment = activeSegment;
      this.state.resumeCatalogUrl = resumeUrl;
      await this.persistState();
      await this.crawlCatalogSegment(
        page,
        resumeUrl,
        seenProductIds,
        attemptedProductIds,
      );
      if (this.state.status !== 'RUNNING') return;

      this.completedCatalogSegments.add(activeSegment);
      this.state.catalogSegmentsCompleted = this.completedCatalogSegments.size;
      const nextSegment = this.catalogSegments.find(
        (segment) => !this.completedCatalogSegments.has(segment),
      );
      if (!nextSegment) {
        this.state.activeCatalogSegment = null;
        this.state.resumeCatalogUrl = null;
        await this.persistState();
        return;
      }
      activeSegment = nextSegment;
      resumeUrl = nextSegment;
      this.state.activeCatalogSegment = nextSegment;
      this.state.resumeCatalogUrl = nextSegment;
      await this.persistState();
      await this.delay();
    }
  }

  private async crawlCatalogSegment(
    page: Page,
    startUrl: string,
    seenProductIds: Set<string>,
    attemptedProductIds: Set<string>,
  ): Promise<void> {
    const seenCatalogUrls = new Set<string>();
    const maxPages = this.integerConfig('CRAWLER_BROWSER_MAX_CATALOG_PAGES', 50_000, 1, 50_000);
    const maxBooks = this.integerConfig('CRAWLER_BROWSER_MAX_BOOKS', 500_000, 1, 500_000);
    let catalogUrl: string | null = this.catalogDiscovery.normalizePageUrl(startUrl);

    while (
      catalogUrl &&
      !seenCatalogUrls.has(catalogUrl) &&
      this.state.catalogPagesVisited < maxPages &&
      attemptedProductIds.size < maxBooks
    ) {
      this.assertRunning();
      const currentCatalogUrl: string = catalogUrl;
      seenCatalogUrls.add(currentCatalogUrl);
      this.state.currentUrl = currentCatalogUrl;
      this.state.resumeCatalogUrl = currentCatalogUrl;
      await this.persistState();
      const catalogHtml = await this.gotoHtml(page, currentCatalogUrl);
      this.state.catalogPagesVisited += 1;

      const $ = load(catalogHtml);
      for (const segment of this.catalogDiscovery.discoverSegments(
        catalogHtml,
        currentCatalogUrl,
      )) {
        this.enqueueCatalogSegment(segment);
      }
      const discovered = $('a[href*="/catalog/product/view/"]')
        .toArray()
        .map((link) => $(link).attr('href'))
        .filter((href): href is string => Boolean(href))
        .map((href) => new URL(href, currentCatalogUrl).toString());
      const catalogProducts = discovered
        .map((url) => this.normalizeProductUrl(url))
        .filter((value): value is { url: string; productId: string; locale: StoreLocale } => Boolean(value))
        .filter(
          (product, index, products) =>
            products.findIndex(({ productId }) => productId === product.productId) === index,
        );
      const newlyDiscoveredBooks = catalogProducts
        .filter((product) => {
          if (seenProductIds.has(product.productId)) return false;
          seenProductIds.add(product.productId);
          return true;
        });
      this.state.discoveredProducts += newlyDiscoveredBooks.length;
      const localizedProducts = newlyDiscoveredBooks.flatMap((product) =>
        this.allLocalizedProductUrls(product.productId),
      );
      const observedSlugs = await this.catalog.findLocalizedSlugsObservedSince(
        localizedProducts.map((product) => ({
          slug: `books-am-${product.productId}`,
          locale: product.locale,
        })),
        this.state.startedAt ?? new Date(0).toISOString(),
        'books-html-v3',
      );
      const products = localizedProducts.filter(
        (product) => !observedSlugs.has(`books-am-${product.productId}:${product.locale}`),
      );
      this.state.productsSkipped += localizedProducts.length - products.length;

      const nextHref = $('a.next_page').first().attr('href');
      const nextCatalogUrl: string | null = nextHref
        ? this.catalogDiscovery.normalizePageUrl(
            new URL(nextHref, currentCatalogUrl).toString(),
          )
        : null;
      await this.persistState();

      let processedWholePage = true;
      const productGroups = new Map<string, typeof products>();
      for (const product of products) {
        const group = productGroups.get(product.productId) ?? [];
        group.push(product);
        productGroups.set(product.productId, group);
      }
      for (const [productId, localizedGroup] of productGroups) {
        if (
          !attemptedProductIds.has(productId) &&
          attemptedProductIds.size >= maxBooks
        ) {
          processedWholePage = false;
          break;
        }
        attemptedProductIds.add(productId);
        this.assertRunning();
        let persisted = false;
        this.finishingProduct = true;
        try {
          for (const product of localizedGroup) {
            persisted = (await this.processProduct(page, product)) || persisted;
            await this.persistState();
            await this.delay();
          }
        } finally {
          this.finishingProduct = false;
        }
        if (persisted) {
          const category = this.catalogDiscovery.categoryLocation(currentCatalogUrl);
          await this.catalog.linkBooksToCategory(
            [`books-am-${productId}`],
            category.categoryId,
            new Date().toISOString(),
          );
        }
        await this.persistState();
        this.assertRunning();
      }

      const category = this.catalogDiscovery.categoryLocation(currentCatalogUrl);
      await this.catalog.linkBooksToCategory(
        catalogProducts.map(({ productId }) => `books-am-${productId}`),
        category.categoryId,
        new Date().toISOString(),
      );

      catalogUrl = processedWholePage ? nextCatalogUrl : catalogUrl;
      this.state.resumeCatalogUrl = catalogUrl;
      await this.persistState();
      if (catalogUrl && processedWholePage) await this.delay();
    }

    if (attemptedProductIds.size >= maxBooks) {
      this.state.status = 'PAUSED';
      this.state.finishReason = 'MAX_BOOKS_PER_RUN_REACHED';
    } else if (this.state.catalogPagesVisited >= maxPages && catalogUrl) {
      this.state.status = 'PAUSED';
      this.state.finishReason = 'MAX_CATALOG_PAGES_REACHED';
    }
  }

  private async processProduct(
    page: Page,
    product: { url: string; productId: string; locale: StoreLocale },
  ): Promise<boolean> {
    this.state.currentUrl = product.url;
    this.state.productsAttempted += 1;
    try {
      const html = await this.gotoHtml(page, product.url);
      const parsed = this.parser.parse(html, page.url());
      if (parsed.quarantineReason) {
        this.state.quarantined += 1;
        this.pushError(product.url, parsed.quarantineReason);
        return false;
      }
      await this.catalog.upsert(this.toBookRecord(parsed, product));
      this.state.imported += 1;
      return true;
    } catch (error) {
      if (
        this.isBudgetExhausted(error) ||
        this.killSwitch.getState().engaged ||
        this.stopRequested ||
        this.shuttingDown
      ) {
        throw error;
      }
      this.state.failedProducts += 1;
      this.pushError(product.url, this.errorCode(error));
      return false;
    }
  }

  private async gotoHtml(page: Page, sourceUrl: string): Promise<string> {
    const timeout = this.integerConfig(
      'CRAWLER_BROWSER_NAVIGATION_TIMEOUT_MS',
      60_000,
      1_000,
      120_000,
    );
    let attempt = 0;
    for (;;) {
      this.assertRunning();
      this.budget.reserve();
      try {
        const response = await page.goto(sourceUrl, {
          waitUntil: 'commit',
          timeout,
        });
        const status = response?.status() ?? 0;
        if (status === 403 || status === 429) {
          this.killSwitch.observeHttpStatus(status, sourceUrl);
          throw new Error(`UPSTREAM_HTTP_${status}`);
        }
        if (status < 200 || status >= 400) {
          throw new Error(`UPSTREAM_HTTP_${status || 'NO_RESPONSE'}`);
        }
        const html = await this.withTimeout(
          response!.text(),
          timeout,
          'UPSTREAM_RESPONSE_BODY_TIMEOUT',
        );
        if (this.challengeDetector.isChallenge(html)) {
          this.killSwitch.observeChallenge(sourceUrl);
          throw new Error('UPSTREAM_CHALLENGE_DETECTED');
        }
        return html;
      } catch (error) {
        if (!this.isRetryableNavigationError(error)) throw error;
        attempt += 1;
        this.state.navigationRetries += 1;
        this.pushError(
          sourceUrl,
          `TRANSIENT_NAVIGATION_RETRY_${attempt}: ${this.errorCode(error)}`,
        );
        await this.persistState();
        await page.goto('about:blank', { waitUntil: 'commit', timeout: 5_000 }).catch(() => undefined);
        await this.retryDelay(attempt);
      }
    }
  }

  private toBookRecord(
    parsed: ParsedBookSnapshot,
    product: { url: string; productId: string; locale: StoreLocale },
  ): BookRecord {
    const language = this.normalizeLanguage(parsed.language) ?? product.locale;
    const author = (parsed.author ?? this.unknownAuthor(product.locale)).slice(0, 500);
    const productCode = parsed.productCode.slice(0, 128);
    const imageUrls = parsed.imageUrls.slice(0, 100);
    return {
      id: this.stableUuid(`books.am:${parsed.supplierSku}`),
      supplierSku: parsed.supplierSku.slice(0, 128),
      slug: `books-am-${product.productId}`,
      title: parsed.title.slice(0, 500),
      author,
      description: parsed.description ?? '',
      language,
      locale: product.locale,
      isbn: parsed.isbn?.slice(0, 64) ?? null,
      publisher: parsed.publisher?.slice(0, 500) ?? null,
      productCode,
      weight: parsed.weight?.slice(0, 64) ?? null,
      barcode: parsed.barcode?.slice(0, 256) ?? null,
      isNew: parsed.isNew,
      pageCount: parsed.pageCount,
      coverType: parsed.coverType?.slice(0, 256) ?? null,
      dimensions: parsed.dimensions?.slice(0, 256) ?? null,
      publicationYear: parsed.publicationYear,
      series: parsed.series,
      imageUrls,
      attributes: parsed.attributes,
      detailSections: parsed.detailSections,
      localizations: {
        [product.locale]: {
          parserVersion: parsed.parserVersion,
          locale: product.locale,
          title: parsed.title.slice(0, 500),
          author,
          description: parsed.description ?? '',
          languageLabel: parsed.language?.slice(0, 256) ?? null,
          isbn: parsed.isbn?.slice(0, 64) ?? null,
          publisher: parsed.publisher?.slice(0, 500) ?? null,
          productCode,
          weight: parsed.weight?.slice(0, 64) ?? null,
          barcode: parsed.barcode?.slice(0, 256) ?? null,
          isNew: parsed.isNew,
          pageCount: parsed.pageCount,
          coverType: parsed.coverType?.slice(0, 256) ?? null,
          dimensions: parsed.dimensions?.slice(0, 256) ?? null,
          publicationYear: parsed.publicationYear,
          series: parsed.series,
          imageUrls,
          attributes: parsed.attributes,
          detailSections: parsed.detailSections,
          sourceUrl: product.url,
          observedAt: parsed.observedAt,
        },
      },
      sourcePriceAmd: parsed.sourcePriceAmd,
      availability: parsed.preliminarilySalable
        ? 'PRELIMINARY_AVAILABLE'
        : 'OUT_OF_STOCK',
      sourceUrl: product.url,
      coverImageUrl: parsed.imageUrl,
      observedAt: parsed.observedAt,
    };
  }

  private async prepareCategories(page: Page, startUrl: string): Promise<string[]> {
    const startLocation = this.catalogDiscovery.categoryLocation(startUrl);
    const routes = ['am', 'ru', 'en'] as const;
    const trees = new Map<string, ReturnType<CrawlerCatalogDiscoveryService['discoverCategories']>>();

    for (const route of routes) {
      this.assertRunning();
      const rootUrl = `https://www.books.am/${route}/catalog/category/view/id/7463/`;
      this.state.currentUrl = rootUrl;
      await this.persistState();
      const html = await this.gotoHtml(page, rootUrl);
      const categories = this.catalogDiscovery.discoverCategories(html, rootUrl);
      if (categories.length === 0) throw new Error('CRAWLER_BOOKS_CATEGORY_TREE_EMPTY');
      trees.set(route, categories);
      await this.delay();
    }

    const baseline = new Set(trees.get('am')!.map(({ supplierCategoryId }) => supplierCategoryId));
    for (const route of routes.slice(1)) {
      const ids = new Set(trees.get(route)!.map(({ supplierCategoryId }) => supplierCategoryId));
      if (
        ids.size !== baseline.size ||
        [...baseline].some((supplierCategoryId) => !ids.has(supplierCategoryId))
      ) {
        throw new Error('CRAWLER_CATEGORY_LOCALE_TREE_MISMATCH');
      }
    }

    await this.catalog.upsertCategories(
      routes.flatMap((route) =>
        trees.get(route)!.map((category) => ({
          ...category,
          id: this.stableUuid(`books.am:category:${category.supplierCategoryId}`),
          parentId: category.parentSupplierCategoryId
            ? this.stableUuid(`books.am:category:${category.parentSupplierCategoryId}`)
            : null,
        })),
      ),
    );
    await this.catalog.linkUncategorizedBooksToCategory(
      '7463',
      new Date().toISOString(),
    );

    const preferredRoute = startLocation.locale;
    const preferred = trees.get(preferredRoute) ?? trees.get('ru')!;
    const byId = new Map(preferred.map((category) => [category.supplierCategoryId, category]));
    const depth = (categoryId: string): number => {
      let value = 0;
      let current = byId.get(categoryId);
      const seen = new Set<string>();
      while (current?.parentSupplierCategoryId && !seen.has(current.supplierCategoryId)) {
        seen.add(current.supplierCategoryId);
        value += 1;
        current = byId.get(current.parentSupplierCategoryId);
      }
      return value;
    };
    return [...preferred]
      .filter(({ supplierCategoryId }) => supplierCategoryId !== '7463')
      .sort(
        (left, right) =>
          depth(right.supplierCategoryId) - depth(left.supplierCategoryId) ||
          left.position - right.position,
      )
      .map(({ sourceUrl }) => sourceUrl);
  }

  private allLocalizedProductUrls(
    productId: string,
  ): Array<{ url: string; productId: string; locale: StoreLocale }> {
    return (['hy', 'ru', 'en'] as const).map((locale) => ({
      url: `https://www.books.am/${locale === 'hy' ? 'am' : locale}/catalog/product/view/id/${productId}/`,
      productId,
      locale,
    }));
  }

  private normalizeProductUrl(
    rawUrl: string,
  ): { url: string; productId: string; locale: StoreLocale } | null {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      return null;
    }
    if (url.protocol !== 'https:' || url.port || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }
    const match = url.pathname.match(PRODUCT_PATH);
    if (!match || url.search || url.hash) return null;
    url.hostname = 'www.books.am';
    return {
      url: url.toString(),
      productId: match[2]!,
      locale: match[1] === 'am' ? 'hy' : (match[1] as StoreLocale),
    };
  }

  private normalizeLanguage(value: string | null): StoreLocale | null {
    const normalized = value?.trim().toLocaleLowerCase() ?? '';
    if (/^(hy|am)$/u.test(normalized) || /հայ|армян/u.test(normalized)) return 'hy';
    if (/^ru$/u.test(normalized) || /рус/u.test(normalized)) return 'ru';
    if (/^en$/u.test(normalized) || /англ|english/u.test(normalized)) return 'en';
    return null;
  }

  private unknownAuthor(locale: StoreLocale): string {
    return locale === 'hy' ? 'Հեղինակը նշված չէ' : locale === 'en' ? 'Author not specified' : 'Автор не указан';
  }

  private stableUuid(value: string): string {
    const bytes = Buffer.from(createHash('sha256').update(value).digest().subarray(0, 16));
    bytes[6] = (bytes[6]! & 0x0f) | 0x50;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private catalogStartUrl(): string {
    return this.catalogDiscovery.normalizePageUrl(
      this.config.get<string>('CRAWLER_BROWSER_CATALOG_URL', DEFAULT_CATALOG_URL),
    );
  }

  private enqueueCatalogSegment(segmentUrl: string): void {
    const normalized = this.catalogDiscovery.segmentUrl(segmentUrl);
    if (
      this.catalogSegments.includes(normalized) ||
      this.completedCatalogSegments.has(normalized)
    ) {
      return;
    }
    if (this.catalogSegments.length >= 2_000) {
      throw new Error('CRAWLER_CATALOG_SEGMENT_LIMIT_EXCEEDED');
    }
    this.catalogSegments.push(normalized);
    this.state.catalogSegmentsDiscovered = this.catalogSegments.length;
  }

  private prependCatalogSegments(segmentUrls: string[]): void {
    const prepared = segmentUrls.map((segment) => this.catalogDiscovery.segmentUrl(segment));
    this.catalogSegments = [
      ...new Set([
        ...prepared.filter((segment) => !this.completedCatalogSegments.has(segment)),
        ...this.catalogSegments,
      ]),
    ];
    if (this.catalogSegments.length > 2_000) {
      throw new Error('CRAWLER_CATALOG_SEGMENT_LIMIT_EXCEEDED');
    }
    this.state.catalogSegmentsDiscovered = this.catalogSegments.length;
  }

  private assertRunning(): void {
    this.killSwitch.assertOperational();
    if (this.shuttingDown) throw new Error('PROCESS_SHUTDOWN');
    if (this.stopRequested && !this.finishingProduct) {
      throw new Error('OPERATOR_STOP_REQUESTED');
    }
  }

  private async delay(): Promise<void> {
    const delayMs = this.integerConfig('CRAWLER_MIN_REQUEST_DELAY_MS', 1_000, 250, 60_000);
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  private async retryDelay(attempt: number): Promise<void> {
    const delayMs = Math.min(2_000 * 2 ** Math.min(attempt - 1, 5), 60_000);
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  }

  private async withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    code: string,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(code)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async persistState(): Promise<void> {
    await this.checkpoints.save(
      this.getState(),
      [...this.catalogSegments],
      [...this.completedCatalogSegments],
    );
  }

  private integerConfig(name: string, fallback: number, min: number, max: number): number {
    const configured = Math.trunc(this.config.get<number>(name, fallback));
    return Math.min(Math.max(configured, min), max);
  }

  private pushError(sourceUrl: string, code: string): void {
    this.state.errors.push({ sourceUrl, code });
    if (this.state.errors.length > 100) this.state.errors.shift();
  }

  private isBudgetExhausted(error: unknown): boolean {
    return this.errorCode(error) === 'CRAWLER_DAILY_BUDGET_EXHAUSTED';
  }

  private isRetryableNavigationError(error: unknown): boolean {
    if (this.stopRequested || this.shuttingDown || this.killSwitch.getState().engaged) {
      return false;
    }
    const code = this.errorCode(error);
    return (
      /Timeout|UPSTREAM_RESPONSE_BODY_TIMEOUT|net::ERR_|ECONN|ENOTFOUND|EAI_AGAIN/iu.test(code) ||
      /^UPSTREAM_HTTP_(408|5\d\d)$/u.test(code)
    );
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && 'code' in response) {
        const code = (response as { code?: unknown }).code;
        if (typeof code === 'string') return code;
      }
      return `HTTP_${error.getStatus()}`;
    }
    if (error instanceof Error) return error.message || error.name;
    return 'UNKNOWN_CRAWLER_ERROR';
  }
}
