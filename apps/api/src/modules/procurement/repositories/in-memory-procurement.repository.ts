import { Injectable } from '@nestjs/common';
import {
  PROCUREMENT_STATUSES,
  type ProcurementStatus,
  type ProcurementTaskRecord,
} from '../procurement.model';
import {
  ConcurrentProcurementModificationError,
  type ProcurementRepository,
} from './procurement.repository';

@Injectable()
export class InMemoryProcurementRepository implements ProcurementRepository {
  private readonly tasks = new Map<string, ProcurementTaskRecord>();
  private readonly taskIdsByOrderId = new Map<string, string>();

  async createForOrder(task: ProcurementTaskRecord): Promise<ProcurementTaskRecord> {
    const existingId = this.taskIdsByOrderId.get(task.orderId);
    if (existingId) {
      const existing = this.tasks.get(existingId);
      if (!existing) throw new Error('Procurement order index is inconsistent');
      return structuredClone(existing);
    }

    this.tasks.set(task.id, structuredClone(task));
    this.taskIdsByOrderId.set(task.orderId, task.id);
    return structuredClone(task);
  }

  async findById(id: string): Promise<ProcurementTaskRecord | null> {
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : null;
  }

  async findByOrderId(orderId: string): Promise<ProcurementTaskRecord | null> {
    const id = this.taskIdsByOrderId.get(orderId);
    if (!id) return null;
    const task = this.tasks.get(id);
    return task ? structuredClone(task) : null;
  }

  async list(): Promise<ProcurementTaskRecord[]> {
    return [...this.tasks.values()]
      .sort(
        (left, right) =>
          right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id),
      )
      .map((task) => structuredClone(task));
  }

  async save(
    task: ProcurementTaskRecord,
    expectedUpdatedAt?: string,
  ): Promise<ProcurementTaskRecord> {
    return this.prepareSave(task, expectedUpdatedAt)();
  }

  // Used by the in-memory unit of work; commit runs only after both records validate.
  prepareSave(
    task: ProcurementTaskRecord,
    expectedUpdatedAt?: string,
  ): () => ProcurementTaskRecord {
    const previous = this.tasks.get(task.id);
    if (!previous) throw new Error('Cannot save an unknown procurement task');
    if (expectedUpdatedAt && previous.updatedAt !== expectedUpdatedAt) {
      throw new ConcurrentProcurementModificationError(task.id);
    }
    const stored = structuredClone(task);
    const result = structuredClone(task);
    return () => {
      this.tasks.set(stored.id, stored);
      this.taskIdsByOrderId.set(stored.orderId, stored.id);
      return result;
    };
  }

  async countByStatus(): Promise<Record<ProcurementStatus, number>> {
    const counts = Object.fromEntries(
      PROCUREMENT_STATUSES.map((status) => [status, 0]),
    ) as Record<ProcurementStatus, number>;
    this.tasks.forEach((task) => {
      counts[task.status] += 1;
    });
    return counts;
  }
}
