import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ProcurementService } from './procurement.service';
import { InMemoryProcurementRepository } from './repositories/in-memory-procurement.repository';
import { PROCUREMENT_REPOSITORY } from './repositories/procurement.repository';
import { PrismaProcurementRepository } from './repositories/prisma-procurement.repository';

@Module({
  providers: [
    ProcurementService,
    {
      provide: PROCUREMENT_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_ADAPTER') === 'POSTGRES'
          ? new PrismaProcurementRepository(prisma)
          : new InMemoryProcurementRepository(),
    },
  ],
  exports: [ProcurementService, PROCUREMENT_REPOSITORY],
})
export class ProcurementModule {}
