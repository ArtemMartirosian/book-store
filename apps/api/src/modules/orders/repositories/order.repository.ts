import type { OrderRecord, OrderStatus } from '../order.model';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export type IdempotentCreateResult = {
  outcome: 'CREATED' | 'REPLAYED' | 'CONFLICT';
  order: OrderRecord;
};

export class FiscalReceiptNumberAlreadyUsedError extends Error {
  constructor(
    readonly fiscalReceiptNumber: string,
    readonly existingOrderId: string,
  ) {
    super(`Fiscal receipt number ${fiscalReceiptNumber} is already assigned to another order`);
    this.name = 'FiscalReceiptNumberAlreadyUsedError';
  }
}

export class ConcurrentOrderModificationError extends Error {
  constructor(readonly orderId: string) {
    super(`Order ${orderId} was modified by another request`);
    this.name = 'ConcurrentOrderModificationError';
  }
}

export interface OrderRepository {
  createIdempotently(order: OrderRecord): Promise<IdempotentCreateResult>;
  findById(id: string): Promise<OrderRecord | null>;
  findByIdempotencyKey(key: string): Promise<OrderRecord | null>;
  findByFiscalReceiptNumber(fiscalReceiptNumber: string): Promise<OrderRecord | null>;
  list(): Promise<OrderRecord[]>;
  save(order: OrderRecord, expectedUpdatedAt?: string): Promise<OrderRecord>;
  countByStatus(): Promise<Record<OrderStatus, number>>;
}
