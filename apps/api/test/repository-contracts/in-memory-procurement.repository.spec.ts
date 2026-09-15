import { InMemoryProcurementRepository } from '../../src/modules/procurement/repositories/in-memory-procurement.repository';
import { defineProcurementRepositoryContract } from './procurement.repository.contract';

defineProcurementRepositoryContract('InMemoryProcurementRepository', () => ({
  repository: new InMemoryProcurementRepository(),
}));
