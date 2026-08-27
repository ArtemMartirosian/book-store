import { Injectable } from '@nestjs/common';
import { BooksHtmlParserService } from './books-html-parser.service';
import { CrawlerFixtureService } from './crawler-fixture.service';
import { CrawlerKillSwitchService } from './crawler-kill-switch.service';
import { CrawlerPipelineService } from './crawler-pipeline.service';
import { CrawlerRequestBudgetService } from './crawler-request-budget.service';
import { CrawlerSitemapPolicyService } from './crawler-sitemap-policy.service';
import type { CrawlerFixtureName } from './crawler.types';
import { CrawlerUrlPolicyService } from './crawler-url-policy.service';

@Injectable()
export class CrawlerService {
  constructor(
    private readonly policy: CrawlerUrlPolicyService,
    private readonly parser: BooksHtmlParserService,
    private readonly fixtures: CrawlerFixtureService,
    private readonly killSwitch: CrawlerKillSwitchService,
    private readonly pipeline: CrawlerPipelineService,
    private readonly budget: CrawlerRequestBudgetService,
    private readonly sitemapPolicy: CrawlerSitemapPolicyService,
  ) {}

  getStatus() {
    const gate = this.policy.getLiveGateStatus();
    return {
      mode: gate.allowed ? 'PERMISSION_GATED_HTML' : 'FIXTURE_ONLY',
      liveRunAllowed: gate.allowed && !this.killSwitch.getState().engaged,
      gate,
      networkFetcherImplemented: true,
      sitemapTargets: this.sitemapPolicy.listAllowed(),
      budget: this.budget.getState(),
      snapshotRepository: 'IN_MEMORY_PROCESS_LOCAL',
      productQueue: this.pipeline.getProductQueueStatus(),
      killSwitch: this.killSwitch.getState(),
      safetyNotice:
        'No request-on-view and no account, checkout, CAPTCHA, Cloudflare or hidden-endpoint automation.',
    };
  }

  evaluateUrl(url: string) {
    return this.policy.evaluate(url);
  }

  async parseFixture(name: CrawlerFixtureName) {
    const fixture = await this.fixtures.load(name);
    const decision = this.policy.evaluate(fixture.sourceUrl);
    if (!decision.eligible || !decision.normalizedUrl) {
      throw new Error(`Bundled fixture URL violates policy: ${decision.reason}`);
    }
    const parsed = this.parser.parse(fixture.html, decision.normalizedUrl);
    const canonicalDecision = this.policy.evaluate(parsed.canonicalUrl);
    if (!canonicalDecision.eligible || !canonicalDecision.normalizedUrl) {
      throw new Error(`Fixture canonical URL violates policy: ${canonicalDecision.reason}`);
    }
    return { ...parsed, canonicalUrl: canonicalDecision.normalizedUrl };
  }

  observeUpstreamStatus(status: number, sourceUrl: string) {
    return this.killSwitch.observeHttpStatus(status, sourceUrl);
  }

  resume(reason: string) {
    return this.killSwitch.reset(reason);
  }

  assertLiveRunAllowed(): void {
    this.killSwitch.assertOperational();
    this.policy.assertLiveModeConfigured();
  }

  getDryRunPlan() {
    return this.pipeline.getDryRunPlan();
  }

  runOnce() {
    return this.pipeline.runOnce();
  }

  listObservations() {
    return this.pipeline.listObservations();
  }
}
