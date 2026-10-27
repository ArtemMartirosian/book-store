import type { Prisma } from '@prisma/client';
import { publicBookSlugCandidate } from './public-book-slug';

export const MAX_PUBLIC_SLUG_ATTEMPTS = 64;

/** All legacy addresses remain reserved, including hand-authored ones. */
export async function allocatePublicBookSlug(
  client: Prisma.TransactionClient,
  title: string,
  id: string,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_PUBLIC_SLUG_ATTEMPTS; attempt += 1) {
    const candidate = publicBookSlugCandidate(title, id, attempt);
    const occupied = await client.catalogBook.findFirst({
      where: { id: { not: id }, OR: [{ publicSlug: candidate }, { slug: candidate }] },
      select: { id: true },
    });
    if (!occupied) return candidate;
  }
  throw new Error('PUBLIC_BOOK_SLUG_ALLOCATION_EXHAUSTED');
}

export function retryableCatalogSlugError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2002') return false;
  const target = 'meta' in error && error.meta && typeof error.meta === 'object' && 'target' in error.meta
    ? String(error.meta.target)
    : '';
  return /public_?slug|supplier_?sku/iu.test(target);
}
