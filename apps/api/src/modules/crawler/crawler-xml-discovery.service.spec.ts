import { BadRequestException } from '@nestjs/common';
import { CrawlerXmlDiscoveryService } from './crawler-xml-discovery.service';

const chunks = async function* (...values: string[]): AsyncIterable<Uint8Array> {
  const encoder = new TextEncoder();
  for (const value of values) yield encoder.encode(value);
};

describe('CrawlerXmlDiscoveryService', () => {
  const discovery = new CrawlerXmlDiscoveryService();

  it('discovers loc values across chunk boundaries without buffering the response first', async () => {
    const result = await discovery.discover(
      chunks(
        '<?xml version="1.0"?><urlset><url><lo',
        'c>https://www.books.am/am/one.html?x=1&amp;y=2</loc></url>',
        '<url><loc>https://www.books.am/am/two.html</loc></url></urlset>',
      ),
      { maxBytes: 10_000, maxUrls: 10 },
    );

    expect(result.urls).toEqual([
      'https://www.books.am/am/one.html?x=1&y=2',
      'https://www.books.am/am/two.html',
    ]);
    expect(result.truncated).toBe(false);
  });

  it('stops at the configured URL limit', async () => {
    const result = await discovery.discover(
      chunks('<urlset><loc>https://a.invalid/1</loc><loc>https://a.invalid/2</loc></urlset>'),
      { maxBytes: 10_000, maxUrls: 1 },
    );
    expect(result.urls).toEqual(['https://a.invalid/1']);
    expect(result.truncated).toBe(true);
  });

  it('rejects XML that exceeds the byte budget', async () => {
    await expect(
      discovery.discover(chunks('<urlset>too large</urlset>'), {
        maxBytes: 5,
        maxUrls: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('flags a challenge document even when upstream labels it as XML', async () => {
    const result = await discovery.discover(
      chunks('<html><title>Just a moment...</title></html>'),
      { maxBytes: 10_000, maxUrls: 10 },
    );
    expect(result).toMatchObject({
      urls: [],
      challengeDetected: true,
    });
  });

  it('rejects a non-sitemap XML document', async () => {
    await expect(
      discovery.discover(chunks('<document><loc>https://example.invalid</loc></document>'), {
        maxBytes: 10_000,
        maxUrls: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
