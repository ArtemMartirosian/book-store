import type {
  ProcurementStatus,
  ProcurementTaskRecord,
} from '../procurement.model';

export const PROCUREMENT_REPOSITORY = Symbol('PROCUREMENT_REPOSITORY');

export interface ProcurementRepository {
  createForOrder(task: ProcurementTaskRecord): Promise<ProcurementTaskRecord>;
  findById(id: string): Promise<ProcurementTaskRecord | null>;
  findByOrderId(orderId: string): Promise<ProcurementTaskRecord | null>;
  list(): Promise<ProcurementTaskRecord[]>;
  save(task: ProcurementTaskRecord): Promise<ProcurementTaskRecord>;
  countByStatus(): Promise<Record<ProcurementStatus, number>>;
}
