import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { OrderRecord } from '../orders/order.model';
import type { TransitionProcurementDto } from './dto/transition-procurement.dto';
import type {
  ProcurementStatus,
  ProcurementTaskRecord,
} from './procurement.model';
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
    const now = new Date().toISOString();
    return this.repository.createForOrder({
      id: randomUUID(),
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

  async transition(
    id: string,
    input: TransitionProcurementDto,
  ): Promise<ProcurementTaskRecord> {
    const task = await this.get(id);
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

    const transitionedAt = new Date().toISOString();
    return this.repository.save({
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
    });
  }

  countByStatus(): Promise<Record<ProcurementStatus, number>> {
    return this.repository.countByStatus();
  }
}
