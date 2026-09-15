-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM (
  'REQUEST_RECEIVED',
  'CUSTOMER_CONFIRMED',
  'PROCUREMENT_PENDING',
  'SUPPLIER_CONFIRMED',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CUSTOMER_REFUSED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "CashStatus" AS ENUM (
  'CASH_DUE',
  'CASH_COLLECTED',
  'CASH_RECONCILED',
  'CASH_REFUSED'
);

-- CreateEnum
CREATE TYPE "ProcurementStatus" AS ENUM (
  'PENDING_OPERATOR',
  'SUPPLIER_CONFIRMED',
  'SOURCE_UNAVAILABLE',
  'CANCELLED'
);

-- CreateTable
CREATE TABLE "orders" (
  "id" UUID NOT NULL,
  "order_number" VARCHAR(64) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "status" "OrderStatus" NOT NULL,
  "cash_status" "CashStatus" NOT NULL,
  "fiscal_receipt_number" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "payload" JSONB NOT NULL,

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_payload_object_check"
    CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "orders_payload_id_check"
    CHECK ("payload" ->> 'id' = "id"::text),
  CONSTRAINT "orders_payload_order_number_check"
    CHECK ("payload" ->> 'orderNumber' = "order_number"),
  CONSTRAINT "orders_payload_idempotency_key_check"
    CHECK ("payload" ->> 'idempotencyKey' = "idempotency_key"),
  CONSTRAINT "orders_payload_request_hash_check"
    CHECK ("payload" ->> 'requestHash' = btrim("request_hash")),
  CONSTRAINT "orders_payload_status_check"
    CHECK ("payload" ->> 'status' = "status"::text),
  CONSTRAINT "orders_payload_cash_status_check"
    CHECK ("payload" #>> '{cod,status}' = "cash_status"::text),
  CONSTRAINT "orders_payload_receipt_check"
    CHECK (
      ("payload" #>> '{cod,fiscalReceiptNumber}')
      IS NOT DISTINCT FROM "fiscal_receipt_number"
    )
);

-- CreateTable
CREATE TABLE "procurement_tasks" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "order_number" VARCHAR(64) NOT NULL,
  "status" "ProcurementStatus" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "payload" JSONB NOT NULL,

  CONSTRAINT "procurement_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "procurement_tasks_payload_object_check"
    CHECK (jsonb_typeof("payload") = 'object'),
  CONSTRAINT "procurement_tasks_payload_id_check"
    CHECK ("payload" ->> 'id' = "id"::text),
  CONSTRAINT "procurement_tasks_payload_order_id_check"
    CHECK ("payload" ->> 'orderId' = "order_id"::text),
  CONSTRAINT "procurement_tasks_payload_order_number_check"
    CHECK ("payload" ->> 'orderNumber' = "order_number"),
  CONSTRAINT "procurement_tasks_payload_status_check"
    CHECK ("payload" ->> 'status' = "status"::text)
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "orders_fiscal_receipt_number_key"
  ON "orders"("fiscal_receipt_number");

-- CreateIndex
CREATE INDEX "orders_created_at_id_idx"
  ON "orders"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "orders_status_created_at_id_idx"
  ON "orders"("status", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_tasks_order_id_key"
  ON "procurement_tasks"("order_id");

-- CreateIndex
CREATE INDEX "procurement_tasks_created_at_id_idx"
  ON "procurement_tasks"("created_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "procurement_tasks_status_created_at_id_idx"
  ON "procurement_tasks"("status", "created_at" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "procurement_tasks"
  ADD CONSTRAINT "procurement_tasks_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
