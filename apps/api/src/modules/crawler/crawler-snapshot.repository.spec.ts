import { InMemoryCrawlerSnapshotRepository } from './crawler-snapshot.repository';
import type { CrawlerObservation } from './crawler.types';
import { randomUUID } from 'node:crypto';

const observation = (
  outcome: CrawlerObservation['outcome'],
  etag: string,
): CrawlerObservation => ({
  id: randomUUID(),
  sourceUrl: 'https://www.books.am/am/example.html',
  canonicalUrl: null,
  outcome,
  snapshot: null,
  quarantineReasons: outcome === 'QUARANTINED' ? ['PARSER_CONFLICT'] : [],
  warnings: [],
  observedAt: '2026-08-15T00:00:00.000Z',
  response: {
    status: 200,
    contentType: 'text/html',
    etag,
    lastModified: null,
  },
});

describe('InMemoryCrawlerSnapshotRepository', () => {
  it('does not commit conditional headers from a quarantined body', async () => {
    const repository = new InMemoryCrawlerSnapshotRepository();
    await repository.save(observation('QUARANTINED', '"bad-parser-result"'));

    await expect(
      repository.findConditionalHeaders('https://www.books.am/am/example.html'),
    ).resolves.toEqual({ etag: null, lastModified: null });
  });

  it('preserves the last accepted validator when a later parse is quarantined', async () => {
    const repository = new InMemoryCrawlerSnapshotRepository();
    await repository.save(observation('NORMALIZED', '"accepted"'));
    await repository.save(observation('QUARANTINED', '"rejected"'));

    await expect(
      repository.findConditionalHeaders('https://www.books.am/am/example.html'),
    ).resolves.toEqual({ etag: '"accepted"', lastModified: null });
  });
});
