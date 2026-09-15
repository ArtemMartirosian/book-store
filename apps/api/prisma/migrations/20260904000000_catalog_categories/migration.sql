CREATE TABLE "catalog_categories" (
    "id" UUID NOT NULL,
    "supplier_category_id" VARCHAR(128) NOT NULL,
    "parent_id" UUID,
    "position" INTEGER NOT NULL DEFAULT 0,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "catalog_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_category_translations" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "locale" VARCHAR(2) NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "source_url" VARCHAR(2048) NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "catalog_category_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "catalog_book_categories" (
    "book_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "catalog_book_categories_pkey" PRIMARY KEY ("book_id", "category_id")
);

CREATE UNIQUE INDEX "catalog_categories_supplier_category_id_key" ON "catalog_categories"("supplier_category_id");
CREATE INDEX "catalog_categories_parent_id_position_id_idx" ON "catalog_categories"("parent_id", "position", "id");
CREATE UNIQUE INDEX "catalog_category_translations_category_id_locale_key" ON "catalog_category_translations"("category_id", "locale");
CREATE UNIQUE INDEX "catalog_category_translations_source_url_key" ON "catalog_category_translations"("source_url");
CREATE INDEX "catalog_category_translations_locale_name_idx" ON "catalog_category_translations"("locale", "name");
CREATE INDEX "catalog_book_categories_category_id_book_id_idx" ON "catalog_book_categories"("category_id", "book_id");

ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "catalog_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "catalog_category_translations" ADD CONSTRAINT "catalog_category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_book_categories" ADD CONSTRAINT "catalog_book_categories_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "catalog_books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "catalog_book_categories" ADD CONSTRAINT "catalog_book_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "catalog_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
