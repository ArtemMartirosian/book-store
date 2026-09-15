import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PricingModule } from '../pricing/pricing.module';
import { CatalogController } from './catalog.controller';
import { CatalogCategoriesController } from './catalog-categories.controller';
import { CatalogService } from './catalog.service';
import { CATALOG_REPOSITORY } from './repositories/catalog.repository';
import { InMemoryCatalogRepository } from './repositories/in-memory-catalog.repository';
import { PrismaCatalogRepository } from './repositories/prisma-catalog.repository';

@Module({
  imports: [PricingModule],
  controllers: [CatalogController, CatalogCategoriesController],
  providers: [
    CatalogService,
    {
      provide: CATALOG_REPOSITORY,
      inject: [ConfigService, PrismaService],
      useFactory: (config: ConfigService, prisma: PrismaService) =>
        config.get('PERSISTENCE_ADAPTER') === 'POSTGRES'
          ? new PrismaCatalogRepository(prisma)
          : new InMemoryCatalogRepository(),
    },
  ],
  exports: [CatalogService, CATALOG_REPOSITORY],
})
export class CatalogModule {}
