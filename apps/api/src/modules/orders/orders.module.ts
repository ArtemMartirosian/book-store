import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CatalogModule } from '../catalog/catalog.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { InMemoryProcurementRepository } from '../procurement/repositories/in-memory-procurement.repository';
import { PROCUREMENT_REPOSITORY, type ProcurementRepository } from '../procurement/repositories/procurement.repository';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { InMemoryOrderRepository } from './repositories/in-memory-order.repository';
import { ORDER_REPOSITORY, type OrderRepository } from './repositories/order.repository';
import { PrismaOrderRepository } from './repositories/prisma-order.repository';
import { InMemoryOrderProcurementUnitOfWork } from './repositories/in-memory-order-procurement.unit-of-work';
import { ORDER_PROCUREMENT_UNIT_OF_WORK } from './repositories/order-procurement.unit-of-work';
import { PrismaOrderProcurementUnitOfWork } from './repositories/prisma-order-procurement.unit-of-work';

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
    {
      provide: ORDER_PROCUREMENT_UNIT_OF_WORK,
      inject: [PrismaService, ORDER_REPOSITORY, PROCUREMENT_REPOSITORY],
      useFactory: (
        prisma: PrismaService,
        orders: OrderRepository,
        procurement: ProcurementRepository,
      ) => {
        if (prisma.isPostgres) return new PrismaOrderProcurementUnitOfWork(prisma);
        if (!(orders instanceof InMemoryOrderRepository) ||
            !(procurement instanceof InMemoryProcurementRepository)) {
          throw new Error('Order and procurement persistence adapters must match');
        }
        return new InMemoryOrderProcurementUnitOfWork(orders, procurement);
      },
    },
  ],
  exports: [OrdersService, ORDER_REPOSITORY],
})
export class OrdersModule {}
