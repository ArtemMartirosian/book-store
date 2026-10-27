-- Add a customer-facing address without changing supplier identity or old URLs.
ALTER TABLE "catalog_books" ADD COLUMN "public_slug" VARCHAR(180);
CREATE UNIQUE INDEX "catalog_books_public_slug_key" ON "catalog_books"("public_slug");
