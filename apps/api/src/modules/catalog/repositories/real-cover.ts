// Keep this case-insensitive URL pattern in sync with the PostgreSQL generated
// cover flags in 20261109000000_catalog_real_covers/migration.sql.
const supplierPlaceholder = /^https?:\/\/(www\.)?books\.am(:[0-9]+)?\/media\/catalog\/product\/(cache\/([^/?#]+\/)?)?placeholder\//iu;

export function isRealBookCover(value: string | null | undefined): boolean {
  const url = value?.replace(/^[\t\n\r ]+|[\t\n\r ]+$/gu, '');
  return Boolean(url && !supplierPlaceholder.test(url));
}

export function hasRealBookCover(
  cover: string | null | undefined,
  gallery: readonly string[] | undefined,
): boolean {
  return isRealBookCover(cover) || Boolean(gallery?.some(isRealBookCover));
}
