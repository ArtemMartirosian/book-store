import { createProcurementTaskForOrder } from '../../src/modules/procurement/procurement-task.factory';
import {
  ConcurrentProcurementModificationError,
  type ProcurementRepository,
} from '../../src/modules/procurement/repositories/procurement.repository';
import {
  ConcurrentOrderModificationError,
  type OrderRepository,
} from '../../src/modules/orders/repositories/order.repository';
import type {
  OrderProcurementChange,
  OrderProcurementPair,
  OrderProcurementUnitOfWork,
} from '../../src/modules/orders/repositories/order-procurement.unit-of-work';
import { makeOrderRepositoryContractRecord } from './order.repository.contract';

export interface OrderProcurementContractContext {
  orders: OrderRepository;
  procurement: ProcurementRepository;
  unitOfWork: OrderProcurementUnitOfWork;
  cleanup?: () => Promise<void>;
}

const confirmedChange = (pair: OrderProcurementPair): OrderProcurementChange => ({
  order: { ...pair.order, status: 'SUPPLIER_CONFIRMED', updatedAt: new Date(Date.parse(pair.order.updatedAt) + 1).toISOString() },
  task: {
    ...pair.task,
    status: 'SUPPLIER_CONFIRMED',
    supplierReference: 'CONTRACT-SUPPLIER-001',
    confirmedAt: new Date(Date.parse(pair.task.updatedAt) + 1).toISOString(),
    updatedAt: new Date(Date.parse(pair.task.updatedAt) + 1).toISOString(),
  },
  expectedOrderUpdatedAt: pair.order.updatedAt,
  expectedTaskUpdatedAt: pair.task.updatedAt,
});

export const defineOrderProcurementContract = (
  subject: string,
  createContext: () => OrderProcurementContractContext | Promise<OrderProcurementContractContext>,
): void => {
  describe(`${subject} OrderProcurementUnitOfWork contract`, () => {
    let context: OrderProcurementContractContext;
    let initial: OrderProcurementPair;

    beforeEach(async () => {
      context = await createContext();
      const candidate = makeOrderRepositoryContractRecord(450);
      candidate.status = 'PROCUREMENT_PENDING';
      const { order } = await context.orders.createIdempotently(candidate);
      // PostgreSQL order creation already inserts the task in its own transaction.
      // createForOrder must return that exact task instead of creating a duplicate.
      const task = await context.procurement.createForOrder(createProcurementTaskForOrder(order, undefined, order.updatedAt));
      initial = { order, task };
    });

    afterEach(async () => { await context?.cleanup?.(); });

    it('saves the linked pair and retains one procurement task per order', async () => {
      const change = confirmedChange(initial);
      const result = await context.unitOfWork.savePair(change);
      expect(result.order.status).toBe('SUPPLIER_CONFIRMED');
      expect(result.task.status).toBe('SUPPLIER_CONFIRMED');
      await expect(context.orders.findById(initial.order.id)).resolves.toEqual(result.order);
      await expect(context.procurement.findById(initial.task.id)).resolves.toEqual(result.task);
      await expect(context.procurement.list()).resolves.toHaveLength(1);
      result.order.customer.fullName = 'Caller mutation';
      result.task.supplierReference = 'Caller mutation';
      await expect(context.orders.findById(initial.order.id)).resolves.toMatchObject({ customer: initial.order.customer });
      await expect(context.procurement.findById(initial.task.id)).resolves.toMatchObject({ supplierReference: 'CONTRACT-SUPPLIER-001' });
    });

    it.each(['order', 'task'] as const)('rejects a stale %s version without a partial write', async (entity) => {
      const change = confirmedChange(initial);
      if (entity === 'order') change.expectedOrderUpdatedAt = '2000-01-01T00:00:00.000Z';
      else change.expectedTaskUpdatedAt = '2000-01-01T00:00:00.000Z';
      await expect(context.unitOfWork.savePair(change)).rejects.toBeInstanceOf(
        entity === 'order' ? ConcurrentOrderModificationError : ConcurrentProcurementModificationError,
      );
      await expect(context.orders.findById(initial.order.id)).resolves.toEqual(initial.order);
      await expect(context.procurement.findById(initial.task.id)).resolves.toEqual(initial.task);
    });

    it('serializes competing confirmations and cancellations as complete pairs', async () => {
      const confirmed = confirmedChange(initial);
      const cancelled: OrderProcurementChange = {
        ...confirmedChange(initial),
        order: { ...confirmed.order, status: 'CANCELLED' },
        task: { ...confirmed.task, status: 'CANCELLED', supplierReference: null, confirmedAt: null, operatorNote: 'Cancelled by competing operator', resolvedAt: confirmed.task.updatedAt },
      };
      const results = await Promise.allSettled([
        context.unitOfWork.savePair(confirmed),
        context.unitOfWork.savePair(cancelled),
      ]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      const winningOrder = await context.orders.findById(initial.order.id);
      const winningTask = await context.procurement.findById(initial.task.id);
      expect(winningOrder?.status).toBe(winningTask?.status);
      expect(['SUPPLIER_CONFIRMED', 'CANCELLED']).toContain(winningOrder?.status);
      expect(winningTask?.supplierReference).toBe(winningOrder?.status === 'SUPPLIER_CONFIRMED' ? 'CONTRACT-SUPPLIER-001' : null);
    });
  });
};
