import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { CrawlerKillSwitchState } from './crawler.types';

@Injectable()
export class CrawlerKillSwitchService {
  private state: CrawlerKillSwitchState = {
    engaged: false,
    reason: null,
    sourceUrl: null,
    engagedAt: null,
    resetAt: null,
    resetReason: null,
  };

  observeHttpStatus(status: number, sourceUrl: string): CrawlerKillSwitchState {
    if (status === 403 || status === 429) {
      this.engage(`UPSTREAM_HTTP_${status}`, sourceUrl);
    }
    return this.getState();
  }

  observeChallenge(sourceUrl: string): CrawlerKillSwitchState {
    this.engage('UPSTREAM_CHALLENGE_DETECTED', sourceUrl);
    return this.getState();
  }

  assertOperational(): void {
    if (this.state.engaged) {
      throw new ServiceUnavailableException({
        code: 'CRAWLER_KILL_SWITCH_ENGAGED',
        reason: this.state.reason,
        engagedAt: this.state.engagedAt,
      });
    }
  }

  reset(reason: string): CrawlerKillSwitchState {
    this.state = {
      engaged: false,
      reason: null,
      sourceUrl: null,
      engagedAt: null,
      resetAt: new Date().toISOString(),
      resetReason: reason,
    };
    return this.getState();
  }

  getState(): CrawlerKillSwitchState {
    return structuredClone(this.state);
  }

  private engage(reason: string, sourceUrl: string): void {
    if (this.state.engaged) return;
    this.state = {
      engaged: true,
      reason,
      sourceUrl,
      engagedAt: new Date().toISOString(),
      resetAt: null,
      resetReason: null,
    };
  }
}
