export const ORDER_STATUSES = [
  'REQUEST_RECEIVED',
  'CUSTOMER_CONFIRMED',
  'PROCUREMENT_PENDING',
  'SUPPLIER_CONFIRMED',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CUSTOMER_REFUSED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const YEREVAN_DISTRICTS = [
  'KENTRON',
  'ARABKIR',
  'KANAKER_ZEYTUN',
  'NOR_NORK',
  'AVAN',
  'EREBUNI',
  'SHENGAVIT',
  'DAVTASHEN',
  'AJAPNYAK',
  'MALATIA_SEBASTIA',
  'NUBARASHEN',
  'NORK_MARASH',
] as const;

export type YerevanDistrict = (typeof YEREVAN_DISTRICTS)[number];

export const CASH_STATUSES = [
  'CASH_DUE',
  'CASH_COLLECTED',
  'CASH_RECONCILED',
  'CASH_REFUSED',
] as const;

export type CashStatus = (typeof CASH_STATUSES)[number];

export interface OrderItemSnapshot {
  productId: string;
  supplierSku: string;
  title: string;
  author: string;
  sourceUrl: string;
  quantity: number;
  sourceUnitPriceAmd: number;
  customerUnitPriceAmd: number;
  customerSubtotalAmd: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  idempotencyKey: string;
  requestHash: string;
  status: OrderStatus;
  locale: 'hy' | 'ru' | 'en';
  customer: {
    fullName: string;
    phone: string;
    email: string | null;
  };
  delivery: {
    city: 'YEREVAN';
    district: YerevanDistrict;
    addressLine: string;
    apartment: string | null;
    entrance: string | null;
    floor: string | null;
    notes: string | null;
  };
  paymentMethod: 'CASH_ON_DELIVERY';
  cod: {
    dueAmd: number;
    status: CashStatus;
    collectedAt: string | null;
    reconciledAt: string | null;
    fiscalReceiptNumber: string | null;
    reconciliationReference: string | null;
    refusalReason: string | null;
  };
  currency: 'AMD';
  items: OrderItemSnapshot[];
  itemsSubtotalAmd: number;
  deliveryFeeAmd: number;
  totalAmd: number;
  projectedMarginAmd: number;
  customerConfirmationRequired: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PublicOrderItem = Omit<
  OrderItemSnapshot,
  'sourceUnitPriceAmd' | 'sourceUrl' | 'supplierSku'
>;

export type PublicOrder = Omit<
  OrderRecord,
  'projectedMarginAmd' | 'items' | 'idempotencyKey' | 'requestHash'
> & {
  items: PublicOrderItem[];
  notice: string;
};
