import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import type { TransitionProcurementDto } from '../procurement/dto/transition-procurement.dto';
import { ProcurementService } from '../procurement/procurement.service';

@Injectable()
export class AdminProcurementWorkflowService {
  constructor(
    private readonly orders: OrdersService,
    private readonly procurement: ProcurementService,
  ) {}

  async transition(taskId: string, input: TransitionProcurementDto) {
    const currentTask = await this.procurement.get(taskId);
    await this.orders.assertProcurementOutcomeAllowed(currentTask.orderId, input.status);

    const task = await this.procurement.transition(taskId, input);
    const order = await this.orders.applyProcurementOutcome(task.orderId, task.status);
    return { task, order };
  }
}
