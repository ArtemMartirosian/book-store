import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InMemoryOrderRepository } from './repositories/in-memory-order.repository';
import { ORDER_REPOSITORY } from './repositories/order.repository';
import { PrismaOrderRepository } from './repositories/prisma-order.repository';

@Module({
  imports: [CatalogModule, PricingModule, ProcurementModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    {
      provide: ORDER_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_ADAPTER') === 'POSTGRES'
          ? new PrismaOrderRepository(prisma)
          : new InMemoryOrderRepository(),
    },
  ],
  exports: [OrdersService, ORDER_REPOSITORY],
})
export class OrdersModule {}
