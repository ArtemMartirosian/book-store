export const PROCUREMENT_STATUSES = [
  'PENDING_OPERATOR',
  'SUPPLIER_CONFIRMED',
  'SOURCE_UNAVAILABLE',
  'CANCELLED',
] as const;

export type ProcurementStatus = (typeof PROCUREMENT_STATUSES)[number];

export interface ProcurementItemSnapshot {
  productId: string;
  supplierSku: string;
  title: string;
  author: string;
  sourceUrl: string;
  quantity: number;
  observedSourceUnitPriceAmd: number;
}

export interface ProcurementTaskRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  status: ProcurementStatus;
  supplierName: 'Books.am';
  currency: 'AMD';
  supplierItemsSubtotalAmd: number;
  supplierDeliveryFeeAmd: number | null;
  supplierTotalAmd: number | null;
  items: ProcurementItemSnapshot[];
  supplierReference: string | null;
  operatorNote: string | null;
  confirmedAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
