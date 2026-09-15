CREATE TABLE "crawler_checkpoints" (
  "id" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "current_url" VARCHAR(2048),
  "resume_catalog_url" VARCHAR(2048),
  "catalog_pages_visited" INTEGER NOT NULL DEFAULT 0,
  "discovered_products" INTEGER NOT NULL DEFAULT 0,
  "products_attempted" INTEGER NOT NULL DEFAULT 0,
  "imported" INTEGER NOT NULL DEFAULT 0,
  "quarantined" INTEGER NOT NULL DEFAULT 0,
  "failed_products" INTEGER NOT NULL DEFAULT 0,
  "navigation_retries" INTEGER NOT NULL DEFAULT 0,
  "finish_reason" TEXT,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "crawler_checkpoints_pkey" PRIMARY KEY ("id")
);
