import type {
  ProcurementStatus,
  ProcurementTaskRecord,
} from '../procurement.model';

export const PROCUREMENT_REPOSITORY = Symbol('PROCUREMENT_REPOSITORY');

export class ConcurrentProcurementModificationError extends Error {
  constructor(readonly taskId: string) {
    super(`Procurement task ${taskId} was modified by another request`);
    this.name = 'ConcurrentProcurementModificationError';
  }
}

export interface ProcurementRepository {
  createForOrder(task: ProcurementTaskRecord): Promise<ProcurementTaskRecord>;
  findById(id: string): Promise<ProcurementTaskRecord | null>;
  findByOrderId(orderId: string): Promise<ProcurementTaskRecord | null>;
  list(): Promise<ProcurementTaskRecord[]>;
  save(task: ProcurementTaskRecord, expectedUpdatedAt?: string): Promise<ProcurementTaskRecord>;
  countByStatus(): Promise<Record<ProcurementStatus, number>>;
}
