import { Injectable } from '@nestjs/common';
import { Prisma, type CrawlerCheckpoint } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CrawlerBrowserRunState,
  CrawlerBrowserRunStatus,
} from './crawler.types';

const CHECKPOINT_ID = 'books-am-full-catalog';

export interface CrawlerCheckpointSnapshot {
  state: CrawlerBrowserRunState;
  catalogSegments: string[];
  completedCatalogSegments: string[];
}

const toDate = (value: string | null): Date | null =>
  value ? new Date(value) : null;

const parseErrors = (
  value: Prisma.JsonValue,
): Array<{ sourceUrl: string; code: string }> => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      typeof item === 'object' &&
      item !== null &&
      !Array.isArray(item) &&
      typeof item.sourceUrl === 'string' &&
      typeof item.code === 'string'
    ) {
      return [{ sourceUrl: item.sourceUrl, code: item.code }];
    }
    return [];
  });
};

const parseStrings = (value: Prisma.JsonValue): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const hydrate = (row: CrawlerCheckpoint): CrawlerCheckpointSnapshot => ({
  state: {
    status: row.status as CrawlerBrowserRunStatus,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    currentUrl: row.currentUrl,
    resumeCatalogUrl: row.resumeCatalogUrl,
    catalogPagesVisited: row.catalogPagesVisited,
    discoveredProducts: row.discoveredProducts,
    productsAttempted: row.productsAttempted,
    imported: row.imported,
    quarantined: row.quarantined,
    failedProducts: row.failedProducts,
    navigationRetries: row.navigationRetries,
    productsSkipped: row.productsSkipped,
    catalogSegmentsDiscovered: row.catalogSegmentsDiscovered,
    catalogSegmentsCompleted: row.catalogSegmentsCompleted,
    activeCatalogSegment: row.activeCatalogSegment,
    finishReason: row.finishReason,
    errors: parseErrors(row.errors),
  },
  catalogSegments: parseStrings(row.catalogSegments),
  completedCatalogSegments: parseStrings(row.completedCatalogSegments),
});

@Injectable()
export class CrawlerCheckpointRepository {
  private memory: CrawlerCheckpointSnapshot | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async load(): Promise<CrawlerCheckpointSnapshot | null> {
    if (!this.prisma.isPostgres) return this.memory ? structuredClone(this.memory) : null;
    const row = await this.prisma.crawlerCheckpoint.findUnique({
      where: { id: CHECKPOINT_ID },
    });
    return row ? hydrate(row) : null;
  }

  async save(
    state: CrawlerBrowserRunState,
    catalogSegments: string[],
    completedCatalogSegments: string[],
  ): Promise<void> {
    if (!this.prisma.isPostgres) {
      this.memory = structuredClone({
        state,
        catalogSegments,
        completedCatalogSegments,
      });
      return;
    }
    const data = {
      status: state.status,
      startedAt: toDate(state.startedAt),
      completedAt: toDate(state.completedAt),
      currentUrl: state.currentUrl,
      resumeCatalogUrl: state.resumeCatalogUrl,
      catalogPagesVisited: state.catalogPagesVisited,
      discoveredProducts: state.discoveredProducts,
      productsAttempted: state.productsAttempted,
      imported: state.imported,
      quarantined: state.quarantined,
      failedProducts: state.failedProducts,
      navigationRetries: state.navigationRetries,
      productsSkipped: state.productsSkipped,
      catalogSegmentsDiscovered: state.catalogSegmentsDiscovered,
      catalogSegmentsCompleted: state.catalogSegmentsCompleted,
      activeCatalogSegment: state.activeCatalogSegment,
      catalogSegments: catalogSegments as Prisma.InputJsonValue,
      completedCatalogSegments: completedCatalogSegments as Prisma.InputJsonValue,
      finishReason: state.finishReason,
      errors: state.errors as Prisma.InputJsonValue,
    };
    await this.prisma.crawlerCheckpoint.upsert({
      where: { id: CHECKPOINT_ID },
      create: { id: CHECKPOINT_ID, ...data },
      update: data,
    });
  }
}
