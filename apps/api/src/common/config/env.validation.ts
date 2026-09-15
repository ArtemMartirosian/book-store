type RawEnvironment = Record<string, unknown>;

const DEVELOPMENT_ADMIN_API_KEY = 'development-admin-api-key-change-me';
const DEVELOPMENT_ADMIN_USERNAME = 'admin';
const DEVELOPMENT_ADMIN_PASSWORD = 'development-admin-password-change-me';
const KNOWN_INSECURE_ADMIN_API_KEYS = new Set([
  DEVELOPMENT_ADMIN_API_KEY,
  'replace-with-at-least-32-random-characters',
]);
const KNOWN_INSECURE_ADMIN_PASSWORDS = new Set([
  DEVELOPMENT_ADMIN_PASSWORD,
  'replace-with-at-least-16-random-characters',
]);

const integer = (
  env: RawEnvironment,
  key: string,
  fallback: number,
  minimum = 0,
  maximum = Number.MAX_SAFE_INTEGER,
): number => {
  const raw = env[key];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);

  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} must be a safe integer between ${minimum} and ${maximum}`);
  }

  return value;
};

const boolean = (env: RawEnvironment, key: string, fallback: boolean): boolean => {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  throw new Error(`${key} must be either true or false`);
};

export const validateEnvironment = (env: RawEnvironment): RawEnvironment => {
  const nodeEnv = String(env.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const suppliedAdminApiKey = String(env.ADMIN_API_KEY ?? '').trim();
  const adminApiKey = suppliedAdminApiKey || DEVELOPMENT_ADMIN_API_KEY;
  const suppliedAdminUsername = String(env.ADMIN_USERNAME ?? '').trim();
  const adminUsername = suppliedAdminUsername || DEVELOPMENT_ADMIN_USERNAME;
  const suppliedAdminPassword = String(env.ADMIN_PASSWORD ?? '');
  const adminPassword = suppliedAdminPassword || DEVELOPMENT_ADMIN_PASSWORD;
  if (nodeEnv === 'production') {
    if (!suppliedAdminApiKey) {
      throw new Error('ADMIN_API_KEY must be explicitly configured in production');
    }
    if (KNOWN_INSECURE_ADMIN_API_KEYS.has(adminApiKey.toLowerCase())) {
      throw new Error('ADMIN_API_KEY cannot use a known default or placeholder in production');
    }
    if (adminApiKey.length < 32) {
      throw new Error('ADMIN_API_KEY must contain at least 32 characters in production');
    }
    if (!suppliedAdminUsername || !suppliedAdminPassword) {
      throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be explicitly configured in production');
    }
    if (!/^[A-Za-z0-9._-]{3,64}$/u.test(adminUsername)) {
      throw new Error('ADMIN_USERNAME must contain 3-64 safe ASCII characters');
    }
    if (
      adminPassword.length < 16 ||
      KNOWN_INSECURE_ADMIN_PASSWORDS.has(adminPassword.toLowerCase())
    ) {
      throw new Error('ADMIN_PASSWORD must contain at least 16 non-placeholder characters');
    }
  }

  const persistenceAdapter = String(
    env.PERSISTENCE_ADAPTER ?? (nodeEnv === 'production' ? 'POSTGRES' : 'IN_MEMORY'),
  ).toUpperCase();
  if (!['IN_MEMORY', 'POSTGRES'].includes(persistenceAdapter)) {
    throw new Error('PERSISTENCE_ADAPTER must be IN_MEMORY or POSTGRES');
  }
  if (nodeEnv === 'production' && persistenceAdapter !== 'POSTGRES') {
    throw new Error('PERSISTENCE_ADAPTER must be POSTGRES in production');
  }

  const databaseUrl = String(env.DATABASE_URL ?? '').trim();
  if (persistenceAdapter === 'POSTGRES') {
    if (!databaseUrl) {
      throw new Error('DATABASE_URL must be configured when PERSISTENCE_ADAPTER=POSTGRES');
    }
    try {
      const parsed = new URL(databaseUrl);
      if (
        !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        !parsed.pathname ||
        parsed.pathname === '/'
      ) {
        throw new Error('invalid PostgreSQL URL');
      }
    } catch {
      throw new Error('DATABASE_URL must be a valid postgres:// or postgresql:// URL');
    }
  }

  const crawlerLiveEnabled = boolean(env, 'CRAWLER_LIVE_ENABLED', false);
  const crawlerWrittenPermission = boolean(env, 'CRAWLER_WRITTEN_PERMISSION', false);
  const crawlerDailyRequestBudget = integer(env, 'CRAWLER_DAILY_REQUEST_BUDGET', 0);
  if (
    crawlerLiveEnabled &&
    (nodeEnv !== 'production' || !crawlerWrittenPermission || crawlerDailyRequestBudget < 1)
  ) {
    throw new Error(
      'Live crawler requires NODE_ENV=production, written permission and a positive budget',
    );
  }

  const crawlerUserAgent = String(
    env.CRAWLER_USER_AGENT ?? 'LUMIBooksCatalogBot/0.1 (+mailto:crawler-ops@lumi.am)',
  );
  if (crawlerUserAgent.length < 16 || !crawlerUserAgent.toLocaleLowerCase().includes('lumi')) {
    throw new Error('CRAWLER_USER_AGENT must identify the LUMI crawler and its operator');
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    API_HOST: String(env.API_HOST ?? '0.0.0.0'),
    API_PORT: integer(env, 'API_PORT', 4000, 1),
    TRUST_PROXY_HOPS: integer(env, 'TRUST_PROXY_HOPS', 0, 0, 10),
    CORS_ORIGINS: String(env.CORS_ORIGINS ?? 'http://localhost:3000'),
    ADMIN_API_KEY: adminApiKey,
    ADMIN_USERNAME: adminUsername,
    ADMIN_PASSWORD: adminPassword,
    PERSISTENCE_ADAPTER: persistenceAdapter,
    DATABASE_URL: databaseUrl || undefined,
    PRICE_MARKUP_PER_ITEM_AMD: integer(env, 'PRICE_MARKUP_PER_ITEM_AMD', 500),
    DELIVERY_FEE_AMD: integer(env, 'DELIVERY_FEE_AMD', 1000),
    ESTIMATED_LAST_MILE_COST_AMD: integer(env, 'ESTIMATED_LAST_MILE_COST_AMD', 1000),
    ESTIMATED_INBOUND_DELIVERY_COST_AMD: integer(
      env,
      'ESTIMATED_INBOUND_DELIVERY_COST_AMD',
      0,
    ),
    ESTIMATED_PACKAGING_COST_AMD: integer(env, 'ESTIMATED_PACKAGING_COST_AMD', 0),
    PRICING_RISK_BUFFER_AMD: integer(env, 'PRICING_RISK_BUFFER_AMD', 0),
    MIN_PROJECTED_MARGIN_AMD: integer(env, 'MIN_PROJECTED_MARGIN_AMD', 0),
    CRAWLER_LIVE_ENABLED: crawlerLiveEnabled,
    CRAWLER_WRITTEN_PERMISSION: crawlerWrittenPermission,
    CRAWLER_DAILY_REQUEST_BUDGET: crawlerDailyRequestBudget,
    CRAWLER_USER_AGENT: crawlerUserAgent,
    CRAWLER_REQUEST_TIMEOUT_MS: integer(
      env,
      'CRAWLER_REQUEST_TIMEOUT_MS',
      10_000,
      500,
      30_000,
    ),
    CRAWLER_MAX_RESPONSE_BYTES: integer(
      env,
      'CRAWLER_MAX_RESPONSE_BYTES',
      2_097_152,
      1_024,
      10_485_760,
    ),
    CRAWLER_MAX_SITEMAP_BYTES: integer(
      env,
      'CRAWLER_MAX_SITEMAP_BYTES',
      33_554_432,
      1_024,
      67_108_864,
    ),
    CRAWLER_MAX_REDIRECTS: integer(env, 'CRAWLER_MAX_REDIRECTS', 1, 0, 2),
    CRAWLER_MIN_REQUEST_DELAY_MS: integer(
      env,
      'CRAWLER_MIN_REQUEST_DELAY_MS',
      1_000,
      250,
      60_000,
    ),
    CRAWLER_MAX_SITEMAP_URLS: integer(
      env,
      'CRAWLER_MAX_SITEMAP_URLS',
      200_000,
      1,
      500_000,
    ),
    CRAWLER_MAX_PRODUCTS_PER_RUN: integer(
      env,
      'CRAWLER_MAX_PRODUCTS_PER_RUN',
      50,
      1,
      500,
    ),
    CRAWLER_BROWSER_EXECUTABLE: String(
      env.CRAWLER_BROWSER_EXECUTABLE ?? '/usr/bin/chromium-browser',
    ),
    CRAWLER_BROWSER_CATALOG_URL: String(
      env.CRAWLER_BROWSER_CATALOG_URL ??
        'https://www.books.am/ru/catalog/category/view/s/knigi/id/7463/',
    ),
    CRAWLER_BROWSER_NAVIGATION_TIMEOUT_MS: integer(
      env,
      'CRAWLER_BROWSER_NAVIGATION_TIMEOUT_MS',
      60_000,
      1_000,
      120_000,
    ),
    CRAWLER_BROWSER_MAX_CATALOG_PAGES: integer(
      env,
      'CRAWLER_BROWSER_MAX_CATALOG_PAGES',
      50_000,
      1,
      50_000,
    ),
    CRAWLER_BROWSER_MAX_BOOKS: integer(
      env,
      'CRAWLER_BROWSER_MAX_BOOKS',
      500_000,
      1,
      500_000,
    ),
    CRAWLER_MAX_CHILD_SITEMAPS_PER_RUN: integer(
      env,
      'CRAWLER_MAX_CHILD_SITEMAPS_PER_RUN',
      20,
      0,
      100,
    ),
    CRAWLER_MAX_KNOWN_PRODUCT_URLS: integer(
      env,
      'CRAWLER_MAX_KNOWN_PRODUCT_URLS',
      250_000,
      1,
      500_000,
    ),
    CRAWLER_PRODUCT_REFRESH_INTERVAL_MS: integer(
      env,
      'CRAWLER_PRODUCT_REFRESH_INTERVAL_MS',
      86_400_000,
      60_000,
      2_592_000_000,
    ),
  };
};
