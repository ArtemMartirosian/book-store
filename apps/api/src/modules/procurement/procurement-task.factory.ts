import { randomUUID } from 'node:crypto';
import type { OrderRecord } from '../orders/order.model';
import type { ProcurementTaskRecord } from './procurement.model';

export const createProcurementTaskForOrder = (
  order: OrderRecord,
  id = randomUUID(),
  now = new Date().toISOString(),
): ProcurementTaskRecord => ({
  id,
  orderId: order.id,
  orderNumber: order.orderNumber,
  status: 'PENDING_OPERATOR',
  supplierName: 'Books.am',
  currency: 'AMD',
  supplierItemsSubtotalAmd: order.items.reduce(
    (total, item) => total + item.sourceUnitPriceAmd * item.quantity,
    0,
  ),
  supplierDeliveryFeeAmd: null,
  supplierTotalAmd: null,
  items: order.items.map((item) => ({
    productId: item.productId,
    supplierSku: item.supplierSku,
    title: item.title,
    author: item.author,
    sourceUrl: item.sourceUrl,
    quantity: item.quantity,
    observedSourceUnitPriceAmd: item.sourceUnitPriceAmd,
  })),
  supplierReference: null,
  operatorNote: null,
  confirmedAt: null,
  resolvedAt: null,
  createdAt: now,
  updatedAt: now,
});
