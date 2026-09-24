import { InMemoryProcurementRepository } from '../../procurement/repositories/in-memory-procurement.repository';
import { InMemoryOrderRepository } from './in-memory-order.repository';
import {
  assertLinkedRecords,
  type OrderProcurementChange,
  type OrderProcurementPair,
  type OrderProcurementUnitOfWork,
} from './order-procurement.unit-of-work';

export class InMemoryOrderProcurementUnitOfWork implements OrderProcurementUnitOfWork {
  constructor(
    private readonly orders: InMemoryOrderRepository,
    private readonly procurement: InMemoryProcurementRepository,
  ) {}

  async savePair(change: OrderProcurementChange): Promise<OrderProcurementPair> {
    assertLinkedRecords(change);
    const commitOrder = this.orders.prepareSave(change.order, change.expectedOrderUpdatedAt);
    const commitTask = this.procurement.prepareSave(change.task, change.expectedTaskUpdatedAt);
    // There is no await between validation and publication. On one JS event loop,
    // no other read or write can observe an intermediate state of these two maps.
    return { order: commitOrder(), task: commitTask() };
  }
}
