# LUMI Books Worker

Standalone NestJS application context for scheduled crawler dispatch. The worker contacts only the configured LUMI API; the API owns every supplier URL, fetch and kill-switch decision.

```bash
cp .env.example .env
npm ci
npm run start:dev
```

The worker is disabled by default. For local development, start the API, use the same `ADMIN_API_KEY` in both applications, set `WORKER_ENABLED=true`, and keep `WORKER_MODE=FIXTURE_ONLY`. That mode calls only the API's saved-fixture parser.

`WORKER_MODE=PERMISSION_GATED_HTML` dispatches the API's protected `run-once` command only when the worker is enabled and all four safety conditions are present: production mode, `CRAWLER_LIVE_ENABLED=true`, `CRAWLER_WRITTEN_PERMISSION=true`, and a positive `CRAWLER_DAILY_REQUEST_BUDGET`. Environment validation refuses an enabled live worker otherwise. The API independently enforces the same gate, exact URL policies, budget and latched kill switch.

The committed lockfile is synchronized with the exact versions in `package.json`; use `npm ci` for reproducible installs.

HTTP 403, 429 or 503 from the API latches a local stop for the lifetime of the worker process. This worker contains no supplier fetch adapter, cookie jar, login flow, CAPTCHA handling or Cloudflare bypass. The API's current snapshots and request budget are process-local and non-durable; production scheduling still needs durable queue/outbox infrastructure and operator alerting before it can be treated as reliable ingestion.
