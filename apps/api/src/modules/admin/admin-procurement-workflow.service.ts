import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import type { TransitionProcurementDto } from '../procurement/dto/transition-procurement.dto';

@Injectable()
export class AdminProcurementWorkflowService {
  constructor(
    private readonly orders: OrdersService,
  ) {}

  async transition(taskId: string, input: TransitionProcurementDto) {
    return this.orders.transitionProcurement(taskId, input);
  }
}
