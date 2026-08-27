import { Module } from '@nestjs/common';
import { ProcurementService } from './procurement.service';
import { InMemoryProcurementRepository } from './repositories/in-memory-procurement.repository';
import { PROCUREMENT_REPOSITORY } from './repositories/procurement.repository';

@Module({
  providers: [
    ProcurementService,
    { provide: PROCUREMENT_REPOSITORY, useClass: InMemoryProcurementRepository },
  ],
  exports: [ProcurementService, PROCUREMENT_REPOSITORY],
})
export class ProcurementModule {}
