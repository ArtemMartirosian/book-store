import { PrismaService } from '../../../database/prisma.service';
import { createProcurementTaskForOrder } from '../../procurement/procurement-task.factory';
import { taskData } from '../../procurement/repositories/prisma-procurement.repository';
import { ConcurrentProcurementModificationError } from '../../procurement/repositories/procurement.repository';
import { makeOrderRepositoryContractRecord } from '../../../../test/repository-contracts/order.repository.contract';
import { ConcurrentOrderModificationError } from './order.repository';
import type { OrderProcurementChange } from './order-procurement.unit-of-work';
import { orderData } from './prisma-order.repository';
import { PrismaOrderProcurementUnitOfWork } from './prisma-order-procurement.unit-of-work';

const createHarness = (failure?: 'order' | 'task' | 'commit') => {
  const order = makeOrderRepositoryContractRecord(321);
  order.status = 'PROCUREMENT_PENDING';
  const task = createProcurementTaskForOrder(order, undefined, order.updatedAt);
  let stored = { order: orderData(order), task: taskData(task) };
  const writes: string[] = [];
  // A transactional test double: only commit the draft when the callback succeeds.
  // These tests verify participation in one transaction, not PostgreSQL itself.
  const transaction = jest.fn(async (run: (client: unknown) => Promise<unknown>) => {
    const draft = structuredClone(stored);
    await run({
      order: {
        updateMany: async ({ where, data }: { where: { id: string; updatedAt: Date }; data: typeof draft.order }) => {
          writes.push('order');
          if (failure === 'order') throw new Error('Injected database failure');
          if (where.id !== draft.order.id || where.updatedAt.valueOf() !== draft.order.updatedAt.valueOf()) return { count: 0 };
          draft.order = structuredClone(data);
          return { count: 1 };
        },
      },
      procurementTask: {
        updateMany: async ({ where, data }: { where: { id: string; orderId: string; updatedAt: Date }; data: typeof draft.task }) => {
          writes.push('task');
          if (failure === 'task') throw new Error('Injected database failure');
          if (where.id !== draft.task.id || where.orderId !== draft.task.orderId || where.updatedAt.valueOf() !== draft.task.updatedAt.valueOf()) return { count: 0 };
          draft.task = structuredClone(data);
          return { count: 1 };
        },
      },
    });
    if (failure === 'commit') throw new Error('Injected database failure');
    stored = draft;
  });
  const unit = new PrismaOrderProcurementUnitOfWork({ $transaction: transaction } as unknown as PrismaService);
  const next = new Date(Date.parse(order.updatedAt) + 1).toISOString();
  const change: OrderProcurementChange = {
    order: { ...order, status: 'SUPPLIER_CONFIRMED', updatedAt: next },
    task: { ...task, status: 'SUPPLIER_CONFIRMED', supplierReference: 'TEST-SUPPLIER-321', confirmedAt: next, updatedAt: next },
    expectedOrderUpdatedAt: order.updatedAt,
    expectedTaskUpdatedAt: task.updatedAt,
  };
  return { unit, change, writes, transaction, state: () => structuredClone(stored) };
};

describe('PrismaOrderProcurementUnitOfWork transaction boundary', () => {
  it('saves the pair in a single transaction and returns independent snapshots', async () => {
    const { unit, change, transaction, writes, state } = createHarness();
    const result = await unit.savePair(change);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(writes).toEqual(['order', 'task']);
    expect(state().order.status).toBe('SUPPLIER_CONFIRMED');
    expect(state().task.status).toBe('SUPPLIER_CONFIRMED');
    result.order.customer.fullName = 'Caller mutation';
    expect(state().order.payload).toMatchObject({ customer: { fullName: change.order.customer.fullName } });
  });

  it.each(['order', 'task', 'commit'] as const)('keeps both snapshots unchanged after a %s database failure', async (failure) => {
    const { unit, change, state } = createHarness(failure);
    const before = state();
    await expect(unit.savePair(change)).rejects.toThrow('Injected database failure');
    expect(state()).toEqual(before);
  });

  it.each(['order', 'task'] as const)('rejects a stale %s CAS without committing the other update', async (entity) => {
    const { unit, change, state } = createHarness();
    const before = state();
    if (entity === 'order') change.expectedOrderUpdatedAt = '2000-01-01T00:00:00.000Z';
    else change.expectedTaskUpdatedAt = '2000-01-01T00:00:00.000Z';
    await expect(unit.savePair(change)).rejects.toBeInstanceOf(
      entity === 'order' ? ConcurrentOrderModificationError : ConcurrentProcurementModificationError,
    );
    expect(state()).toEqual(before);
  });

  it('rejects a task belonging to a different order before opening a transaction', async () => {
    const { unit, change, transaction } = createHarness();
    change.task.orderId = '00000000-0000-4000-8000-000000000099';
    await expect(unit.savePair(change)).rejects.toThrow('must belong to the same order');
    expect(transaction).not.toHaveBeenCalled();
  });
});
