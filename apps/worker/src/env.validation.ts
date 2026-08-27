type RawEnvironment = Record<string, unknown>;

const integer = (env: RawEnvironment, key: string, fallback: number, minimum: number): number => {
  const raw = env[key];
  const value = raw === undefined || raw === '' ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${key} must be a safe integer >= ${minimum}`);
  }
  return value;
};

const boolean = (env: RawEnvironment, key: string, fallback: boolean): boolean => {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw === true || raw === 'true') return true;
  if (raw === false || raw === 'false') return false;
  throw new Error(`${key} must be true or false`);
};

export const validateWorkerEnvironment = (env: RawEnvironment): RawEnvironment => {
  const nodeEnv = String(env.NODE_ENV ?? 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) {
    throw new Error('NODE_ENV must be development, test, or production');
  }

  const mode = String(env.WORKER_MODE ?? 'FIXTURE_ONLY');
  if (!['FIXTURE_ONLY', 'PERMISSION_GATED_HTML'].includes(mode)) {
    throw new Error('WORKER_MODE must be FIXTURE_ONLY or PERMISSION_GATED_HTML');
  }

  const workerEnabled = boolean(env, 'WORKER_ENABLED', false);
  const crawlerLiveEnabled = boolean(env, 'CRAWLER_LIVE_ENABLED', false);
  const writtenPermission = boolean(env, 'CRAWLER_WRITTEN_PERMISSION', false);
  const dailyBudget = integer(env, 'CRAWLER_DAILY_REQUEST_BUDGET', 0, 0);
  if (
    workerEnabled &&
    mode === 'PERMISSION_GATED_HTML' &&
    (nodeEnv !== 'production' ||
      !crawlerLiveEnabled ||
      !writtenPermission ||
      dailyBudget < 1)
  ) {
    throw new Error(
      'Enabled PERMISSION_GATED_HTML mode requires production, live enablement, written permission and a positive budget',
    );
  }

  const baseUrl = String(env.API_BASE_URL ?? 'http://localhost:4000/api/v1');
  const parsedBaseUrl = new URL(baseUrl);
  if (!['http:', 'https:'].includes(parsedBaseUrl.protocol)) {
    throw new Error('API_BASE_URL must use HTTP or HTTPS');
  }

  const fixtureName = String(env.CRAWLER_FIXTURE_NAME ?? 'book-detail');
  if (!['book-detail', 'book-price-conflict'].includes(fixtureName)) {
    throw new Error('CRAWLER_FIXTURE_NAME is not a bundled fixture');
  }

  return {
    ...env,
    NODE_ENV: nodeEnv,
    WORKER_ENABLED: workerEnabled,
    WORKER_MODE: mode,
    CRAWLER_LIVE_ENABLED: crawlerLiveEnabled,
    CRAWLER_WRITTEN_PERMISSION: writtenPermission,
    CRAWLER_DAILY_REQUEST_BUDGET: dailyBudget,
    API_BASE_URL: baseUrl.replace(/\/$/u, ''),
    ADMIN_API_KEY: String(env.ADMIN_API_KEY ?? 'development-admin-api-key-change-me'),
    CRAWLER_FIXTURE_NAME: fixtureName,
    POLL_INTERVAL_MS: integer(env, 'POLL_INTERVAL_MS', 300_000, 60_000),
    REQUEST_TIMEOUT_MS: integer(env, 'REQUEST_TIMEOUT_MS', 10_000, 1_000),
  };
};
