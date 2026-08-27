# Books Store API

NestJS 11 + Fastify modular monolith for the Yerevan books storefront. The current persistence adapters are deliberately in-memory so the UI and workflows can be developed without pretending that the production database is ready.

## Modules

- `CatalogModule` — local book catalog and server-computed customer prices.
- `PricingModule` — integer-AMD rules: source price + 500 AMD per copy and 1000 AMD once per order, with a projected-margin guard.
- `OrdersModule` — idempotent, Yerevan-only cash-on-delivery purchase requests, cash collection state and an explicit order state machine.
- `ProcurementModule` — local, one-task-per-order manual procurement queue; it contains no supplier network adapter.
- `AdminModule` — API-key-protected order, procurement-queue and crawler operations.
- `CrawlerModule` — fixture parser plus a disabled-by-default, permission-gated sitemap/HTML ingestion pipeline.
- `HealthModule` — liveness/readiness endpoints.

All REST endpoints are under `/api/v1`. Swagger is served at `/api/docs`.

## Local development

```bash
cp .env.example .env
npm ci
npm run start:dev
```

Before using any operator endpoint, replace the example `ADMIN_API_KEY` with a private value of at least 32 characters. Production startup requires an explicitly configured key and rejects the committed placeholder and the development default. The smoke test applies the same checks and must receive exactly the key used by the running API.

`TRUST_PROXY_HOPS` defaults to `0`, so direct clients cannot spoof `X-Forwarded-For` to evade IP rate limits. Set it only to the exact number of trusted reverse-proxy hops in the deployed topology; never enable blanket proxy trust.

Useful commands:

```bash
npm run typecheck
npm test
npm run build
npm run prisma:validate
npm run smoke # requires a separately running API and ADMIN_API_KEY
```

The committed npm lockfile is synchronized with the exact versions in `package.json`; use `npm ci` for reproducible local and container installs. Public catalog and order responses carry a `hy`, `ru` or `en` locale, with `hy` as the content fallback locale.

## Production-shaped in-memory order contract

The MVP still stores data in memory, but its public contract is shaped so that it can be moved to the proposed PostgreSQL schema without weakening business invariants. Idempotency is currently process-local: the guarantees below hold only for the lifetime of one API process, and a restart loses both orders and their idempotency-key index.

Every `POST /api/v1/orders` request must include an 8-128 character `Idempotency-Key` header. The service stores the key together with a SHA-256 hash of the canonicalized request payload:

- the same key and the same request hash return the original order and do not create another procurement task;
- the same key with a different request hash is rejected as an idempotency conflict;
- the key is unique for order creation and remains reserved for the lifetime of the order record.

Checkout also sends an integer `expectedTotalAmd` and `expectedPricingRuleVersion` (currently `amd-fixed-v1`). The API always recalculates the quote from its own catalog and pricing configuration. If either expectation is stale, it returns HTTP `409` with `{ code: "QUOTE_CHANGED", currentTotalAmd, currentPricingRuleVersion }` before saving an order or creating a procurement task; the client must show the new quote and ask the customer to submit again.

Delivery is restricted to one of the twelve Yerevan district codes: `AJAPNYAK`, `ARABKIR`, `AVAN`, `DAVTASHEN`, `EREBUNI`, `KANAKER_ZEYTUN`, `KENTRON`, `MALATIA_SEBASTIA`, `NOR_NORK`, `NORK_MARASH`, `NUBARASHEN` or `SHENGAVIT`. Free-form delivery addresses remain required, but they do not replace the district allowlist.

Cash on delivery is stored independently from the customer-facing order status. A new order records `cashDueAmd` and starts in `CASH_DUE`. The only MVP cash states are `CASH_DUE`, `CASH_COLLECTED`, `CASH_RECONCILED` and `CASH_REFUSED`. Collection records `collectedAt` and the seller's `fiscalReceiptNumber`; reconciliation records `reconciledAt` and a `cashReconciliationReference`. Refusal records a non-empty `cashRefusalReason`. `cashDueAmd` is an integer AMD snapshot of the amount the courier must collect and must equal the accepted order total for this COD-only MVP. A fiscal receipt number can belong to only one order; reuse on another order returns HTTP `409` with `FISCAL_RECEIPT_NUMBER_ALREADY_USED`. `DELIVERED` is rejected until cash has passed through collection and reached `CASH_RECONCILED`.

Creating an order also creates exactly one `ProcurementTask` in `PENDING_OPERATOR`. Its supported outcomes are `SUPPLIER_CONFIRMED`, `SOURCE_UNAVAILABLE` and `CANCELLED`. Supplier confirmation requires a non-empty manual `supplierReference`; unavailable and cancelled outcomes require an operator note. Repeating the same outcome is idempotent only when the normalized `supplierReference` and `note` match the evidence already stored; a divergent replay returns HTTP `409` with `PROCUREMENT_EVIDENCE_CONFLICT`. The task stores the observed supplier item subtotal and immutable per-item snapshots of the product id, supplier SKU, title, source URL, quantity and observed source unit price. Supplier delivery and final supplier totals remain `null` until a future authorized manual quote workflow records them; the MVP never invents them. Operator actions must update this task instead of interpreting parsed HTML as supplier confirmation.

Protected operator commands use `x-admin-api-key` and are available under `/api/v1/admin`:

