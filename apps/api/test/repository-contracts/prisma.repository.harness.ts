import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/database/prisma.service';
import { PrismaOrderRepository } from '../../src/modules/orders/repositories/prisma-order.repository';
import type { ProcurementTaskRecord } from '../../src/modules/procurement/procurement.model';
import { PrismaProcurementRepository } from '../../src/modules/procurement/repositories/prisma-procurement.repository';
import {
  makeOrderRepositoryContractRecord,
  type PersistentOrderRepositoryContractContext,
} from './order.repository.contract';
import type { PersistentProcurementRepositoryContractContext } from './procurement.repository.contract';

const schemaName = (): string =>
  `lumi_repository_contract_${process.pid}_${Date.now().toString(36)}`;

const databaseUrlForSchema = (databaseUrl: string, schema: string): string => {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('PostgreSQL repository contracts require a postgres:// URL');
  }
  parsed.searchParams.set('schema', schema);
  return parsed.toString();
};

const configFor = (databaseUrl: string): ConfigService =>
  new ConfigService({
    PERSISTENCE_ADAPTER: 'POSTGRES',
    DATABASE_URL: databaseUrl,
  });

const connect = async (databaseUrl: string): Promise<PrismaService> => {
  const prisma = new PrismaService(configFor(databaseUrl));
  await prisma.$connect();
  return prisma;
};

const resetRows = async (prisma: PrismaService): Promise<void> => {
  // Order creation atomically creates a procurement task, so children always
  // have to be removed before their parent rows.
  await prisma.procurementTask.deleteMany();
  await prisma.order.deleteMany();
};

const migrationFailure = (
  status: number | null,
  stdout: string | Buffer | null,
  stderr: string | Buffer | null,
): Error => {
  const details = `${String(stderr ?? '')}\n${String(stdout ?? '')}`
    .trim()
    .slice(0, 2_000);
  return new Error(
    `Prisma migrate deploy failed for the isolated contract schema (status ${status})${details ? `: ${details}` : ''}`,
  );
};

const prepareParentOrder = async (
  prisma: PrismaService,
  task: ProcurementTaskRecord,
): Promise<void> => {
  const order = makeOrderRepositoryContractRecord(9_000);
  order.id = task.orderId;
  order.orderNumber = task.orderNumber;
  order.idempotencyKey = `procurement-contract-parent-${task.orderId}`;
  order.requestHash = createHash('sha256').update(task.orderId).digest('hex');
  order.createdAt = task.createdAt;
  order.updatedAt = task.createdAt;
  order.items = task.items.map((item) => ({
    productId: item.productId,
    supplierSku: item.supplierSku,
    title: item.title,
    author: item.author,
    sourceUrl: item.sourceUrl,
    quantity: item.quantity,
    sourceUnitPriceAmd: item.observedSourceUnitPriceAmd,
    customerUnitPriceAmd: item.observedSourceUnitPriceAmd + 500,
    customerSubtotalAmd: (item.observedSourceUnitPriceAmd + 500) * item.quantity,
  }));
  order.itemsSubtotalAmd = order.items.reduce(
    (total, item) => total + item.customerSubtotalAmd,
    0,
  );
  order.totalAmd = order.itemsSubtotalAmd + order.deliveryFeeAmd;
  order.cod.dueAmd = order.totalAmd;

  try {
    await prisma.order.upsert({
      where: { id: order.id },
      update: {},
      create: {
        id: order.id,
        orderNumber: order.orderNumber,
        idempotencyKey: order.idempotencyKey,
        requestHash: order.requestHash,
        status: order.status,
        cashStatus: order.cod.status,
        fiscalReceiptNumber: order.cod.fiscalReceiptNumber,
        createdAt: new Date(order.createdAt),
        updatedAt: new Date(order.updatedAt),
        payload: structuredClone(order) as unknown as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
      throw error;
    }
    const winner = await prisma.order.findUnique({ where: { id: order.id } });
    if (!winner) throw error;
  }
};

export interface IsolatedPostgresRepositoryHarness {
  databaseUrl: string;
  schema: string;
  setup: () => Promise<void>;
  teardown: () => Promise<void>;
  createOrderContext: () => Promise<PersistentOrderRepositoryContractContext>;
  createProcurementContext: () => Promise<PersistentProcurementRepositoryContractContext>;
}

export const createIsolatedPostgresRepositoryHarness = (
  sourceDatabaseUrl: string,
): IsolatedPostgresRepositoryHarness => {
  const schema = schemaName();
  const databaseUrl = databaseUrlForSchema(sourceDatabaseUrl, schema);
  let schemaCreated = false;

  const setup = async (): Promise<void> => {
    const bootstrap = await connect(databaseUrl);
    try {
      await bootstrap.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await bootstrap.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      schemaCreated = true;
    } finally {
      await bootstrap.$disconnect();
    }

    const prismaCli = require.resolve('prisma/build/index.js');
    const migration = spawnSync(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--schema', resolve(process.cwd(), 'prisma/schema.prisma')],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        encoding: 'utf8',
      },
    );
    if (migration.status !== 0) {
      await teardown();
      throw migrationFailure(migration.status, migration.stdout, migration.stderr);
    }
  };

  const teardown = async (): Promise<void> => {
    if (!schemaCreated) return;
    const bootstrap = await connect(databaseUrl);
    try {
      await bootstrap.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      schemaCreated = false;
    } finally {
      await bootstrap.$disconnect();
    }
  };

  const createOrderContext =
    async (): Promise<PersistentOrderRepositoryContractContext> => {
      let prisma = await connect(databaseUrl);
      await resetRows(prisma);
      return {
        repository: new PrismaOrderRepository(prisma),
        reopen: async () => {
          await prisma.$disconnect();
          prisma = await connect(databaseUrl);
          return new PrismaOrderRepository(prisma);
        },
        cleanup: async () => {
          try {
            await resetRows(prisma);
          } finally {
            await prisma.$disconnect();
          }
        },
      };
    };

  const createProcurementContext =
    async (): Promise<PersistentProcurementRepositoryContractContext> => {
      let prisma = await connect(databaseUrl);
      await resetRows(prisma);
      return {
        repository: new PrismaProcurementRepository(prisma),
        prepareTask: async (task) => prepareParentOrder(prisma, task),
        reopen: async () => {
          await prisma.$disconnect();
          prisma = await connect(databaseUrl);
          return new PrismaProcurementRepository(prisma);
        },
        cleanup: async () => {
          try {
            await resetRows(prisma);
          } finally {
            await prisma.$disconnect();
          }
        },
      };
    };

  return {
    databaseUrl,
    schema,
    setup,
    teardown,
    createOrderContext,
    createProcurementContext,
  };
};
