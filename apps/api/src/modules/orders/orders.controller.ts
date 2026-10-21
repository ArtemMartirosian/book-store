import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { CustomerAuthService } from '../customer-auth/customer-auth.service';
import { ApiCreatedResponse, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService, private readonly auth: CustomerAuthService) {}

  @Post()
  @ApiOperation({ summary: 'Create a Yerevan cash-on-delivery purchase request' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Unique 8-128 character key; retries with the same payload return the same order',
  })
  @ApiCreatedResponse({ description: 'Purchase request accepted for operator confirmation' })
  async create(
    @Body() input: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: FastifyRequest,
  ) {
    const customer = await this.auth.identity(request);
    if (customer) this.auth.assertMutation(request);
    return this.orders.create(input, idempotencyKey, customer?.id);
  }
}
