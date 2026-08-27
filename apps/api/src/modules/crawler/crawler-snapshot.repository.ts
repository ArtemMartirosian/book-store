import { Injectable } from '@nestjs/common';
import type {
  CrawlerConditionalHeaders,
  CrawlerObservation,
  CrawlerProductQueueState,
} from './crawler.types';

export abstract class CrawlerSnapshotRepository {
  abstract findConditionalHeaders(
    sourceUrl: string,
  ): Promise<CrawlerConditionalHeaders>;

  abstract save(observation: CrawlerObservation): Promise<void>;

  abstract saveConditionalHeaders(
    sourceUrl: string,
    headers: CrawlerConditionalHeaders,
  ): Promise<void>;

  abstract listRecent(limit: number): Promise<CrawlerObservation[]>;

  abstract enqueueProductUrls(
    sourceUrls: string[],
    capacity: number,
    discoveredAt: string,
  ): Promise<{ added: number; duplicates: number; droppedAtCapacity: number }>;

  abstract leaseProducts(
    limit: number,
    refreshIntervalMs: number,
    now: string,
  ): Promise<string[]>;

  abstract completeProductAttempt(sourceUrl: string, attemptedAt: string): Promise<void>;

  abstract releaseProductLeases(sourceUrls: string[]): Promise<void>;

  abstract getProductQueueState(
    refreshIntervalMs: number,
    now: string,
    capacity: number,
  ): CrawlerProductQueueState;
}

interface ProductQueueRecord {
  sourceUrl: string;
  discoveredAt: string;
  lastAttemptAt: string | null;
  state: 'PENDING' | 'LEASED' | 'KNOWN';
}

@Injectable()
export class InMemoryCrawlerSnapshotRepository extends CrawlerSnapshotRepository {
  private readonly observations: CrawlerObservation[] = [];
  private readonly conditionalHeaders = new Map<string, CrawlerConditionalHeaders>();
  private readonly products = new Map<string, ProductQueueRecord>();
  private queueCapacity = 0;

  async findConditionalHeaders(sourceUrl: string): Promise<CrawlerConditionalHeaders> {
    return structuredClone(
      this.conditionalHeaders.get(sourceUrl) ?? { etag: null, lastModified: null },
    );
  }

  async save(observation: CrawlerObservation): Promise<void> {
    const copy = structuredClone(observation);
    this.observations.unshift(copy);
    if (this.observations.length > 500) this.observations.length = 500;

    if (
      observation.outcome !== 'QUARANTINED' &&
      (observation.response.etag || observation.response.lastModified)
    ) {
      this.conditionalHeaders.set(observation.sourceUrl, {
        etag: observation.response.etag,
        lastModified: observation.response.lastModified,
      });
    }
  }

  async saveConditionalHeaders(
    sourceUrl: string,
    headers: CrawlerConditionalHeaders,
  ): Promise<void> {
    if (!headers.etag && !headers.lastModified) return;
    this.conditionalHeaders.set(sourceUrl, structuredClone(headers));
  }

  async listRecent(limit: number): Promise<CrawlerObservation[]> {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);
    return structuredClone(this.observations.slice(0, safeLimit));
  }

  async enqueueProductUrls(
    sourceUrls: string[],
    capacity: number,
    discoveredAt: string,
  ): Promise<{ added: number; duplicates: number; droppedAtCapacity: number }> {
    this.queueCapacity = Math.max(Math.trunc(capacity), 0);
    let added = 0;
    let duplicates = 0;
    let droppedAtCapacity = 0;
    for (const sourceUrl of sourceUrls) {
      if (this.products.has(sourceUrl)) {
        duplicates += 1;
        continue;
      }
      if (this.products.size >= this.queueCapacity) {
        droppedAtCapacity += 1;
        continue;
      }
      this.products.set(sourceUrl, {
        sourceUrl,
        discoveredAt,
        lastAttemptAt: null,
        state: 'PENDING',
      });
      added += 1;
    }
    return { added, duplicates, droppedAtCapacity };
  }

  async leaseProducts(
    limit: number,
    refreshIntervalMs: number,
    now: string,
  ): Promise<string[]> {
    const safeLimit = Math.max(Math.trunc(limit), 0);
    if (safeLimit === 0) return [];
    const nowMs = Date.parse(now);
    const dueBefore = nowMs - Math.max(Math.trunc(refreshIntervalMs), 0);
    const pending = [...this.products.values()].filter(
      (record) => record.state === 'PENDING',
    );
    const due = [...this.products.values()]
      .filter(
        (record) =>
          record.state === 'KNOWN' &&
          record.lastAttemptAt !== null &&
          Date.parse(record.lastAttemptAt) <= dueBefore,
      )
      .sort(
        (left, right) =>
          Date.parse(left.lastAttemptAt ?? left.discoveredAt) -
          Date.parse(right.lastAttemptAt ?? right.discoveredAt),
      );
    const selected = [...pending, ...due].slice(0, safeLimit);
    for (const record of selected) record.state = 'LEASED';
    return selected.map(({ sourceUrl }) => sourceUrl);
  }

  async completeProductAttempt(sourceUrl: string, attemptedAt: string): Promise<void> {
    const record = this.products.get(sourceUrl);
    if (!record) return;
    record.lastAttemptAt = attemptedAt;
    record.state = 'KNOWN';
  }

  async releaseProductLeases(sourceUrls: string[]): Promise<void> {
    for (const sourceUrl of sourceUrls) {
      const record = this.products.get(sourceUrl);
      if (!record || record.state !== 'LEASED') continue;
      record.state = record.lastAttemptAt ? 'KNOWN' : 'PENDING';
    }
  }

  getProductQueueState(
    refreshIntervalMs: number,
    now: string,
    capacity: number,
  ): CrawlerProductQueueState {
    const nowMs = Date.parse(now);
    const dueBefore = nowMs - Math.max(Math.trunc(refreshIntervalMs), 0);
    const records = [...this.products.values()];
    return {
      known: records.length,
      pending: records.filter((record) => record.state === 'PENDING').length,
      leased: records.filter((record) => record.state === 'LEASED').length,
      refreshDue: records.filter(
        (record) =>
          record.state === 'KNOWN' &&
          record.lastAttemptAt !== null &&
          Date.parse(record.lastAttemptAt) <= dueBefore,
      ).length,
      capacity: Math.max(this.queueCapacity, Math.trunc(capacity)),
      persistence: 'IN_MEMORY_PROCESS_LOCAL',
    };
  }
}
