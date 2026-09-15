import { ORDER_STATUSES, type OrderRecord, type OrderStatus } from '../../src/modules/orders/order.model';
import {
  ConcurrentOrderModificationError,
  FiscalReceiptNumberAlreadyUsedError,
  type OrderRepository,
} from '../../src/modules/orders/repositories/order.repository';

type MaybePromise<T> = T | Promise<T>;

export interface OrderRepositoryContractContext {
  repository: OrderRepository;
  /**
   * PostgreSQL harnesses can use this hook for per-record prerequisites or
   * transaction scoping. It must be safe to call more than once.
   */
  prepareOrder?: (order: OrderRecord) => MaybePromise<void>;
  cleanup?: () => MaybePromise<void>;
}

export interface PersistentOrderRepositoryContractContext
  extends OrderRepositoryContractContext {
  /**
   * Dispose the current database client and return a repository backed by a
   * newly-created client, without clearing persisted rows.
   */
  reopen: () => MaybePromise<OrderRepository>;
}

export type OrderRepositoryContractFactory = () => MaybePromise<OrderRepositoryContractContext>;
export type PersistentOrderRepositoryContractFactory = () =>
  MaybePromise<PersistentOrderRepositoryContractContext>;

const uuid = (namespace: number, seed: number): string =>
  `${namespace.toString(16).padStart(8, '0')}-0000-4000-8000-${seed
    .toString(16)
    .padStart(12, '0')}`;

const timestamp = (seed: number): string =>
  new Date(Date.UTC(2026, 0, 1, 0, seed, 0)).toISOString();

export const makeOrderRepositoryContractRecord = (seed: number): OrderRecord => ({
  id: uuid(0x10000000, seed),
  orderNumber: `LUMI-CONTRACT-${seed.toString().padStart(4, '0')}`,
  idempotencyKey: `repository-contract-idempotency-key-${seed}`,
  requestHash: seed.toString(16).padStart(64, '0'),
  status: 'REQUEST_RECEIVED',
  locale: seed % 2 === 0 ? 'hy' : 'ru',
  customer: {
    fullName: `Contract Customer ${seed}`,
    phone: `+3749900${seed.toString().padStart(4, '0')}`,
    email: `contract-${seed}@example.am`,
  },
  delivery: {
    city: 'YEREVAN',
    district: seed % 2 === 0 ? 'ARABKIR' : 'KENTRON',
    addressLine: `${seed} Contract Street`,
    apartment: `${seed}`,
    entrance: '2',
    floor: '3',
    notes: `Delivery note ${seed}`,
  },
  paymentMethod: 'CASH_ON_DELIVERY',
  cod: {
    dueAmd: 5_000 + seed,
    status: 'CASH_DUE',
    collectedAt: null,
    reconciledAt: null,
    fiscalReceiptNumber: null,
    reconciliationReference: null,
    refusalReason: null,
  },
  currency: 'AMD',
  items: [
    {
      productId: uuid(0x20000000, seed),
      supplierSku: `CONTRACT-SKU-${seed}`,
      title: `Contract Book ${seed}`,
      author: `Contract Author ${seed}`,
      sourceUrl: `https://www.books.am/contract/book-${seed}`,
      quantity: 2,
      sourceUnitPriceAmd: 1_500 + seed,
      customerUnitPriceAmd: 2_000 + seed,
      customerSubtotalAmd: 4_000 + seed * 2,
    },
  ],
  itemsSubtotalAmd: 4_000 + seed * 2,
  deliveryFeeAmd: 1_000,
  totalAmd: 5_000 + seed * 2,
  projectedMarginAmd: 1_000,
  customerConfirmationRequired: true,
  createdAt: timestamp(seed),
  updatedAt: timestamp(seed),
});

