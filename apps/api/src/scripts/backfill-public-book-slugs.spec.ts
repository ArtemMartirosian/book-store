import { Prisma, type PrismaClient } from '@prisma/client';
import { publicBookSlugCandidate } from '../modules/catalog/public-book-slug';
import { backfillPublicBookSlugs, parseBackfillArgs, planPublicBookSlugs } from './backfill-public-book-slugs';

const timestamp = new Date('2026-10-21T15:25:00.000Z');
function book(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, slug: `books-am-${id}`, publicSlug: null as string | null, title: `Title ${id}`,
    supplierSku: `supplier-${id}`, sourceUrl: `https://www.books.am/am/title-${id}.html`,
    sourcePriceAmd: 7000, manualEdited: true, createdAt: timestamp, updatedAt: timestamp,
    attributes: [{ label: 'Additional metadata', value: { publicSlug: 'must-be-preserved' } }],
    translations: [{ id: `translation-${id}`, locale: 'hy', title: `Title ${id}`, sourceUrl: `https://www.books.am/am/${id}.html`, observedAt: timestamp }],
    categories: [{ bookId: id, categoryId: 'category-1', observedAt: timestamp }],
    ...overrides,
  };
}
const fixtures = () => ({
  // Deliberately unordered: the database order and the pure plan both use createdAt/id.
  books: [
    book('3', { slug: 'hand-authored-slug', title: 'Do not replace my authored address' }),
    book('2', { title: 'The Same Title' }),
    book('1', { title: 'The Same Title' }),
    book('4', { title: 'Madhouse at the End of the Earth' }),
    book('5', { slug: 'old-authored-name', publicSlug: 'already-public', title: 'Existing' }),
  ],
  categories: [
    { id: 'category-1', supplierCategoryId: '7463', parentId: null, position: 0, manualEdited: true, updatedAt: timestamp, translations: [{ id: 'category-hy', locale: 'hy', name: 'Books', sourceUrl: 'https://www.books.am/am/books', updatedAt: timestamp }] },
    { id: 'orphan-category', supplierCategoryId: '9999', parentId: null, position: 1, manualEdited: false, updatedAt: timestamp, translations: [] },
  ],
  checkpoints: [{ id: 'books-am-full-catalog', status: 'PAUSED', finishReason: 'MAX_BOOKS_PER_RUN_REACHED', imported: 100, updatedAt: timestamp, errors: [] }],
});
type State = ReturnType<typeof fixtures>;
type Options = { afterUpdate?: (state: State) => void; denyPlainCandidate?: string; dropUpdate?: boolean };

function database(initial = fixtures(), options: Options = {}) {
  let state = structuredClone(initial);
  const updates = jest.fn();
  const allocations = jest.fn();
  const reads = jest.fn();
  const transaction = jest.fn(async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>, config: unknown) => {
    expect(config).toEqual({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 60_000 });
    const working = structuredClone(state);
    const tx = {
      catalogBook: {
        findMany: async (query: unknown) => {
          reads(query);
          return structuredClone(working.books).sort((a, b) => a.createdAt.valueOf() - b.createdAt.valueOf() || a.id.localeCompare(b.id));
        },
        findFirst: async ({ where }: { where: { id: { not: string }; OR: Array<{ publicSlug?: string; slug?: string }> } }) => {
          allocations(where);
          const candidate = where.OR[0]?.publicSlug;
          if (candidate === options.denyPlainCandidate) return { id: 'concurrently-allocated' };
          const found = working.books.find((row) => row.id !== where.id.not && (row.publicSlug === candidate || row.slug === candidate));
          return found ? { id: found.id } : null;
        },
        update: async ({ where, data }: { where: { id: string; AND: Array<{ publicSlug: null }> }; data: { publicSlug: string; updatedAt: Date } }) => {
          updates({ where, data });
          expect(where.AND).toEqual([{ publicSlug: null }]);
          const row = working.books.find(({ id }) => id === where.id);
          if (!row || row.publicSlug !== null) throw new Error('Record is no longer missing its public slug');
          expect(Object.keys(data).sort()).toEqual(['publicSlug', 'updatedAt']);
          if (!options.dropUpdate) Object.assign(row, structuredClone(data));
          options.afterUpdate?.(working);
          return structuredClone(row);
        },
      },
      catalogCategory: { findMany: async () => structuredClone(working.categories).sort((a, b) => a.id.localeCompare(b.id)) },
      crawlerCheckpoint: { findMany: async () => structuredClone(working.checkpoints).sort((a, b) => a.id.localeCompare(b.id)) },
    };
    const result = await callback(tx as unknown as Prisma.TransactionClient);
    state = working;
    return result;
  });
  return {
    client: { $transaction: transaction } as unknown as Pick<PrismaClient, '$transaction'>,
    get state() { return structuredClone(state); },
    transaction, updates, allocations, reads,
  };
}

