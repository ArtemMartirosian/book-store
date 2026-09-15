import { InMemoryOrderRepository } from '../../src/modules/orders/repositories/in-memory-order.repository';
import { defineOrderRepositoryContract } from './order.repository.contract';

defineOrderRepositoryContract('InMemoryOrderRepository', () => ({
  repository: new InMemoryOrderRepository(),
}));
