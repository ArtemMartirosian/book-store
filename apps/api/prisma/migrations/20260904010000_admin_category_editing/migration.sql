ALTER TABLE "catalog_categories"
ADD COLUMN "manual_edited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "catalog_category_translations"
ADD COLUMN "manual_edited" BOOLEAN NOT NULL DEFAULT false;
