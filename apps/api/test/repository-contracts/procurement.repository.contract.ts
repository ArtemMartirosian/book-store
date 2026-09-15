import {
  PROCUREMENT_STATUSES,
  type ProcurementStatus,
  type ProcurementTaskRecord,
} from '../../src/modules/procurement/procurement.model';
import {
  ConcurrentProcurementModificationError,
  type ProcurementRepository,
} from '../../src/modules/procurement/repositories/procurement.repository';

type MaybePromise<T> = T | Promise<T>;

export interface ProcurementRepositoryContractContext {
  repository: ProcurementRepository;
  /**
   * PostgreSQL harnesses can seed the parent Order row required by the
   * ProcurementTask foreign key here. It must be safe to call more than once.
   */
  prepareTask?: (task: ProcurementTaskRecord) => MaybePromise<void>;
  cleanup?: () => MaybePromise<void>;
}

export interface PersistentProcurementRepositoryContractContext
  extends ProcurementRepositoryContractContext {
  reopen: () => MaybePromise<ProcurementRepository>;
}

export type ProcurementRepositoryContractFactory = () =>
  MaybePromise<ProcurementRepositoryContractContext>;
export type PersistentProcurementRepositoryContractFactory = () =>
  MaybePromise<PersistentProcurementRepositoryContractContext>;

const uuid = (namespace: number, seed: number): string =>
  `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${seed
    .toString(16)
    .padStart(12, '0')}`;

const timestamp = (seed: number): string =>
  new Date(Date.UTC(2026, 1, 1, 0, seed, 0)).toISOString();

export const makeProcurementRepositoryContractRecord = (
  seed: number,
): ProcurementTaskRecord => ({
  id: uuid(0x30000000, seed),
  orderId: uuid(0x10000000, seed),
  orderNumber: `LUMI-CONTRACT-${seed.toString().padStart(4, '0')}`,
  status: 'PENDING_OPERATOR',
  supplierName: 'Books.am',
  currency: 'AMD',
  supplierItemsSubtotalAmd: 3_000 + seed,
  supplierDeliveryFeeAmd: null,
  supplierTotalAmd: null,
  items: [
    {
      productId: uuid(0x20000000, seed),
      supplierSku: `CONTRACT-SKU-${seed}`,
      title: `Contract Book ${seed}`,
      author: `Contract Author ${seed}`,
      sourceUrl: `https://www.books.am/contract/book-${seed}`,
      quantity: 1,
      observedSourceUnitPriceAmd: 3_000 + seed,
    },
  ],
  supplierReference: null,
  operatorNote: null,
  confirmedAt: null,
  resolvedAt: null,
  createdAt: timestamp(seed),
  updatedAt: timestamp(seed),
});

