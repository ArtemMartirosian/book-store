import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FixtureWorkerService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(FixtureWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private killed = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('WORKER_ENABLED', false)) {
      this.logger.warn('Worker is disabled; no API dispatch will be performed');
      return;
    }

    const interval = this.config.get<number>('POLL_INTERVAL_MS', 300_000);
    const mode = this.config.get<string>('WORKER_MODE', 'FIXTURE_ONLY');
    this.logger.log(`Starting ${mode} worker with ${interval} ms interval`);
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), interval);
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async runOnce(): Promise<void> {
    if (this.running || this.killed) return;
    this.running = true;

    const timeoutMs = this.config.get<number>('REQUEST_TIMEOUT_MS', 10_000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const baseUrl = this.config.get<string>('API_BASE_URL', 'http://localhost:4000/api/v1');
      const mode = this.config.get<string>('WORKER_MODE', 'FIXTURE_ONLY');
      const liveMode = mode === 'PERMISSION_GATED_HTML';
      const endpoint = liveMode ? 'run-once' : 'parse-fixture';
      const response = await fetch(`${baseUrl}/admin/crawler/${endpoint}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-api-key': this.config.get<string>(
            'ADMIN_API_KEY',
            'development-admin-api-key-change-me',
          ),
        },
        body: liveMode
          ? undefined
          : JSON.stringify({
              fixture: this.config.get<string>('CRAWLER_FIXTURE_NAME', 'book-detail'),
            }),
        signal: controller.signal,
      });

      if (response.status === 403 || response.status === 429 || response.status === 503) {
        this.killed = true;
        this.logger.error(
          `Worker kill switch latched after API HTTP ${response.status}; restart only after operator review`,
        );
        return;
      }
      if (!response.ok) {
        this.logger.error(`Fixture parse failed with API HTTP ${response.status}`);
        return;
      }

      const result = (await response.json()) as {
        supplierSku?: string;
        quarantineReason?: string | null;
        normalized?: number;
        quarantined?: number;
      };
      if (liveMode) {
        this.logger.log(
          `Crawler run completed normalized=${result.normalized ?? 0} quarantined=${result.quarantined ?? 0}`,
        );
      } else {
        this.logger.log(
          `Parsed fixture SKU=${result.supplierSku ?? 'unknown'} quarantine=${result.quarantineReason ?? 'none'}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown worker failure';
      this.logger.error(`Fixture parse dispatch failed: ${message}`);
    } finally {
      clearTimeout(timeout);
      this.running = false;
    }
  }
}
