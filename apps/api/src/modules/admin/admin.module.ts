import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { CrawlerModule } from '../crawler/crawler.module';
import { OrdersModule } from '../orders/orders.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { AdminController } from './admin.controller';
import { AdminCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
import { AdminProcurementWorkflowService } from './admin-procurement-workflow.service';

@Module({
  imports: [OrdersModule, CrawlerModule, ProcurementModule],
  controllers: [AdminController, AdminCatalogController, AdminCategoriesController],
  providers: [
    AdminApiKeyGuard,
    AdminProcurementWorkflowService,
    AdminCatalogService,
    AdminCategoriesService,
  ],
})
export class AdminModule {}
