ALTER TABLE "catalog_books"
ADD COLUMN "manual_edited" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "catalog_book_translations"
ADD COLUMN "manual_edited" BOOLEAN NOT NULL DEFAULT false;
