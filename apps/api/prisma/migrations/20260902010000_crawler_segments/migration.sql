ALTER TABLE "crawler_checkpoints"
  ADD COLUMN "products_skipped" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "catalog_segments_discovered" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "catalog_segments_completed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "active_catalog_segment" VARCHAR(2048),
  ADD COLUMN "catalog_segments" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "completed_catalog_segments" JSONB NOT NULL DEFAULT '[]';
