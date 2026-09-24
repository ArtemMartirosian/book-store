import { PrismaService } from '../../../database/prisma.service';
import { ConcurrentProcurementModificationError } from '../../procurement/repositories/procurement.repository';
import { taskData } from '../../procurement/repositories/prisma-procurement.repository';
import { ConcurrentOrderModificationError } from './order.repository';
import { orderData } from './prisma-order.repository';
import {
  assertLinkedRecords,
  type OrderProcurementChange,
  type OrderProcurementPair,
  type OrderProcurementUnitOfWork,
} from './order-procurement.unit-of-work';

export class PrismaOrderProcurementUnitOfWork implements OrderProcurementUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async savePair(change: OrderProcurementChange): Promise<OrderProcurementPair> {
    assertLinkedRecords(change);
    const result = structuredClone({ order: change.order, task: change.task });
    const order = orderData(result.order);
    const task = taskData(result.task);

    await this.prisma.$transaction(async (transaction) => {
      // Always lock/update the order first, including cancellation, so competing
      // pair transitions use the same lock order. Both versions are checked.
      const savedOrder = await transaction.order.updateMany({
        where: {
          id: order.id,
          updatedAt: new Date(change.expectedOrderUpdatedAt),
        },
        data: order,
      });
      if (savedOrder.count !== 1) throw new ConcurrentOrderModificationError(order.id);

      const savedTask = await transaction.procurementTask.updateMany({
        where: {
          id: task.id,
          orderId: order.id,
          updatedAt: new Date(change.expectedTaskUpdatedAt),
        },
        data: task,
      });
      if (savedTask.count !== 1) throw new ConcurrentProcurementModificationError(task.id);
      // A failure above aborts this database transaction; no compensating writes.
    });
    return result;
  }
}
