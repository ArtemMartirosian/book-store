import type { ProcurementTaskRecord } from '../../procurement/procurement.model';
import type { OrderRecord } from '../order.model';

export const ORDER_PROCUREMENT_UNIT_OF_WORK = Symbol('ORDER_PROCUREMENT_UNIT_OF_WORK');

export interface OrderProcurementPair {
  order: OrderRecord;
  task: ProcurementTaskRecord;
}

export interface OrderProcurementChange extends OrderProcurementPair {
  expectedOrderUpdatedAt: string;
  expectedTaskUpdatedAt: string;
}

export interface OrderProcurementUnitOfWork {
  savePair(change: OrderProcurementChange): Promise<OrderProcurementPair>;
}

export const assertLinkedRecords = ({ order, task }: OrderProcurementPair): void => {
  if (task.orderId !== order.id || task.orderNumber !== order.orderNumber) {
    throw new Error('Order and procurement task must belong to the same order');
  }
};
