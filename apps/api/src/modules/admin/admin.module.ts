import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { CrawlerModule } from '../crawler/crawler.module';
import { OrdersModule } from '../orders/orders.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { AdminController } from './admin.controller';
import { AdminProcurementWorkflowService } from './admin-procurement-workflow.service';

@Module({
  imports: [OrdersModule, CrawlerModule, ProcurementModule],
  controllers: [AdminController],
  providers: [AdminApiKeyGuard, AdminProcurementWorkflowService],
})
export class AdminModule {}
