import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import type { OrderStatus } from '../../orders/order.model';

export const OPERATOR_ORDER_STATUS_TARGETS = [
  'CUSTOMER_CONFIRMED',
  'PROCUREMENT_PENDING',
  'READY_FOR_DELIVERY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const satisfies readonly OrderStatus[];

type OperatorOrderStatusTarget = (typeof OPERATOR_ORDER_STATUS_TARGETS)[number];

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OPERATOR_ORDER_STATUS_TARGETS })
  @IsIn([...OPERATOR_ORDER_STATUS_TARGETS])
  status!: OperatorOrderStatusTarget;
}
