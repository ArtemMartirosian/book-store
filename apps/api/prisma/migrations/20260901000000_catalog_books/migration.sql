-- CreateTable
CREATE TABLE "catalog_books" (
  "id" UUID NOT NULL,
  "supplier_sku" VARCHAR(128) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "author" VARCHAR(500) NOT NULL,
  "description" TEXT NOT NULL,
  "language" VARCHAR(2) NOT NULL,
  "locale" VARCHAR(2) NOT NULL,
  "isbn" VARCHAR(64),
  "publisher" VARCHAR(500),
  "source_price_amd" INTEGER NOT NULL,
  "availability" VARCHAR(32) NOT NULL,
  "source_url" VARCHAR(2048) NOT NULL,
  "cover_image_url" VARCHAR(2048),
  "observed_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "catalog_books_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "catalog_books_source_price_check" CHECK ("source_price_amd" > 0),
  CONSTRAINT "catalog_books_language_check" CHECK ("language" IN ('hy', 'ru', 'en')),
  CONSTRAINT "catalog_books_locale_check" CHECK ("locale" IN ('hy', 'ru', 'en')),
  CONSTRAINT "catalog_books_availability_check" CHECK (
    "availability" IN ('PRELIMINARY_AVAILABLE', 'OUT_OF_STOCK')
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_books_supplier_sku_key"
  ON "catalog_books"("supplier_sku");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_books_slug_key" ON "catalog_books"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "catalog_books_source_url_key"
  ON "catalog_books"("source_url");

-- CreateIndex
CREATE INDEX "catalog_books_observed_at_id_idx"
  ON "catalog_books"("observed_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "catalog_books_availability_observed_at_id_idx"
  ON "catalog_books"("availability", "observed_at" DESC, "id" DESC);
