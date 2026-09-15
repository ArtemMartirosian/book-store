-- The initial mirror checks used regular equality. PostgreSQL treats a NULL
-- CHECK result as accepted, so missing JSON keys could otherwise pass. Replace
-- them with null-safe comparisons and include the timestamp projections.
ALTER TABLE "orders"
  DROP CONSTRAINT "orders_payload_id_check",
  DROP CONSTRAINT "orders_payload_order_number_check",
  DROP CONSTRAINT "orders_payload_idempotency_key_check",
  DROP CONSTRAINT "orders_payload_request_hash_check",
  DROP CONSTRAINT "orders_payload_status_check",
  DROP CONSTRAINT "orders_payload_cash_status_check",
  ADD CONSTRAINT "orders_payload_id_check"
    CHECK (("payload" ->> 'id') IS NOT DISTINCT FROM "id"::text),
  ADD CONSTRAINT "orders_payload_order_number_check"
    CHECK (("payload" ->> 'orderNumber') IS NOT DISTINCT FROM "order_number"),
  ADD CONSTRAINT "orders_payload_idempotency_key_check"
    CHECK (("payload" ->> 'idempotencyKey') IS NOT DISTINCT FROM "idempotency_key"),
  ADD CONSTRAINT "orders_payload_request_hash_check"
    CHECK (("payload" ->> 'requestHash') IS NOT DISTINCT FROM btrim("request_hash")),
  ADD CONSTRAINT "orders_payload_status_check"
    CHECK (("payload" ->> 'status') IS NOT DISTINCT FROM "status"::text),
  ADD CONSTRAINT "orders_payload_cash_status_check"
    CHECK (("payload" #>> '{cod,status}') IS NOT DISTINCT FROM "cash_status"::text),
  ADD CONSTRAINT "orders_payload_created_at_check"
    CHECK (
      (("payload" ->> 'createdAt')::timestamptz)
      IS NOT DISTINCT FROM "created_at"
    ),
  ADD CONSTRAINT "orders_payload_updated_at_check"
    CHECK (
      (("payload" ->> 'updatedAt')::timestamptz)
      IS NOT DISTINCT FROM "updated_at"
    );

ALTER TABLE "procurement_tasks"
  DROP CONSTRAINT "procurement_tasks_payload_id_check",
  DROP CONSTRAINT "procurement_tasks_payload_order_id_check",
  DROP CONSTRAINT "procurement_tasks_payload_order_number_check",
  DROP CONSTRAINT "procurement_tasks_payload_status_check",
  ADD CONSTRAINT "procurement_tasks_payload_id_check"
    CHECK (("payload" ->> 'id') IS NOT DISTINCT FROM "id"::text),
  ADD CONSTRAINT "procurement_tasks_payload_order_id_check"
    CHECK (("payload" ->> 'orderId') IS NOT DISTINCT FROM "order_id"::text),
  ADD CONSTRAINT "procurement_tasks_payload_order_number_check"
    CHECK (("payload" ->> 'orderNumber') IS NOT DISTINCT FROM "order_number"),
  ADD CONSTRAINT "procurement_tasks_payload_status_check"
    CHECK (("payload" ->> 'status') IS NOT DISTINCT FROM "status"::text),
  ADD CONSTRAINT "procurement_tasks_payload_created_at_check"
    CHECK (
      (("payload" ->> 'createdAt')::timestamptz)
      IS NOT DISTINCT FROM "created_at"
    ),
  ADD CONSTRAINT "procurement_tasks_payload_updated_at_check"
    CHECK (
      (("payload" ->> 'updatedAt')::timestamptz)
      IS NOT DISTINCT FROM "updated_at"
    );
