import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import { allocatePublicBookSlug, MAX_PUBLIC_SLUG_ATTEMPTS } from '../modules/catalog/public-book-slug-allocation';
import { publicBookSlugCandidate } from '../modules/catalog/public-book-slug';

type BookSnapshot = Prisma.CatalogBookGetPayload<{ include: { translations: true; categories: true } }>;
type CategorySnapshot = Prisma.CatalogCategoryGetPayload<{ include: { translations: true } }>;
type CheckpointSnapshot = Prisma.CrawlerCheckpointGetPayload<Record<string, never>>;
type Snapshot = { books: BookSnapshot[]; categories: CategorySnapshot[]; checkpoints: CheckpointSnapshot[] };
type PlanBook = Pick<BookSnapshot, 'id' | 'slug' | 'publicSlug' | 'title' | 'createdAt' | 'updatedAt'>;
export type PublicBookSlugPlan = { id: string; legacySlug: string; publicSlug: string; seed: string; updatedAt: Date };

export function parseBackfillArgs(args: readonly string[]): { apply: boolean } {
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry-run')) return { apply: false };
  if (args.length === 1 && args[0] === '--apply') return { apply: true };
  throw new Error('Usage: backfill-public-book-slugs [--apply|--dry-run]');
}

/** Plan against both URL namespaces before changing any rows. */
export function planPublicBookSlugs(books: readonly PlanBook[]): PublicBookSlugPlan[] {
  const occupied = new Set<string>();
  const owners = new Map<string, Set<string>>();
  const reserve = (slug: string, id: string) => {
    occupied.add(slug);
    const ids = owners.get(slug) ?? new Set<string>();
    ids.add(id);
    owners.set(slug, ids);
  };
  for (const book of books) {
    reserve(book.slug, book.id);
    if (book.publicSlug !== null) reserve(book.publicSlug, book.id);
  }
  const ordered = [...books].sort((left, right) => left.createdAt.valueOf() - right.createdAt.valueOf()
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const plan: PublicBookSlugPlan[] = [];
  for (const book of ordered) {
    if (book.publicSlug !== null) continue;
    const seed = /^books-am-\d+$/u.test(book.slug) ? book.title : book.slug;
    let selected: string | undefined;
    for (let attempt = 0; attempt < MAX_PUBLIC_SLUG_ATTEMPTS; attempt += 1) {
      const candidate = publicBookSlugCandidate(seed, book.id, attempt);
      // The row may retain its own hand-authored alias, but never another row's.
      if (!occupied.has(candidate) || [...(owners.get(candidate) ?? [])].every((id) => id === book.id)) {
        selected = candidate;
        reserve(candidate, book.id);
        break;
      }
    }
    if (!selected) throw new Error('PUBLIC_BOOK_SLUG_ALLOCATION_EXHAUSTED');
    plan.push({ id: book.id, legacySlug: book.slug, publicSlug: selected, seed, updatedAt: book.updatedAt });
  }
  return plan;
}

function canonical(value: unknown): unknown {
  if (Object.prototype.toString.call(value) === '[object Date]') return (value as Date).toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, canonical(item)]),
  );
  return value;
}

function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function invariantHash(snapshot: Snapshot): string {
  return hash({
    ...snapshot,
    books: snapshot.books.map(({ publicSlug: _publicSlug, ...unchanged }) => unchanged),
  });
}

async function snapshot(client: Prisma.TransactionClient): Promise<Snapshot> {
  const [books, categories, checkpoints] = await Promise.all([
    client.catalogBook.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        translations: { orderBy: [{ locale: 'asc' }, { id: 'asc' }] },
        categories: { orderBy: [{ categoryId: 'asc' }] },
      },
    }),
    client.catalogCategory.findMany({
      orderBy: [{ id: 'asc' }],
      include: { translations: { orderBy: [{ locale: 'asc' }, { id: 'asc' }] } },
    }),
    client.crawlerCheckpoint.findMany({ orderBy: [{ id: 'asc' }] }),
  ]);
  return { books, categories, checkpoints };
}

function assertCrawlerStopped(checkpoints: readonly CheckpointSnapshot[]) {
  if (checkpoints.some(({ status }) => status.toUpperCase() === 'RUNNING')) {
    throw new Error('PUBLIC_SLUG_BACKFILL_CRAWLER_RUNNING');
  }
}

export async function backfillPublicBookSlugs(client: Pick<PrismaClient, '$transaction'>, apply = false) {
  return client.$transaction(async (transaction) => {
    const before = await snapshot(transaction);
    assertCrawlerStopped(before.checkpoints);
    const plan = planPublicBookSlugs(before.books);
    if (apply) {
      for (const change of plan) {
        const allocated = await allocatePublicBookSlug(transaction, change.seed, change.id);
        if (allocated !== change.publicSlug) throw new Error('PUBLIC_SLUG_BACKFILL_PLAN_CHANGED');
        await transaction.catalogBook.update({
          where: { id: change.id, AND: [{ publicSlug: null }] },
          // Preserve the timestamp used by SEO and the catalog freshness display.
          data: { publicSlug: allocated, updatedAt: change.updatedAt },
        });
      }
    }
    const after = await snapshot(transaction);
    assertCrawlerStopped(after.checkpoints);
    const beforeHash = invariantHash(before);
    const afterHash = invariantHash(after);
    const checkpointBeforeHash = hash(before.checkpoints);
    const checkpointAfterHash = hash(after.checkpoints);
    if (beforeHash !== afterHash || checkpointBeforeHash !== checkpointAfterHash
      || before.checkpoints.length !== after.checkpoints.length) {
      throw new Error('PUBLIC_SLUG_BACKFILL_INVARIANT_CHANGED');
    }
    const expected = new Map(before.books.map(({ id, publicSlug }) => [id, publicSlug]));
    if (apply) for (const { id, publicSlug } of plan) expected.set(id, publicSlug);
    if (after.books.some((book) => book.publicSlug !== expected.get(book.id))) {
      throw new Error('PUBLIC_SLUG_BACKFILL_UPDATE_MISSING');
    }
    return {
      mode: apply ? 'apply' as const : 'dry-run' as const,
      books: before.books.length,
      translations: before.books.reduce((count, book) => count + book.translations.length, 0),
      categories: before.categories.length,
      categoryTranslations: before.categories.reduce((count, category) => count + category.translations.length, 0),
      categoryLinks: before.books.reduce((count, book) => count + book.categories.length, 0),
      checkpoints: before.checkpoints.length,
      planned: plan.length,
      changed: apply ? plan.length : 0,
      beforeHash,
      afterHash,
      checkpointBeforeHash,
      checkpointAfterHash,
      sample: plan.slice(0, 5).map(({ id, legacySlug, publicSlug }) => ({ id, legacySlug, publicSlug })),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 60_000 });
}

async function main() {
  const { apply } = parseBackfillArgs(process.argv.slice(2));
  const client = new PrismaClient();
  try {
    console.log(JSON.stringify(await backfillPublicBookSlugs(client, apply), null, 2));
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'PUBLIC_SLUG_BACKFILL_FAILED');
    process.exitCode = 1;
  });
}
