import {
  defineOrderRepositoryContract,
  definePersistentOrderRepositoryContract,
} from './order.repository.contract';
import {
  definePersistentProcurementRepositoryContract,
  defineProcurementRepositoryContract,
} from './procurement.repository.contract';
import { createIsolatedPostgresRepositoryHarness } from './prisma.repository.harness';

const sourceDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

if (!sourceDatabaseUrl) {
  describe.skip('Prisma repository contracts', () => {
    it('requires TEST_DATABASE_URL or DATABASE_URL', () => undefined);
  });
} else {
  jest.setTimeout(120_000);
  const harness = createIsolatedPostgresRepositoryHarness(sourceDatabaseUrl);

  beforeAll(async () => {
    await harness.setup();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  defineOrderRepositoryContract('PrismaOrderRepository', harness.createOrderContext);
  definePersistentOrderRepositoryContract(
    'PrismaOrderRepository',
    harness.createOrderContext,
  );
  defineProcurementRepositoryContract(
    'PrismaProcurementRepository',
    harness.createProcurementContext,
  );
  definePersistentProcurementRepositoryContract(
    'PrismaProcurementRepository',
    harness.createProcurementContext,
  );
}
