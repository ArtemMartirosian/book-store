import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InMemoryOrderRepository } from './repositories/in-memory-order.repository';
import { ORDER_REPOSITORY } from './repositories/order.repository';

@Module({
  imports: [CatalogModule, PricingModule, ProcurementModule],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: ORDER_REPOSITORY, useClass: InMemoryOrderRepository }],
  exports: [OrdersService, ORDER_REPOSITORY],
})
export class OrdersModule {}
