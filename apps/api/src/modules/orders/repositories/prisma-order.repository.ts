import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type Order as PersistedOrder,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { createProcurementTaskForOrder } from '../../procurement/procurement-task.factory';
import { ORDER_STATUSES, type OrderRecord, type OrderStatus } from '../order.model';
import {
  ConcurrentOrderModificationError,
  FiscalReceiptNumberAlreadyUsedError,
  type IdempotentCreateResult,
  type OrderRepository,
} from './order.repository';

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

const uniqueTargetIncludes = (
  error: Prisma.PrismaClientKnownRequestError,
  ...fields: string[]
): boolean => {
  const target = error.meta?.target;
  const rendered = Array.isArray(target) ? target.join(',') : String(target ?? '');
  return fields.some((field) => rendered.includes(field));
};

const assertObjectPayload = (
  value: Prisma.JsonValue,
  entity: string,
): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Persisted ${entity} payload is not a JSON object`);
  }
  return structuredClone(value) as Record<string, unknown>;
};

export const hydrateOrder = (row: PersistedOrder): OrderRecord => {
  const payload = assertObjectPayload(row.payload, 'order') as unknown as OrderRecord;
  const createdAt = row.createdAt.toISOString();
  const updatedAt = row.updatedAt.toISOString();
  if (
    payload.id !== row.id ||
    payload.orderNumber !== row.orderNumber ||
    payload.idempotencyKey !== row.idempotencyKey ||
    payload.requestHash !== row.requestHash ||
    payload.status !== row.status ||
    payload.cod?.status !== row.cashStatus ||
    payload.cod?.fiscalReceiptNumber !== row.fiscalReceiptNumber ||
    payload.createdAt !== createdAt ||
    payload.updatedAt !== updatedAt ||
    !Array.isArray(payload.items)
  ) {
    throw new Error(`Persisted order projections do not match payload for ${row.id}`);
  }
  return payload;
};

export const orderData = (order: OrderRecord) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  idempotencyKey: order.idempotencyKey,
  requestHash: order.requestHash,
  status: order.status,
  cashStatus: order.cod.status,
  fiscalReceiptNumber: order.cod.fiscalReceiptNumber,
  createdAt: timestamp(order.createdAt, 'order.createdAt'),
  updatedAt: timestamp(order.updatedAt, 'order.updatedAt'),
  payload: json(order),
});

@Injectable()
export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createIdempotently(order: OrderRecord): Promise<IdempotentCreateResult> {
    const existing = await this.findByIdempotencyKey(order.idempotencyKey);
    if (existing) return this.replay(existing, order);

    const task = createProcurementTaskForOrder(order, undefined, order.createdAt);
    try {
      const created = await this.prisma.order.create({
        data: {
          ...orderData(order),
          procurementTask: {
            create: {
              id: task.id,
              orderNumber: task.orderNumber,
              status: task.status,
              createdAt: timestamp(task.createdAt, 'procurement.createdAt'),
              updatedAt: timestamp(task.updatedAt, 'procurement.updatedAt'),
              payload: json(task),
            },
          },
        },
      });
      return { outcome: 'CREATED', order: hydrateOrder(created) };
    } catch (error) {
      if (isPrismaError(error, 'P2002')) {
        const raced = await this.findByIdempotencyKey(order.idempotencyKey);
        if (raced) return this.replay(raced, order);
      }
      if (
        order.cod.fiscalReceiptNumber &&
        isPrismaError(error, 'P2002') &&
        uniqueTargetIncludes(error, 'fiscal_receipt_number', 'fiscalReceiptNumber')
      ) {
        const owner = await this.findByFiscalReceiptNumber(order.cod.fiscalReceiptNumber);
        if (owner && owner.id !== order.id) {
          throw new FiscalReceiptNumberAlreadyUsedError(
            order.cod.fiscalReceiptNumber,
            owner.id,
          );
        }
      }
      throw error;
    }
  }

  async findById(id: string): Promise<OrderRecord | null> {
    const row = await this.prisma.order.findUnique({ where: { id } });
    return row ? hydrateOrder(row) : null;
  }

  async findByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    const row = await this.prisma.order.findUnique({ where: { idempotencyKey: key } });
    return row ? hydrateOrder(row) : null;
  }

  async findByFiscalReceiptNumber(
    fiscalReceiptNumber: string,
  ): Promise<OrderRecord | null> {
    const row = await this.prisma.order.findUnique({ where: { fiscalReceiptNumber } });
    return row ? hydrateOrder(row) : null;
  }

  async list(): Promise<OrderRecord[]> {
    const rows = await this.prisma.order.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return rows.map(hydrateOrder);
  }

  async save(order: OrderRecord, expectedUpdatedAt?: string): Promise<OrderRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        if (expectedUpdatedAt) {
          const result = await transaction.order.updateMany({
            where: {
              id: order.id,
              updatedAt: timestamp(expectedUpdatedAt, 'expected order.updatedAt'),
            },
            data: orderData(order),
          });
          if (result.count === 0) {
            const current = await transaction.order.findUnique({ where: { id: order.id } });
            if (!current) throw new Error('Cannot save an unknown order');
            throw new ConcurrentOrderModificationError(order.id);
          }
        } else {
          await transaction.order.update({
            where: { id: order.id },
            data: orderData(order),
          });
        }
        const saved = await transaction.order.findUnique({ where: { id: order.id } });
        if (!saved) throw new Error('Cannot save an unknown order');
        return hydrateOrder(saved);
      });
    } catch (error) {
      if (isPrismaError(error, 'P2025')) throw new Error('Cannot save an unknown order');
      if (
        order.cod.fiscalReceiptNumber &&
        isPrismaError(error, 'P2002') &&
        uniqueTargetIncludes(error, 'fiscal_receipt_number', 'fiscalReceiptNumber')
      ) {
        const owner = await this.findByFiscalReceiptNumber(order.cod.fiscalReceiptNumber);
        throw new FiscalReceiptNumberAlreadyUsedError(
          order.cod.fiscalReceiptNumber,
          owner?.id ?? 'unknown',
        );
      }
      throw error;
    }
  }

  async countByStatus(): Promise<Record<OrderStatus, number>> {
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
      OrderStatus,
      number
    >;
    const rows = await this.prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    rows.forEach((row) => {
      counts[row.status] = row._count._all;
    });
    return counts;
  }

  private replay(existing: OrderRecord, candidate: OrderRecord): IdempotentCreateResult {
    return {
      outcome: existing.requestHash === candidate.requestHash ? 'REPLAYED' : 'CONFLICT',
      order: structuredClone(existing),
    };
  }
}
