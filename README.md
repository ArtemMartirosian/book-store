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

## Локальный запуск

1. Скопируйте `.env.example` каждого приложения в `.env` и проверьте значения. В `apps/api/.env` обязательно замените пример `ADMIN_API_KEY` собственным секретом длиной не менее 32 символов перед использованием админки.
2. Выполните `npm ci` в `apps/web`, `apps/api` и `apps/worker`.
3. Из корня запустите API командой `npm run dev:api`, затем витрину командой `npm run dev:web`.

`docker compose -f infra/docker-compose.yml up -d` пока необязателен: PostgreSQL/Redis подготовлены для следующего persistence-этапа, а текущий runtime честно использует in-memory adapters.

Локальные адреса после запуска: витрина `http://localhost:3000`, админка `http://localhost:3000/admin`, API `http://localhost:4000/api/v1`, Swagger `http://localhost:4000/api/docs`.

По умолчанию backend использует демонстрационные in-memory repository adapters. Заказы и индекс idempotency keys теряются при рестарте процесса и не обеспечивают защиту от дублей между несколькими API-инстансами. Production также не запустится без явно заданного `ADMIN_API_KEY` и отклонит известные значения по умолчанию/placeholder. Permission-gated sitemap/HTML crawler реализован, но живой обход выключен: development/test не могут открыть gate, а production требует письменного разрешения, явного enable-флага и положительного request budget. Без них доступны только fixtures и dry-run; личный кабинет, checkout и защиту Books.am проект не автоматизирует.

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

Storefront, admin и API связаны end-to-end, но каталог и persistence пока демонстрационные. Текущая идемпотентность действует только в памяти одного процесса. Production PostgreSQL adapter должен в одной DB-транзакции сохранить idempotency key/request hash, заказ, позиции и единственную procurement-задачу; при конфликте уникального ключа он перечитывает строку и возвращает существующий заказ только при совпадении hash. До production также нужны проверенные migrations, transactional outbox, письменное разрешение Books.am, durable queue, identity/RBAC, фискальная и курьерская интеграции, юридические документы и мониторинг.

Подробные продуктовые и юридические требования находятся в `TECHNICAL_SPECIFICATION.md`.
