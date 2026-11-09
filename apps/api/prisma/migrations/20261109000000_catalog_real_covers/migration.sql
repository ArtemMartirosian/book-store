-- Derived cover facts, never replacing manually maintained or imported URLs.
-- Keep the placeholder URL pattern in sync with repositories/real-cover.ts.
BEGIN;

CREATE FUNCTION catalog_has_real_cover_gallery(image_urls text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM unnest(image_urls) AS gallery(image_url)
    WHERE NULLIF(btrim(gallery.image_url, E' \t\n\r'), '') !~*
      '^https?://(www[.])?books[.]am(:[0-9]+)?/media/catalog/product/(cache/([^/?#]+/)?)?placeholder/'
  );
$$;

ALTER TABLE "catalog_books"
  ADD COLUMN "has_real_primary_cover" boolean GENERATED ALWAYS AS
    (catalog_has_real_cover_gallery(ARRAY["cover_image_url"::text])) STORED NOT NULL,
  ADD COLUMN "has_real_cover" boolean GENERATED ALWAYS AS
    (catalog_has_real_cover_gallery(array_prepend("cover_image_url"::text, "image_urls"))) STORED NOT NULL;

ALTER TABLE "catalog_book_translations"
  ADD COLUMN "has_real_cover" boolean GENERATED ALWAYS AS
    (catalog_has_real_cover_gallery("image_urls")) STORED NOT NULL;

CREATE INDEX "catalog_books_recommended_idx" ON "catalog_books"
  ("has_real_cover" DESC, "observed_at" DESC, "id" DESC);

COMMIT;
