ALTER TABLE "catalog_books"
  ADD COLUMN "product_code" VARCHAR(128),
  ADD COLUMN "weight" VARCHAR(64),
  ADD COLUMN "barcode" VARCHAR(256),
  ADD COLUMN "is_new" BOOLEAN,
  ADD COLUMN "page_count" INTEGER,
  ADD COLUMN "cover_type" VARCHAR(256),
  ADD COLUMN "dimensions" VARCHAR(256),
  ADD COLUMN "publication_year" INTEGER,
  ADD COLUMN "series" TEXT,
  ADD COLUMN "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "detail_sections" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "parser_version" VARCHAR(64) NOT NULL DEFAULT 'books-html-v1';

UPDATE "catalog_books"
SET
  "product_code" = "supplier_sku",
  "image_urls" = CASE
    WHEN "cover_image_url" IS NULL THEN ARRAY[]::TEXT[]
    ELSE ARRAY["cover_image_url"]::TEXT[]
  END;

CREATE TABLE "catalog_book_translations" (
  "id" UUID NOT NULL,
  "book_id" UUID NOT NULL,
  "locale" VARCHAR(2) NOT NULL,
  "parser_version" VARCHAR(64) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "author" VARCHAR(500) NOT NULL,
  "description" TEXT NOT NULL,
  "language_label" VARCHAR(256),
  "isbn" VARCHAR(64),
  "publisher" VARCHAR(500),
  "product_code" VARCHAR(128) NOT NULL,
  "weight" VARCHAR(64),
  "barcode" VARCHAR(256),
  "is_new" BOOLEAN,
  "page_count" INTEGER,
  "cover_type" VARCHAR(256),
  "dimensions" VARCHAR(256),
  "publication_year" INTEGER,
  "series" TEXT,
  "image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "attributes" JSONB NOT NULL DEFAULT '[]',
  "detail_sections" JSONB NOT NULL DEFAULT '[]',
  "source_url" VARCHAR(2048) NOT NULL,
  "observed_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "catalog_book_translations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_book_translations_locale_check" CHECK ("locale" IN ('hy', 'ru', 'en')),
  CONSTRAINT "catalog_book_translations_attributes_array_check" CHECK (jsonb_typeof("attributes") = 'array'),
  CONSTRAINT "catalog_book_translations_detail_sections_array_check" CHECK (jsonb_typeof("detail_sections") = 'array')
);

CREATE UNIQUE INDEX "catalog_book_translations_source_url_key"
  ON "catalog_book_translations"("source_url");

CREATE UNIQUE INDEX "catalog_book_translations_book_id_locale_key"
  ON "catalog_book_translations"("book_id", "locale");

CREATE INDEX "catalog_book_translations_locale_observed_at_book_id_idx"
  ON "catalog_book_translations"("locale", "observed_at" DESC, "book_id");

ALTER TABLE "catalog_book_translations"
  ADD CONSTRAINT "catalog_book_translations_book_id_fkey"
  FOREIGN KEY ("book_id") REFERENCES "catalog_books"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "catalog_book_translations" (
  "id", "book_id", "locale", "parser_version", "title", "author",
  "description", "language_label", "isbn", "publisher", "product_code",
  "image_urls", "source_url", "observed_at", "updated_at"
)
SELECT
  "id", "id", "locale", 'books-html-v1', "title", "author",
  "description", "language", "isbn", "publisher", "supplier_sku",
  CASE
    WHEN "cover_image_url" IS NULL THEN ARRAY[]::TEXT[]
    ELSE ARRAY["cover_image_url"]::TEXT[]
  END,
  "source_url", "observed_at", "updated_at"
FROM "catalog_books";

ALTER TABLE "catalog_books"
  ADD CONSTRAINT "catalog_books_page_count_check"
    CHECK ("page_count" IS NULL OR "page_count" > 0),
  ADD CONSTRAINT "catalog_books_publication_year_check"
    CHECK ("publication_year" IS NULL OR "publication_year" BETWEEN 1000 AND 2999),
  ADD CONSTRAINT "catalog_books_attributes_array_check"
    CHECK (jsonb_typeof("attributes") = 'array'),
  ADD CONSTRAINT "catalog_books_detail_sections_array_check"
    CHECK (jsonb_typeof("detail_sections") = 'array');
