import { Module } from '@nestjs/common';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { CatalogModule } from '../catalog/catalog.module';
import { BooksHtmlParserService } from './books-html-parser.service';
import { CrawlerAdminController } from './crawler-admin.controller';
import { CrawlerBrowserService } from './crawler-browser.service';
import { CrawlerCatalogDiscoveryService } from './crawler-catalog-discovery.service';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import { CrawlerCheckpointRepository } from './crawler-checkpoint.repository';
import { CrawlerFixtureService } from './crawler-fixture.service';
import {
  CRAWLER_FETCH,
  CrawlerHttpFetcherService,
} from './crawler-http-fetcher.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerPipelineService } from './crawler-pipeline.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import { CrawlerService } from './crawler.service';
import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import {
  CrawlerSnapshotRepository,
  InMemoryCrawlerSnapshotRepository,
} from './crawler-snapshot.repository';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';
import { CrawlerXmlDiscoveryService } from './crawler-xml-discovery.service';

@Module({
  imports: [CatalogModule],
  controllers: [CrawlerAdminController],
  providers: [
    AdminApiKeyGuard,
    BooksHtmlParserService,
    CrawlerBrowserService,
    CrawlerCatalogDiscoveryService,
    CrawlerChallengeDetectorService,
    CrawlerCheckpointRepository,
    CrawlerFixtureService,
    CrawlerHttpFetcherService,
    CrawlerKillSwitchService,
    CrawlerPipelineService,
    CrawlerRequestBudgetService,
    CrawlerSitemapPolicyService,
    CrawlerUrlPolicyService,
    CrawlerXmlDiscoveryService,
    InMemoryCrawlerSnapshotRepository,
    {
      provide: CrawlerSnapshotRepository,
      useExisting: InMemoryCrawlerSnapshotRepository,
    },
    {
      provide: CRAWLER_FETCH,
      useValue: globalThis.fetch.bind(globalThis),
    },
    CrawlerService,
  ],
  exports: [CrawlerService, BooksHtmlParserService, CrawlerUrlPolicyService],
})
export class CrawlerModule {}
