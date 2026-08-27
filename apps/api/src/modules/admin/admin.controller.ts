import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import {
  EvaluateCrawlerUrlDto,
  ObserveUpstreamStatusDto,
  ParseCrawlerFixtureDto,
  ResumeCrawlerDto,
} from '../crawler/dto/crawler-admin.dto';
import { CrawlerService } from '../crawler/crawler.service';
import {
  CollectCashDto,
  ReconcileCashDto,
  RefuseCashDto,
} from '../orders/dto/cash-commands.dto';
import { OrdersService } from '../orders/orders.service';
import { TransitionProcurementDto } from '../procurement/dto/transition-procurement.dto';
import { ProcurementService } from '../procurement/procurement.service';
import { AdminProcurementWorkflowService } from './admin-procurement-workflow.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@ApiTags('admin')
@ApiSecurity('admin-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly orders: OrdersService,
    private readonly crawler: CrawlerService,
    private readonly procurement: ProcurementService,
    private readonly procurementWorkflow: AdminProcurementWorkflowService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Return operational counters and crawler safety state' })
  async dashboard() {
    return {
      generatedAt: new Date().toISOString(),
      ordersByStatus: await this.orders.countByStatus(),
      procurementsByStatus: await this.procurement.countByStatus(),
      crawler: this.crawler.getStatus(),
      persistence: 'IN_MEMORY_DEVELOPMENT_ADAPTER',
    };
  }

  @Get('orders')
  @ApiOperation({ summary: 'List orders with procurement details for operators' })
  listOrders() {
    return this.orders.listForAdmin();
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Get one order with internal procurement details' })
  getOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.orders.getForAdmin(id);
  }

  @Patch('orders/:id/status')
  @ApiOperation({ summary: 'Apply a validated order state transition' })
  updateOrderStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateOrderStatusDto,
  ) {
    return this.orders.transition(id, input.status);
  }

  @Post('orders/:id/cash/collect')
  @ApiOperation({ summary: 'Record COD cash collection and fiscal receipt number' })
  collectCash(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: CollectCashDto,
  ) {
    return this.orders.collectCash(id, input);
  }

  @Post('orders/:id/cash/reconcile')
  @ApiOperation({ summary: 'Reconcile previously collected COD cash' })
  reconcileCash(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: ReconcileCashDto,
  ) {
    return this.orders.reconcileCash(id, input);
  }

  @Post('orders/:id/cash/refuse')
  @ApiOperation({ summary: 'Record customer COD refusal and close the delivery attempt' })
  refuseCash(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: RefuseCashDto,
  ) {
    return this.orders.refuseCash(id, input);
  }

  @Get('procurements')
  @ApiOperation({ summary: 'List the manual procurement operator queue' })
  listProcurements() {
    return this.procurement.list();
  }

  @Get('procurements/:id')
  @ApiOperation({ summary: 'Get a procurement task with immutable supplier snapshots' })
  getProcurement(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.procurement.get(id);
  }

  @Post('procurements/:id/transition')
  @ApiOperation({
    summary: 'Record a manual procurement outcome; performs no supplier request or click',
  })
  transitionProcurement(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: TransitionProcurementDto,
  ) {
    return this.procurementWorkflow.transition(id, input);
  }

  @Get('crawler/status')
  @ApiOperation({ summary: 'Show crawler mode, permission gate and kill-switch state' })
  crawlerStatus() {
    return this.crawler.getStatus();
  }

  @Post('crawler/evaluate-url')
  @ApiOperation({ summary: 'Evaluate a URL without fetching it' })
  evaluateCrawlerUrl(@Body() input: EvaluateCrawlerUrlDto) {
    return this.crawler.evaluateUrl(input.url);
  }

  @Post('crawler/parse-fixture')
  @ApiOperation({ summary: 'Parse a bundled static fixture; performs no network request' })
  parseCrawlerFixture(@Body() input: ParseCrawlerFixtureDto) {
    return this.crawler.parseFixture(input.fixture);
  }

  @Post('crawler/observe-status')
  @ApiOperation({ summary: 'Record an upstream status; 403/429 latch the kill switch' })
  observeCrawlerStatus(@Body() input: ObserveUpstreamStatusDto) {
    const eligibility = this.crawler.evaluateUrl(input.sourceUrl);
    if (!eligibility.eligible || !eligibility.normalizedUrl) return eligibility;
    return this.crawler.observeUpstreamStatus(input.status, eligibility.normalizedUrl);
  }

  @Post('crawler/resume')
  @ApiOperation({ summary: 'Explicitly reset the crawler kill switch after operator review' })
  resumeCrawler(@Body() input: ResumeCrawlerDto) {
    return this.crawler.resume(input.reason);
  }
}
