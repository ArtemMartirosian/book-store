import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CrawlerRequestBudgetState } from './crawler.types';

@Injectable()
export class CrawlerRequestBudgetService {
  private dateUtc = this.currentDateUtc();
  private used = 0;

  constructor(private readonly config: ConfigService) {}

  reserve(): CrawlerRequestBudgetState {
    this.rollDayIfNeeded();
    const limit = this.limit();
    if (limit < 1 || this.used >= limit) {
      throw new ServiceUnavailableException({
        code: 'CRAWLER_DAILY_BUDGET_EXHAUSTED',
        message: 'The process-local daily crawler request budget is exhausted.',
      });
    }
    this.used += 1;
    return this.getState();
  }

  getState(): CrawlerRequestBudgetState {
    this.rollDayIfNeeded();
    const limit = this.limit();
    return {
      dateUtc: this.dateUtc,
      limit,
      used: this.used,
      remaining: Math.max(limit - this.used, 0),
      persistence: 'IN_MEMORY_PROCESS_LOCAL',
    };
  }

  private limit(): number {
    return Math.max(
      Math.trunc(this.config.get<number>('CRAWLER_DAILY_REQUEST_BUDGET', 0)),
      0,
    );
  }

  private rollDayIfNeeded(): void {
    const today = this.currentDateUtc();
    if (today === this.dateUtc) return;
    this.dateUtc = today;
    this.used = 0;
  }

  private currentDateUtc(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
