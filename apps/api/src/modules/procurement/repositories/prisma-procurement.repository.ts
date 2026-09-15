import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type ProcurementTask as PersistedProcurementTask,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  PROCUREMENT_STATUSES,
  type ProcurementStatus,
  type ProcurementTaskRecord,
} from '../procurement.model';
import {
  ConcurrentProcurementModificationError,
  type ProcurementRepository,
} from './procurement.repository';

const json = <T>(value: T): Prisma.InputJsonValue =>
  structuredClone(value) as unknown as Prisma.InputJsonValue;

const timestamp = (value: string, field: string): Date => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) throw new Error(`Invalid ${field} timestamp`);
  return parsed;
};

const isPrismaError = (
  error: unknown,
  code: string,
): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;

export const hydrateProcurementTask = (
  row: PersistedProcurementTask,
): ProcurementTaskRecord => {
  if (!row.payload || typeof row.payload !== 'object' || Array.isArray(row.payload)) {
    throw new Error(`Persisted procurement payload is not a JSON object for ${row.id}`);
  }
  const payload = structuredClone(row.payload) as unknown as ProcurementTaskRecord;
  if (
    payload.id !== row.id ||
    payload.orderId !== row.orderId ||
    payload.orderNumber !== row.orderNumber ||
    payload.status !== row.status ||
    payload.createdAt !== row.createdAt.toISOString() ||
    payload.updatedAt !== row.updatedAt.toISOString() ||
    !Array.isArray(payload.items)
  ) {
    throw new Error(`Persisted procurement projections do not match payload for ${row.id}`);
  }
  return payload;
};

const taskData = (task: ProcurementTaskRecord) => ({
  id: task.id,
  orderId: task.orderId,
  orderNumber: task.orderNumber,
  status: task.status,
  createdAt: timestamp(task.createdAt, 'procurement.createdAt'),
  updatedAt: timestamp(task.updatedAt, 'procurement.updatedAt'),
  payload: json(task),
});

@Injectable()
export class PrismaProcurementRepository implements ProcurementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createForOrder(task: ProcurementTaskRecord): Promise<ProcurementTaskRecord> {
    const existing = await this.findByOrderId(task.orderId);
    if (existing) return existing;
    try {
      const created = await this.prisma.procurementTask.create({ data: taskData(task) });
      return hydrateProcurementTask(created);
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const raced = await this.findByOrderId(task.orderId);
        if (raced) return raced;
      }
      throw error;
    }
  }

  async findById(id: string): Promise<ProcurementTaskRecord | null> {
    const row = await this.prisma.procurementTask.findUnique({ where: { id } });
    return row ? hydrateProcurementTask(row) : null;
  }

  async findByOrderId(orderId: string): Promise<ProcurementTaskRecord | null> {
    const row = await this.prisma.procurementTask.findUnique({ where: { orderId } });
    return row ? hydrateProcurementTask(row) : null;
  }

  async list(): Promise<ProcurementTaskRecord[]> {
    const rows = await this.prisma.procurementTask.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(hydrateProcurementTask);
  }

  async save(
    task: ProcurementTaskRecord,
    expectedUpdatedAt?: string,
  ): Promise<ProcurementTaskRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (expectedUpdatedAt) {
          const result = await transaction.procurementTask.updateMany({
            where: {
              id: task.id,
              updatedAt: timestamp(expectedUpdatedAt, 'expected procurement.updatedAt'),
            },
            data: taskData(task),
          });
          if (result.count === 0) {
            const current = await transaction.procurementTask.findUnique({
              where: { id: task.id },
            });
            if (!current) throw new Error('Cannot save an unknown procurement task');
            throw new ConcurrentProcurementModificationError(task.id);
          }
        } else {
          await transaction.procurementTask.update({
            where: { id: task.id },
            data: taskData(task),
          });
        }
        const saved = await transaction.procurementTask.findUnique({
          where: { id: task.id },
        });
        if (!saved) throw new Error('Cannot save an unknown procurement task');
        return hydrateProcurementTask(saved);
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) {
        throw new Error('Cannot save an unknown procurement task');
      }
      throw error;
    }
  }

  async countByStatus(): Promise<Record<ProcurementStatus, number>> {
    const counts = Object.fromEntries(
      PROCUREMENT_STATUSES.map((status) => [status, 0]),
    ) as Record<ProcurementStatus, number>;
    const rows = await this.prisma.procurementTask.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    rows.forEach((row) => {
      counts[row.status] = row._count._all;
    });
    return counts;
  }
}
