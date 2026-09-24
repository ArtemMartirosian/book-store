import { InMemoryOrderProcurementUnitOfWork } from '../../src/modules/orders/repositories/in-memory-order-procurement.unit-of-work';
import { InMemoryOrderRepository } from '../../src/modules/orders/repositories/in-memory-order.repository';
import { InMemoryProcurementRepository } from '../../src/modules/procurement/repositories/in-memory-procurement.repository';
import { defineOrderProcurementContract } from './order-procurement.unit-of-work.contract';

defineOrderProcurementContract('InMemory', () => {
  const orders = new InMemoryOrderRepository();
  const procurement = new InMemoryProcurementRepository();
  return { orders, procurement, unitOfWork: new InMemoryOrderProcurementUnitOfWork(orders, procurement) };
});
