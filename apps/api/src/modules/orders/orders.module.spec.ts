import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from '../../database/database.module';
import { PrismaService } from '../../database/prisma.service';
import { ProcurementService } from '../procurement/procurement.service';
import { OrdersModule } from './orders.module';
import { OrdersService } from './orders.service';

describe('OrdersModule persistence wiring', () => {
  it('shares the same in-memory repositories with the atomic workflow', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ PERSISTENCE_ADAPTER: 'IN_MEMORY' })],
        }),
        DatabaseModule,
        OrdersModule,
      ],
    }).overrideProvider(PrismaService).useValue({ isPostgres: false }).compile();

    try {
      const orders = module.get(OrdersService);
      const procurement = module.get(ProcurementService);
      const created = await orders.create({
        locale: 'ru',
        items: [{ productId: '29f69fbb-569c-45df-9293-a7f8a31c3331', quantity: 1 }],
        expectedTotalAmd: 4200,
        expectedPricingRuleVersion: 'amd-fixed-v1',
        customer: { fullName: 'Test Customer', phone: '+37499123456' },
        delivery: { city: 'YEREVAN', district: 'KENTRON', addressLine: '10 Test Street' },
        paymentMethod: 'CASH_ON_DELIVERY',
        acceptsPreliminaryAvailability: true,
      }, 'di-test-order-001');
      await orders.transition(created.id, 'CANCELLED');
      await expect(orders.getForAdmin(created.id)).resolves.toMatchObject({ status: 'CANCELLED' });
      await expect(procurement.getByOrderId(created.id)).resolves.toMatchObject({ status: 'CANCELLED' });
    } finally {
      await module.close();
    }
  });
});
