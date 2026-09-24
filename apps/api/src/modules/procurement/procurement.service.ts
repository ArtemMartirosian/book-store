import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderRecord } from '../orders/order.model';
import type { TransitionProcurementDto } from './dto/transition-procurement.dto';
import type {
  ProcurementStatus,
  ProcurementTaskRecord,
} from './procurement.model';
import { createProcurementTaskForOrder } from './procurement-task.factory';
import {
  PROCUREMENT_REPOSITORY,
  type ProcurementRepository,
} from './repositories/procurement.repository';

@Injectable()
export class ProcurementService {
  constructor(
    @Inject(PROCUREMENT_REPOSITORY)
    private readonly repository: ProcurementRepository,
  ) {}

  async ensureForOrder(order: OrderRecord): Promise<ProcurementTaskRecord> {
    return this.repository.createForOrder(createProcurementTaskForOrder(order));
  }

  async list(): Promise<ProcurementTaskRecord[]> {
    return this.repository.list();
  }

  async get(id: string): Promise<ProcurementTaskRecord> {
    const task = await this.repository.findById(id);
    if (!task) throw new NotFoundException('Procurement task not found');
    return task;
  }

  async getByOrderId(orderId: string): Promise<ProcurementTaskRecord> {
    const task = await this.repository.findByOrderId(orderId);
    if (!task) throw new NotFoundException('Procurement task not found');
    return task;
  }

  prepareTransition(
    task: ProcurementTaskRecord,
    input: TransitionProcurementDto,
  ): ProcurementTaskRecord {
    const suppliedReference = input.supplierReference?.trim() || null;
    const note = input.note?.trim() || null;
    if (input.status === 'SUPPLIER_CONFIRMED' && !suppliedReference) {
      throw new ConflictException({
        code: 'SUPPLIER_REFERENCE_REQUIRED',
        message: 'A manual supplier reference is required for confirmation',
      });
    }
    if (
      (input.status === 'SOURCE_UNAVAILABLE' || input.status === 'CANCELLED') &&
      !note
    ) {
      throw new ConflictException({
        code: 'PROCUREMENT_NOTE_REQUIRED',
        message: 'An operator note is required for this outcome',
      });
    }
    if (task.status === input.status) {
      const replayReference =
        task.status === 'CANCELLED' && task.confirmedAt && !suppliedReference
          ? task.supplierReference
          : suppliedReference;
      if (task.supplierReference === replayReference && task.operatorNote === note) return task;
      throw new ConflictException({
        code: 'PROCUREMENT_EVIDENCE_CONFLICT',
        message: 'This procurement outcome was already recorded with different evidence',
        status: task.status,
      });
    }
    const cancellingConfirmedTask =
      task.status === 'SUPPLIER_CONFIRMED' && input.status === 'CANCELLED';
    if (
      task.status !== 'PENDING_OPERATOR' &&
      !cancellingConfirmedTask
    ) {
      throw new ConflictException({
        code: 'INVALID_PROCUREMENT_TRANSITION',
        from: task.status,
        to: input.status,
      });
    }

    const supplierReference = suppliedReference ?? task.supplierReference;

    const transitionedAt = this.nextTimestamp(task.updatedAt);
    return {
      ...task,
      status: input.status,
      supplierReference,
      operatorNote: note,
      confirmedAt:
        input.status === 'SUPPLIER_CONFIRMED'
          ? (task.confirmedAt ?? transitionedAt)
          : task.confirmedAt,
      resolvedAt: input.status === 'SUPPLIER_CONFIRMED' ? null : transitionedAt,
      updatedAt: transitionedAt,
    };
  }

  countByStatus(): Promise<Record<ProcurementStatus, number>> {
    return this.repository.countByStatus();
  }

  private nextTimestamp(previous: string): string {
    return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
  }
}
