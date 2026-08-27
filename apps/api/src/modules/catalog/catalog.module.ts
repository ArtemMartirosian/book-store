import { Module } from '@nestjs/common';
import { PricingModule } from '../pricing/pricing.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CATALOG_REPOSITORY } from './repositories/catalog.repository';
import { InMemoryCatalogRepository } from './repositories/in-memory-catalog.repository';

@Module({
  imports: [PricingModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    { provide: CATALOG_REPOSITORY, useClass: InMemoryCatalogRepository },
  ],
  exports: [CatalogService, CATALOG_REPOSITORY],
})
export class CatalogModule {}
