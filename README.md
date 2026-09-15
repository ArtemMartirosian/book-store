# LUMI Books

Современный книжный магазин для Еревана: публичная витрина и админка на Next.js, modular-monolith API на NestJS, отдельный worker для разрешённого HTML-каталога и фоновых задач.

## Структура

```text
apps/
  web/       Next.js App Router: storefront, cart, account, admin
  api/       NestJS + Fastify: catalog, pricing, orders, crawler, admin
  worker/    background jobs and HTML ingestion orchestration
infra/       local PostgreSQL and Redis
docs/        ADR и эксплуатационные заметки
```

## Docker preview

Compose не содержит admin key по умолчанию и не запустит API/worker без явно
заданного `LUMI_ADMIN_API_KEY`. Один раз создайте локальный файл окружения и
замените намеренно нерабочий placeholder уникальным секретом длиной не менее
32 символов. Файл `.env` исключён из Git:

```bash
cp .env.example .env
openssl rand -hex 32
```

Вставьте вывод второй команды как значение `LUMI_ADMIN_API_KEY` в `.env`.
Витрина, API и worker после этого запускаются одной командой:

```bash
docker compose --env-file .env -p lumi-books -f infra/docker-compose.yml up -d --build
```

Docker Compose хранит заказы и закупочные задачи в именованном PostgreSQL volume
`lumi_postgres`. Перед стартом API сервис `migrate` ждёт готовности PostgreSQL и
применяет все versioned Prisma migrations; при ошибке миграции API не запускается.
Worker остаётся в безопасном `FIXTURE_ONLY`-режиме. Live-обход Books.am выключен.
Локальные адреса:

- витрина: `http://localhost:3000/ru`;
- админка: `http://localhost:3000/admin`;
- API: `http://localhost:4000/api/v1`;
- Swagger: `http://localhost:4000/api/docs`.

PostgreSQL и Redis доступны только с localhost на портах `55432` и `56379`;
внутри Compose-сети сервисы продолжают использовать стандартные `5432` и `6379`.

Остановить контейнеры LUMI Books:

```bash
docker compose --env-file .env -p lumi-books -f infra/docker-compose.yml down
```

Обычный `down` сохраняет PostgreSQL volume, поэтому заказы переживают перезапуск контейнеров.

## Локальный запуск

1. Скопируйте `.env.example` каждого приложения в `.env` и проверьте значения. В `apps/api/.env` обязательно замените пример `ADMIN_API_KEY` собственным секретом длиной не менее 32 символов перед использованием админки.
2. Выполните `npm ci` в `apps/web`, `apps/api` и `apps/worker`.
3. Из корня запустите API командой `npm run dev:api`, затем витрину командой `npm run dev:web`.

При прямом локальном запуске API использует `PERSISTENCE_ADAPTER=IN_MEMORY`. Чтобы
проверять PostgreSQL без Compose, установите `PERSISTENCE_ADAPTER=POSTGRES`, задайте
доступный `DATABASE_URL` и сначала выполните `npm run prisma:migrate:deploy` в `apps/api`.

Локальные адреса после запуска: витрина `http://localhost:3000`, админка `http://localhost:3000/admin`, API `http://localhost:4000/api/v1`, Swagger `http://localhost:4000/api/docs`.

Docker Compose явно включает PostgreSQL adapter; локальная разработка и тесты по
умолчанию остаются на быстром in-memory adapter. Production также не запустится без
явно заданного `ADMIN_API_KEY` и отклонит известные placeholder-значения. Permission-gated
crawler реализован, но live-режим выключен; без разрешения доступны только fixtures и dry-run.

API по умолчанию не доверяет `X-Forwarded-*` заголовкам (`TRUST_PROXY_HOPS=0`). За reverse proxy задайте точное число доверенных hop; безусловное доверие всем proxy позволяет обходить IP rate limit подменой заголовка.

Проверка всего monorepo без запуска серверов: `npm test`. Полная проверка вместе со сборкой всех приложений: `npm run verify`.

После запуска API команда ниже выполняет сквозной smoke-тест: идемпотентная COD-заявка, одна procurement-задача, ручное подтверждение поставщика, фискальный номер, кассовая сверка и доставка.

```bash
ADMIN_API_KEY="$YOUR_CONFIGURED_ADMIN_API_KEY" npm run smoke:api
```

`YOUR_CONFIGURED_ADMIN_API_KEY` должен содержать тот же реальный секрет, с которым был запущен API. Smoke завершается до первого HTTP-запроса, если ключ отсутствует, слишком короткий или равен известному примеру; номера supplier confirmation, фискального документа и кассовой сверки уникальны для каждого запуска.

## Зафиксированные правила MVP

- Наценка: `500 AMD × количество книг`.
- Доставка клиенту по разрешённой зоне Еревана: `1 000 AMD` за заказ.
- Цена и наличие из HTML — наблюдение, а не подтверждённая закупочная quote.
- Заявка клиента становится подтверждённым заказом только после supplier confirmation.
- География MVP — только разрешённые адреса Еревана.
- Клиент платит наличными курьеру при получении; онлайн-оплата в MVP выключена.
- Закупку у Books.am выполняет оператор через письменно согласованный B2B-канал и только после подтверждения заявки клиента.
- Повторная отправка того же checkout возвращает ту же заявку; повторное использование ключа с другим payload блокируется.
- Checkout передаёт `expectedTotalAmd` и `expectedPricingRuleVersion`; API пересчитывает цену самостоятельно и до записи заказа возвращает `409 QUOTE_CHANGED` с актуальной суммой/версией, если предложение устарело.
- Повтор procurement outcome идемпотентен только с теми же нормализованными `supplierReference`/`note`; несовпадение возвращает `409 PROCUREMENT_EVIDENCE_CONFLICT`. Один номер фискального документа нельзя использовать для разных заказов (`409 FISCAL_RECEIPT_NUMBER_ALREADY_USED`).
- `DELIVERED` запрещён, пока наличные не получены с номером фискального документа и не сверены.

Storefront, admin и API связаны end-to-end. В Docker заказы, их idempotency key/request
hash и procurement-задачи сохраняются в PostgreSQL транзакционно и переживают рестарт
API. Каталог и crawler state пока демонстрационные и остаются process-local. До production
ещё нужны transactional outbox, backups, identity/RBAC, аудит, мониторинг и внешние интеграции.

Подробные продуктовые и юридические требования находятся в `TECHNICAL_SPECIFICATION.md`.