describe('public book slug backfill', () => {
  it('defaults to a single serializable dry run without allocations or updates', async () => {
    const initial = fixtures();
    const db = database(initial);
    const result = await backfillPublicBookSlugs(db.client);
    expect(result).toMatchObject({ mode: 'dry-run', books: 5, translations: 5, categories: 2, categoryTranslations: 1, categoryLinks: 5, checkpoints: 1, planned: 4, changed: 0 });
    expect(result.beforeHash).toBe(result.afterHash);
    expect(result.checkpointBeforeHash).toBe(result.checkpointAfterHash);
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.updates).not.toHaveBeenCalled();
    expect(db.allocations).not.toHaveBeenCalled();
    expect(db.state).toEqual(initial);
    expect(db.reads).toHaveBeenCalledWith({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { translations: { orderBy: [{ locale: 'asc' }, { id: 'asc' }] }, categories: { orderBy: [{ categoryId: 'asc' }] } },
    });
    expect(JSON.stringify(result)).not.toContain('https://');
    expect(JSON.stringify(result)).not.toContain('sourcePriceAmd');
  });

  it('applies exactly the dry-run plan while preserving all other catalog and checkpoint data', async () => {
    const initial = fixtures();
    const db = database(initial);
    const dry = await backfillPublicBookSlugs(db.client);
    const result = await backfillPublicBookSlugs(db.client, true);
    expect(result.sample).toEqual(dry.sample);
    expect(result.changed).toBe(4);
    expect(result.beforeHash).toBe(result.afterHash);
    expect(result.checkpointBeforeHash).toBe(result.checkpointAfterHash);
    expect(db.updates).toHaveBeenCalledTimes(4);
    expect(db.allocations).toHaveBeenCalled();
    const after = db.state;
    for (const old of initial.books) {
      const current = after.books.find(({ id }) => id === old.id)!;
      expect(current.publicSlug).not.toBeNull();
      expect({ ...current, publicSlug: old.publicSlug }).toEqual(old);
    }
    expect(after.categories).toEqual(initial.categories);
    expect(after.checkpoints).toEqual(initial.checkpoints);
    expect(after.books.find(({ id }) => id === '1')?.publicSlug).toBe('the-same-title');
    expect(after.books.find(({ id }) => id === '2')?.publicSlug).toBe(publicBookSlugCandidate('The Same Title', '2', 1));
    expect(after.books.find(({ id }) => id === '3')?.publicSlug).toBe('hand-authored-slug');
    expect(after.books.find(({ id }) => id === '4')?.publicSlug).toBe('madhouse-at-the-end-of-the-earth');
    expect(after.books.find(({ id }) => id === '5')?.publicSlug).toBe('already-public');
  });

  it('is idempotent: a second apply makes no writes and changes no hashes', async () => {
    const db = database();
    await backfillPublicBookSlugs(db.client, true);
    const before = db.state;
    db.updates.mockClear();
    db.allocations.mockClear();
    const rerun = await backfillPublicBookSlugs(db.client, true);
    expect(rerun).toMatchObject({ mode: 'apply', planned: 0, changed: 0, sample: [] });
    expect(rerun.beforeHash).toBe(rerun.afterHash);
    expect(db.updates).not.toHaveBeenCalled();
    expect(db.allocations).not.toHaveBeenCalled();
    expect(db.state).toEqual(before);
  });

  it('reserves every other row\'s authored alias and existing public slug', () => {
    const inputs = [
      book('owner', { slug: 'reserved-alias', publicSlug: 'reserved-public' }),
      book('1', { title: 'Reserved Alias' }),
      book('2', { title: 'Reserved Public' }),
      book('3', { title: 'Books AM 122337' }),
      book('4', { slug: 'own-authored-slug' }),
    ];
    const plan = planPublicBookSlugs(inputs);
    expect(plan.find(({ id }) => id === '1')?.publicSlug).toBe(publicBookSlugCandidate('Reserved Alias', '1', 1));
    expect(plan.find(({ id }) => id === '2')?.publicSlug).toBe(publicBookSlugCandidate('Reserved Public', '2', 1));
    expect(plan.find(({ id }) => id === '3')?.publicSlug).toBe('book-books-am-122337');
    expect(plan.find(({ id }) => id === '4')?.publicSlug).toBe('own-authored-slug');
    expect(plan).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'owner' })]));
  });

  it('outputs at most five planned examples even for a larger catalog', async () => {
    const initial = fixtures();
    initial.books = Array.from({ length: 12 }, (_, index) => book(String(index + 1)));
    const result = await backfillPublicBookSlugs(database(initial).client);
    expect(result.planned).toBe(12);
    expect(result.sample).toHaveLength(5);
  });

  it('refuses to proceed while any crawler checkpoint is running', async () => {
    const initial = fixtures();
    initial.checkpoints[0]!.status = 'RUNNING';
    const db = database(initial);
    await expect(backfillPublicBookSlugs(db.client, true)).rejects.toThrow('PUBLIC_SLUG_BACKFILL_CRAWLER_RUNNING');
    expect(db.updates).not.toHaveBeenCalled();
    expect(db.allocations).not.toHaveBeenCalled();
    expect(db.state).toEqual(initial);
  });

  it.each(['price', 'source', 'timestamp', 'translation', 'category', 'checkpoint', 'nested-metadata'] as const)(
    'detects and rolls back an accidental %s change', async (field) => {
      const initial = fixtures();
      const db = database(initial, { afterUpdate: (state) => {
        const row = state.books[0]!;
        if (field === 'price') row.sourcePriceAmd += 1;
        if (field === 'source') row.sourceUrl += '?changed=1';
        if (field === 'timestamp') row.updatedAt = new Date('2026-10-27T12:00:00Z');
        if (field === 'translation') row.translations[0]!.sourceUrl += '?changed=1';
        if (field === 'category') state.categories[1]!.position += 1;
        if (field === 'checkpoint') state.checkpoints[0]!.imported += 1;
        if (field === 'nested-metadata') row.attributes[0]!.value.publicSlug = 'must-not-be-excluded';
      } });
      await expect(backfillPublicBookSlugs(db.client, true)).rejects.toThrow('PUBLIC_SLUG_BACKFILL_INVARIANT_CHANGED');
      expect(db.state).toEqual(initial);
    },
  );

  it('aborts instead of silently applying a different allocation than the dry-run plan', async () => {
    const initial = fixtures();
    const db = database(initial, { denyPlainCandidate: 'the-same-title' });
    await expect(backfillPublicBookSlugs(db.client, true)).rejects.toThrow('PUBLIC_SLUG_BACKFILL_PLAN_CHANGED');
    expect(db.updates).not.toHaveBeenCalled();
    expect(db.state).toEqual(initial);
  });

  it('detects an update which did not assign the expected public slug', async () => {
    const initial = fixtures();
    initial.books = [book('1', { title: 'One missing update' })];
    const db = database(initial, { dropUpdate: true });
    await expect(backfillPublicBookSlugs(db.client, true)).rejects.toThrow('PUBLIC_SLUG_BACKFILL_UPDATE_MISSING');
    expect(db.state).toEqual(initial);
  });

  it('parses the default safe mode and the explicit apply flag, rejecting ambiguous or unknown arguments', () => {
    expect(parseBackfillArgs([])).toEqual({ apply: false });
    expect(parseBackfillArgs(['--dry-run'])).toEqual({ apply: false });
    expect(parseBackfillArgs(['--apply'])).toEqual({ apply: true });
    for (const flags of [['--unknown'], ['apply'], ['--apply', '--apply'], ['--apply', '--dry-run'], ['--dry-run', 'extra']]) {
      expect(() => parseBackfillArgs(flags)).toThrow('Usage: backfill-public-book-slugs');
    }
  });
});
