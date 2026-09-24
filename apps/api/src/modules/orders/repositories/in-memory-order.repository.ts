import { Injectable } from '@nestjs/common';
import { ORDER_STATUSES, type OrderRecord, type OrderStatus } from '../order.model';
import {
  ConcurrentOrderModificationError,
  FiscalReceiptNumberAlreadyUsedError,
  type IdempotentCreateResult,
  type OrderRepository,
} from './order.repository';

@Injectable()
export class InMemoryOrderRepository implements OrderRepository {
  private readonly orders = new Map<string, OrderRecord>();
  private readonly orderIdsByIdempotencyKey = new Map<string, string>();
  private readonly orderIdsByFiscalReceiptNumber = new Map<string, string>();

  async createIdempotently(order: OrderRecord): Promise<IdempotentCreateResult> {
    const existingId = this.orderIdsByIdempotencyKey.get(order.idempotencyKey);
    if (existingId) {
      const existing = this.orders.get(existingId);
      if (!existing) throw new Error('Order idempotency index is inconsistent');
      return {
        outcome: existing.requestHash === order.requestHash ? 'REPLAYED' : 'CONFLICT',
        order: structuredClone(existing),
      };
    }

    this.assertFiscalReceiptNumberAvailable(order);
    this.orders.set(order.id, structuredClone(order));
    this.orderIdsByIdempotencyKey.set(order.idempotencyKey, order.id);
    this.indexFiscalReceiptNumber(order);
    return { outcome: 'CREATED', order: structuredClone(order) };
  }

  async findById(id: string): Promise<OrderRecord | null> {
    const order = this.orders.get(id);
    return order ? structuredClone(order) : null;
  }

  async findByIdempotencyKey(key: string): Promise<OrderRecord | null> {
    const id = this.orderIdsByIdempotencyKey.get(key);
    if (!id) return null;
    const order = this.orders.get(id);
    return order ? structuredClone(order) : null;
  }

  async findByFiscalReceiptNumber(fiscalReceiptNumber: string): Promise<OrderRecord | null> {
    const id = this.orderIdsByFiscalReceiptNumber.get(fiscalReceiptNumber);
    if (!id) return null;
    const order = this.orders.get(id);
    return order ? structuredClone(order) : null;
  }

  async list(): Promise<OrderRecord[]> {
    return [...this.orders.values()]
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
      )
      .map((order) => structuredClone(order));
  }

  async save(order: OrderRecord, expectedUpdatedAt?: string): Promise<OrderRecord> {
    return this.prepareSave(order, expectedUpdatedAt)();
  }

  // Prepare every fallible check and clone before a multi-record commit begins.
  // The returned commit must run synchronously, without yielding to another request.
  prepareSave(order: OrderRecord, expectedUpdatedAt?: string): () => OrderRecord {
    const previous = this.orders.get(order.id);
    if (!previous) throw new Error('Cannot save an unknown order');
    if (expectedUpdatedAt && previous.updatedAt !== expectedUpdatedAt) {
      throw new ConcurrentOrderModificationError(order.id);
    }
    this.assertFiscalReceiptNumberAvailable(order);
    const stored = structuredClone(order);
    const result = structuredClone(order);
    const previousReceipt = previous.cod.fiscalReceiptNumber;
    return () => {
      if (
        previousReceipt &&
        previousReceipt !== stored.cod.fiscalReceiptNumber &&
        this.orderIdsByFiscalReceiptNumber.get(previousReceipt) === stored.id
      ) {
        this.orderIdsByFiscalReceiptNumber.delete(previousReceipt);
      }
      this.orders.set(stored.id, stored);
      this.orderIdsByIdempotencyKey.set(stored.idempotencyKey, stored.id);
      this.indexFiscalReceiptNumber(stored);
      return result;
    };
  }

  async countByStatus(): Promise<Record<OrderStatus, number>> {
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0])) as Record<
      OrderStatus,
      number
    >;
    this.orders.forEach((order) => {
      counts[order.status] += 1;
    });
    return counts;
  }

  private assertFiscalReceiptNumberAvailable(order: OrderRecord): void {
    const receipt = order.cod.fiscalReceiptNumber;
    if (!receipt) return;
    const existingOrderId = this.orderIdsByFiscalReceiptNumber.get(receipt);
    if (existingOrderId && existingOrderId !== order.id) {
      throw new FiscalReceiptNumberAlreadyUsedError(receipt, existingOrderId);
    }
  }

  private indexFiscalReceiptNumber(order: OrderRecord): void {
    const receipt = order.cod.fiscalReceiptNumber;
    if (receipt) this.orderIdsByFiscalReceiptNumber.set(receipt, order.id);
  }
}
