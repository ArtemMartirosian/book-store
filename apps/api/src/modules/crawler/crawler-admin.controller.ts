import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { CrawlerService } from './crawler.service';

@ApiTags('admin-crawler')
@ApiSecurity('admin-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin/crawler')
export class CrawlerAdminController {
  constructor(private readonly crawler: CrawlerService) {}

  @Get('dry-run')
  @ApiOperation({
    summary: 'Return the exact live crawl plan and gate state without network requests',
  })
  dryRun() {
    return this.crawler.getDryRunPlan();
  }

  @Post('run-once')
  @ApiOperation({
    summary: 'Run one permission-gated crawl; rejected unless every live gate is open',
  })
  runOnce() {
    return this.crawler.runOnce();
  }

  @Post('browser-run')
  @ApiOperation({
    summary: 'Start a background Playwright crawl of every public catalog page and book',
  })
  startBrowserRun() {
    return this.crawler.startBrowserRun();
  }

  @Post('browser-run/stop')
  @ApiOperation({ summary: 'Request a graceful stop of the active Playwright crawl' })
  stopBrowserRun() {
    return this.crawler.stopBrowserRun();
  }

  @Get('observations')
  @ApiOperation({ summary: 'List recent process-local crawler observations' })
  listObservations() {
    return this.crawler.listObservations();
  }
}