export const defineProcurementRepositoryContract = (
  subject: string,
  factory: ProcurementRepositoryContractFactory,
): void => {
  describe(`${subject} ProcurementRepository contract`, () => {
    let context: ProcurementRepositoryContractContext | undefined;

    const current = (): ProcurementRepositoryContractContext => {
      if (!context) throw new Error('Procurement repository contract context is not initialized');
      return context;
    };

    const prepare = async (task: ProcurementTaskRecord): Promise<void> => {
      await current().prepareTask?.(structuredClone(task));
    };

    const create = async (task: ProcurementTaskRecord) => {
      await prepare(task);
      return current().repository.createForOrder(task);
    };

    beforeEach(async () => {
      context = undefined;
      context = await factory();
    });

    afterEach(async () => {
      const completed = context;
      context = undefined;
      await completed?.cleanup?.();
    });

    it('round-trips the complete supplier snapshot and never leaks mutable references', async () => {
      const task = makeProcurementRepositoryContractRecord(1);
      const expected = structuredClone(task);

      const result = await create(task);

      expect(result).toEqual(expected);
      await expect(current().repository.findById(task.id)).resolves.toEqual(expected);
      await expect(current().repository.findByOrderId(task.orderId)).resolves.toEqual(expected);

      task.items[0]!.title = 'mutated input';
      result.operatorNote = 'mutated result';
      result.items[0]!.observedSourceUnitPriceAmd = 1;
      await expect(current().repository.findById(expected.id)).resolves.toEqual(expected);
    });

    it('creates at most one task per order, including concurrent attempts', async () => {
      const first = makeProcurementRepositoryContractRecord(2);
      const second = makeProcurementRepositoryContractRecord(3);
      second.orderId = first.orderId;
      second.orderNumber = first.orderNumber;
      await Promise.all([prepare(first), prepare(second)]);

      const results = await Promise.all([
        current().repository.createForOrder(first),
        current().repository.createForOrder(second),
      ]);

      expect(new Set(results.map(({ id }) => id))).toHaveProperty('size', 1);
      await expect(current().repository.findByOrderId(first.orderId)).resolves.toEqual(results[0]);
      await expect(current().repository.list()).resolves.toHaveLength(1);
    });

    it('persists updates while keeping snapshots detached and rejects an unknown id', async () => {
      const task = makeProcurementRepositoryContractRecord(4);
      await create(task);
      const updated: ProcurementTaskRecord = {
        ...task,
        status: 'SUPPLIER_CONFIRMED',
        supplierDeliveryFeeAmd: 1_000,
        supplierTotalAmd: task.supplierItemsSubtotalAmd + 1_000,
        supplierReference: 'BOOKS-CONTRACT-4',
        operatorNote: 'Manually confirmed',
        confirmedAt: timestamp(20),
        updatedAt: timestamp(20),
      };

      const saved = await current().repository.save(updated);
      expect(saved).toEqual(updated);
      saved.items[0]!.supplierSku = 'mutated result';
      await expect(current().repository.findById(task.id)).resolves.toEqual(updated);

      const unknown = makeProcurementRepositoryContractRecord(5);
      await prepare(unknown);
      await expect(current().repository.save(unknown)).rejects.toThrow(
        'Cannot save an unknown procurement task',
      );
    });

    it('rejects a stale compare-and-swap update without losing the winning write', async () => {
      const initial = makeProcurementRepositoryContractRecord(9);
      await create(initial);
      const winningUpdate = structuredClone(initial);
      winningUpdate.operatorNote = 'Winning operator update';
      winningUpdate.updatedAt = timestamp(20);
      const staleUpdate = structuredClone(initial);
      staleUpdate.operatorNote = 'Stale operator update';
      staleUpdate.updatedAt = timestamp(21);

      await expect(
        current().repository.save(winningUpdate, initial.updatedAt),
      ).resolves.toEqual(winningUpdate);
      await expect(
        current().repository.save(staleUpdate, initial.updatedAt),
      ).rejects.toBeInstanceOf(ConcurrentProcurementModificationError);
      await expect(current().repository.findById(initial.id)).resolves.toEqual(winningUpdate);
    });

    it('returns newest-first rows and a zero-filled count for every status', async () => {
      const oldest = makeProcurementRepositoryContractRecord(6);
      const newest = makeProcurementRepositoryContractRecord(8);
      newest.status = 'CANCELLED';
      newest.operatorNote = 'Cancelled by contract';
      newest.resolvedAt = newest.updatedAt;
      const middle = makeProcurementRepositoryContractRecord(7);
      middle.status = 'SOURCE_UNAVAILABLE';
      middle.operatorNote = 'Unavailable in contract';
      middle.resolvedAt = middle.updatedAt;
      await create(oldest);
      await create(newest);
      await create(middle);

      await expect(current().repository.list()).resolves.toEqual([newest, middle, oldest]);
      const expectedCounts = Object.fromEntries(
        PROCUREMENT_STATUSES.map((status) => [status, 0]),
      ) as Record<ProcurementStatus, number>;
      expectedCounts.PENDING_OPERATOR = 1;
      expectedCounts.SOURCE_UNAVAILABLE = 1;
      expectedCounts.CANCELLED = 1;
      await expect(current().repository.countByStatus()).resolves.toEqual(expectedCounts);
    });
  });
};

export const definePersistentProcurementRepositoryContract = (
  subject: string,
  factory: PersistentProcurementRepositoryContractFactory,
): void => {
  describe(`${subject} ProcurementRepository persistence contract`, () => {
    let context: PersistentProcurementRepositoryContractContext | undefined;

    beforeEach(async () => {
      context = undefined;
      context = await factory();
    });

    afterEach(async () => {
      const completed = context;
      context = undefined;
      await completed?.cleanup?.();
    });

    it('survives client recreation with order linkage, item order and counts intact', async () => {
      if (!context) throw new Error('Persistent procurement context is not initialized');
      const first = makeProcurementRepositoryContractRecord(21);
      first.status = 'SUPPLIER_CONFIRMED';
      first.supplierReference = 'BOOKS-CONTRACT-RESTART';
      first.confirmedAt = timestamp(30);
      first.items.push({
        ...structuredClone(first.items[0]!),
        productId: uuid(0x20000000, 22),
        supplierSku: 'CONTRACT-SKU-22',
        title: 'Second procurement snapshot',
      });
      const second = makeProcurementRepositoryContractRecord(22);
      second.createdAt = first.createdAt;
      await context.prepareTask?.(structuredClone(first));
      await context.prepareTask?.(structuredClone(second));
      await context.repository.createForOrder(first);
      await context.repository.createForOrder(second);

      context.repository = await context.reopen();

      await expect(context.repository.findById(first.id)).resolves.toEqual(first);
      await expect(context.repository.findByOrderId(first.orderId)).resolves.toEqual(first);
      // Equal timestamps deliberately lock the deterministic id DESC tie-break.
      await expect(context.repository.list()).resolves.toEqual([second, first]);
      const counts = await context.repository.countByStatus();
      expect(counts.SUPPLIER_CONFIRMED).toBe(1);
      expect(counts.PENDING_OPERATOR).toBe(1);
      expect(Object.keys(counts)).toEqual([...PROCUREMENT_STATUSES]);
    });
  });
};