export const defineOrderRepositoryContract = (
  subject: string,
  factory: OrderRepositoryContractFactory,
): void => {
  describe(`${subject} OrderRepository contract`, () => {
    let context: OrderRepositoryContractContext | undefined;

    const current = (): OrderRepositoryContractContext => {
      if (!context) throw new Error('Order repository contract context is not initialized');
      return context;
    };

    const prepare = async (order: OrderRecord): Promise<void> => {
      await current().prepareOrder?.(structuredClone(order));
    };

    const create = async (order: OrderRecord) => {
      await prepare(order);
      return current().repository.createIdempotently(order);
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

    it('round-trips the complete snapshot and never leaks mutable references', async () => {
      const order = makeOrderRepositoryContractRecord(1);
      order.customer.fullName = 'Անի Иванова';
      order.delivery.addressLine = 'Աբովյան 10 — кв. 12';
      order.delivery.apartment = null;
      order.delivery.entrance = null;
      order.delivery.floor = null;
      order.delivery.notes = null;
      order.items[0]!.title = 'Գիրք — Книга';
      order.items[0]!.quantity = 1;
      order.items[0]!.sourceUnitPriceAmd = Number.MAX_SAFE_INTEGER - 2_000;
      order.items[0]!.customerUnitPriceAmd = Number.MAX_SAFE_INTEGER - 1_000;
      order.items[0]!.customerSubtotalAmd = Number.MAX_SAFE_INTEGER - 1_000;
      order.itemsSubtotalAmd = Number.MAX_SAFE_INTEGER - 1_000;
      order.deliveryFeeAmd = 1_000;
      order.totalAmd = Number.MAX_SAFE_INTEGER;
      order.cod.dueAmd = Number.MAX_SAFE_INTEGER;
      order.cod.fiscalReceiptNumber = 'HDM-CONTRACT-ROUNDTRIP';
      const expected = structuredClone(order);

      const result = await create(order);

      expect(result).toEqual({ outcome: 'CREATED', order: expected });
      await expect(current().repository.findById(expected.id)).resolves.toEqual(expected);
      await expect(
        current().repository.findByIdempotencyKey(expected.idempotencyKey),
      ).resolves.toEqual(expected);
      await expect(
        current().repository.findByFiscalReceiptNumber('HDM-CONTRACT-ROUNDTRIP'),
      ).resolves.toEqual(expected);

      order.customer.fullName = 'mutated input';
      order.items[0]!.title = 'mutated input item';
      result.order.delivery.addressLine = 'mutated result';
      result.order.items[0]!.sourceUnitPriceAmd = 1;

      await expect(current().repository.findById(expected.id)).resolves.toEqual(expected);
    });

    it('returns replay and conflict outcomes without replacing the original row', async () => {
      const original = makeOrderRepositoryContractRecord(2);
      const replayCandidate = makeOrderRepositoryContractRecord(3);
      replayCandidate.idempotencyKey = original.idempotencyKey;
      replayCandidate.requestHash = original.requestHash;
      const conflictCandidate = makeOrderRepositoryContractRecord(4);
      conflictCandidate.idempotencyKey = original.idempotencyKey;

      await expect(create(original)).resolves.toEqual({ outcome: 'CREATED', order: original });
      await expect(create(replayCandidate)).resolves.toEqual({
        outcome: 'REPLAYED',
        order: original,
      });
      await expect(create(conflictCandidate)).resolves.toEqual({
        outcome: 'CONFLICT',
        order: original,
      });
      await expect(current().repository.list()).resolves.toEqual([original]);
    });

    it('serializes concurrent creates for the same idempotency key', async () => {
      const first = makeOrderRepositoryContractRecord(5);
      const second = makeOrderRepositoryContractRecord(6);
      second.idempotencyKey = first.idempotencyKey;
      second.requestHash = first.requestHash;
      await Promise.all([prepare(first), prepare(second)]);

      const results = await Promise.all([
        current().repository.createIdempotently(first),
        current().repository.createIdempotently(second),
      ]);

      expect(results.map(({ outcome }) => outcome).sort()).toEqual(['CREATED', 'REPLAYED']);
      expect(new Set(results.map(({ order }) => order.id))).toHaveProperty('size', 1);
      await expect(current().repository.list()).resolves.toHaveLength(1);
    });

    it('returns one conflict when different payload hashes race on the same key', async () => {
      const first = makeOrderRepositoryContractRecord(13);
      const second = makeOrderRepositoryContractRecord(14);
      second.idempotencyKey = first.idempotencyKey;
      await Promise.all([prepare(first), prepare(second)]);

      const results = await Promise.all([
        current().repository.createIdempotently(first),
        current().repository.createIdempotently(second),
      ]);

      expect(results.map(({ outcome }) => outcome).sort()).toEqual(['CONFLICT', 'CREATED']);
      expect(new Set(results.map(({ order }) => order.id))).toHaveProperty('size', 1);
      await expect(current().repository.list()).resolves.toHaveLength(1);
    });

    it('enforces fiscal-receipt uniqueness under a concurrent save race and reindexes changes', async () => {
      const first = makeOrderRepositoryContractRecord(7);
      const second = makeOrderRepositoryContractRecord(8);
      await create(first);
      await create(second);

      first.cod.fiscalReceiptNumber = 'HDM-CONTRACT-RACE';
      second.cod.fiscalReceiptNumber = 'HDM-CONTRACT-RACE';
      const outcomes = await Promise.allSettled([
        current().repository.save(first),
        current().repository.save(second),
      ]);
      const fulfilled = outcomes.filter(
        (outcome): outcome is PromiseFulfilledResult<OrderRecord> =>
          outcome.status === 'fulfilled',
      );
      const rejected = outcomes.filter(
        (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]!.reason).toBeInstanceOf(FiscalReceiptNumberAlreadyUsedError);
      const winner = fulfilled[0]!.value;
      await expect(
        current().repository.findByFiscalReceiptNumber('HDM-CONTRACT-RACE'),
      ).resolves.toMatchObject({ id: winner.id });

      winner.cod.fiscalReceiptNumber = 'HDM-CONTRACT-REINDEXED';
      winner.updatedAt = timestamp(20);
      await current().repository.save(winner);
      await expect(
        current().repository.findByFiscalReceiptNumber('HDM-CONTRACT-RACE'),
      ).resolves.toBeNull();
      await expect(
        current().repository.findByFiscalReceiptNumber('HDM-CONTRACT-REINDEXED'),
      ).resolves.toMatchObject({ id: winner.id });
    });

    it('rejects a stale compare-and-swap update without losing the winning write', async () => {
      const initial = makeOrderRepositoryContractRecord(15);
      await create(initial);
      const winningUpdate = structuredClone(initial);
      winningUpdate.status = 'CUSTOMER_CONFIRMED';
      winningUpdate.updatedAt = timestamp(16);
      const staleUpdate = structuredClone(initial);
      staleUpdate.status = 'CANCELLED';
      staleUpdate.updatedAt = timestamp(17);

      await expect(
        current().repository.save(winningUpdate, initial.updatedAt),
      ).resolves.toEqual(winningUpdate);
      await expect(
        current().repository.save(staleUpdate, initial.updatedAt),
      ).rejects.toBeInstanceOf(ConcurrentOrderModificationError);
      await expect(current().repository.findById(initial.id)).resolves.toEqual(winningUpdate);
    });

    it('rejects save for an unknown id and returns newest-first rows plus complete counts', async () => {
      const oldest = makeOrderRepositoryContractRecord(9);
      const newest = makeOrderRepositoryContractRecord(11);
      newest.status = 'CANCELLED';
      const middle = makeOrderRepositoryContractRecord(10);
      middle.status = 'DELIVERED';
      await create(oldest);
      await create(newest);
      await create(middle);

      const unknown = makeOrderRepositoryContractRecord(12);
      await prepare(unknown);
      await expect(current().repository.save(unknown)).rejects.toThrow(
        'Cannot save an unknown order',
      );
      await expect(current().repository.list()).resolves.toEqual([newest, middle, oldest]);

      const expectedCounts = Object.fromEntries(
        ORDER_STATUSES.map((status) => [status, 0]),
      ) as Record<OrderStatus, number>;
      expectedCounts.REQUEST_RECEIVED = 1;
      expectedCounts.DELIVERED = 1;
      expectedCounts.CANCELLED = 1;
      await expect(current().repository.countByStatus()).resolves.toEqual(expectedCounts);
    });
  });
};

export const definePersistentOrderRepositoryContract = (
  subject: string,
  factory: PersistentOrderRepositoryContractFactory,
): void => {
  describe(`${subject} OrderRepository persistence contract`, () => {
    let context: PersistentOrderRepositoryContractContext | undefined;

    beforeEach(async () => {
      context = undefined;
      context = await factory();
    });

    afterEach(async () => {
      const completed = context;
      context = undefined;
      await completed?.cleanup?.();
    });

    it('survives client recreation with indexes, item order and status counts intact', async () => {
      if (!context) throw new Error('Persistent order contract context is not initialized');
      const first = makeOrderRepositoryContractRecord(21);
      first.status = 'OUT_FOR_DELIVERY';
      first.cod.fiscalReceiptNumber = 'HDM-CONTRACT-RESTART';
      first.items.push({
        ...structuredClone(first.items[0]!),
        productId: uuid(0x20000000, 22),
        supplierSku: 'CONTRACT-SKU-22',
        title: 'Second ordered snapshot',
      });
      const second = makeOrderRepositoryContractRecord(22);
      second.createdAt = first.createdAt;
      await context.prepareOrder?.(structuredClone(first));
      await context.prepareOrder?.(structuredClone(second));
      await context.repository.createIdempotently(first);
      await context.repository.createIdempotently(second);

      context.repository = await context.reopen();

      await expect(context.repository.findById(first.id)).resolves.toEqual(first);
      await expect(
        context.repository.findByIdempotencyKey(first.idempotencyKey),
      ).resolves.toEqual(first);
      await expect(
        context.repository.findByFiscalReceiptNumber('HDM-CONTRACT-RESTART'),
      ).resolves.toEqual(first);
      // Equal timestamps deliberately lock the deterministic id DESC tie-break.
      await expect(context.repository.list()).resolves.toEqual([second, first]);
      const counts = await context.repository.countByStatus();
      expect(counts.OUT_FOR_DELIVERY).toBe(1);
      expect(counts.REQUEST_RECEIVED).toBe(1);
      expect(Object.keys(counts)).toEqual([...ORDER_STATUSES]);
    });
  });
};