- `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`;
- `POST /orders/:id/cash/collect`, `/cash/reconcile`, `/cash/refuse`;
- `GET /procurements`, `GET /procurements/:id`, `POST /procurements/:id/transition`.

The generic status command cannot set `SUPPLIER_CONFIRMED` or `CUSTOMER_REFUSED`; those outcomes must pass through the procurement and COD commands respectively. The procurement confirmation command is accepted only while the order is `PROCUREMENT_PENDING`, then advances the order to `SUPPLIER_CONFIRMED`. None of these commands sends an HTTP request, opens a browser or clicks Books.am.

## Crawler safety contract

The crawler is implemented but inert by default. Development and test environments cannot open its live gate, and all automated tests use saved fixtures or an injected mock fetch function. A dry run performs zero network requests.

The only root sitemap targets are:

- `https://www.books.am/pub/sitemap/sitemap_hy.xml`;
- `https://www.books.am/pub/sitemap/sitemap_ru.xml`;
- `https://www.books.am/pub/sitemap/sitemap_en.xml`.

A root may reference a direct child sitemap, but discovery is limited to one level, a configured count, the exact `https://www.books.am/pub/sitemap/` prefix, a safe `.xml` filename and the same `hy`, `ru` or `en` locale marker. Cycles are deduplicated. XML is decoded incrementally and stops at configured byte and URL-entry ceilings. `CRAWLER_MAX_SITEMAP_URLS` defaults to 200,000 (maximum 500,000) so the known large HY index and the other locale entries can be discovered without confusing an XML `<loc>` count with the much smaller HTTP request budget. A truncated sitemap does not commit its conditional headers, so an incomplete scan is never treated as a completed `304` baseline.

Product fetching accepts only HTTPS URLs on the exact `books.am` / `www.books.am` hosts, with an `am`, `ru` or `en` locale and a public SEO `.html` path. Query strings, fragments, alternate subdomains, credentials, ports and protected route segments are rejected. The adapter sends no cookies or login state, uses an identifiable User-Agent, follows at most the configured number of policy-valid manual redirects, applies a whole-response timeout and byte ceiling, validates content type and supports `If-None-Match` / `If-Modified-Since`. It does not implement CAPTCHA solving, Cloudflare bypass, proxy rotation, account automation or hidden endpoints.

Every HTTP attempt, including a redirect hop, consumes the process-local UTC daily budget and respects the minimum request delay. HTTP 403, HTTP 429 or a detected challenge document latches the in-memory kill switch and halts further work until an authenticated operator explicitly resets it. The parser stores only normalized observations or quarantine outcomes through `CrawlerSnapshotRepository`.

Discovered product URLs are deduplicated into a bounded process-local queue. Each run leases the next pending batch rather than repeatedly taking the first sitemap URLs; unused leases return to pending state. Once pending work is drained, the oldest product whose `CRAWLER_PRODUCT_REFRESH_INTERVAL_MS` has elapsed becomes eligible for a round-robin refresh even when every root sitemap returns `304`. A failed or quarantined observation is terminal for its current attempt and becomes refresh-eligible only after that interval. Because this scaffold does not archive raw HTML, validators from a quarantined parse are never committed; otherwise a parser fix could be masked indefinitely by `304`. A durable adapter may commit them only together with a raw snapshot and parser version that can be reprocessed offline.

The current queue, observations, conditional headers, last-attempt timestamps and request counters are all in-memory, process-local and non-durable: a restart loses them. A production adapter must persist queue leases/cursors and refresh scheduling before completeness or crash recovery can be claimed.

Live `run-once` is accepted only when all of these are true:

- `NODE_ENV=production`;
- `CRAWLER_LIVE_ENABLED=true`;
- `CRAWLER_WRITTEN_PERMISSION=true` (set only after real written permission has been archived and reviewed);
- `CRAWLER_DAILY_REQUEST_BUDGET` is positive;
- the kill switch is not engaged.

The protected admin endpoints are `GET /api/v1/admin/crawler/status`, `GET /api/v1/admin/crawler/dry-run`, `POST /api/v1/admin/crawler/run-once` and `GET /api/v1/admin/crawler/observations`. They require `x-admin-api-key`. Keep all live flags false while developing; `POST /api/v1/admin/crawler/parse-fixture` remains the safe local workflow.

## Moving from memory to PostgreSQL

Repository ports live in:

- `src/modules/catalog/repositories/catalog.repository.ts`
- `src/modules/orders/repositories/order.repository.ts`
- `src/modules/procurement/repositories/procurement.repository.ts`

The proposed relational starting point is in `prisma/schema.prisma`; the current runtime does not yet connect these repositories to it. The schema defines a unique order idempotency key, the twelve-value Yerevan district enum, COD collection fields and a one-to-one procurement task with immutable item snapshots.

A production adapter must enforce idempotency in PostgreSQL, not with a process-local check-then-insert. It must create the order, its items, the idempotency key/request hash and exactly one procurement task in one database transaction. A concurrent unique-key conflict must re-read the committed row and return it only when the stored request hash matches; a different hash remains a conflict. Downstream work should be recorded through an outbox in the same transaction. Until that adapter and reviewed migrations are deployed and tested, restart-safe or multi-instance idempotency must not be claimed. Do not use `db push` against production.

Before enabling production traffic, add customer/admin identity, encrypted PII storage, an outbox/queue, fiscal receipt integration, audit logs, monitoring, backups and a written Books.am crawling/content-use/procurement agreement.
