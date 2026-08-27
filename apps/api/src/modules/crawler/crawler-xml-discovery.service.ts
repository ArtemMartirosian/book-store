import { BadRequestException, Injectable } from '@nestjs/common';
import { CrawlerChallengeDetectorService } from './crawler-challenge-detector.service';
import type { CrawlerDiscoveryResult } from './crawler.types';

const MAX_LOC_LENGTH = 2_048;
const LOC_OPEN = /<loc(?:\s[^>]*)?>/iu;

@Injectable()
export class CrawlerXmlDiscoveryService {
  constructor(
    private readonly challengeDetector: CrawlerChallengeDetectorService =
      new CrawlerChallengeDetectorService(),
  ) {}

  async discover(
    body: AsyncIterable<Uint8Array>,
    limits: { maxBytes: number; maxUrls: number },
  ): Promise<CrawlerDiscoveryResult> {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    const urls: string[] = [];
    let buffer = '';
    let preview = '';
    let bytesRead = 0;
    let sawRootElement = false;

    try {
      for await (const chunk of body) {
        bytesRead += chunk.byteLength;
        if (bytesRead > limits.maxBytes) {
          throw this.invalid('SITEMAP_MAX_BYTES_EXCEEDED');
        }
        const decoded = decoder.decode(chunk, { stream: true });
        buffer += decoded;
        if (preview.length < 65_536) preview += decoded.slice(0, 65_536 - preview.length);
        sawRootElement ||= /<(?:urlset|sitemapindex)(?:\s|>)/iu.test(preview);
        if (this.challengeDetector.isChallenge(preview)) {
          return {
            urls: [],
            bytesRead,
            truncated: false,
            challengeDetected: true,
          };
        }
        const truncated = this.consume(buffer, urls, limits.maxUrls);
        buffer = truncated.remainder;
        if (truncated.limitReached) {
          return { urls, bytesRead, truncated: true, challengeDetected: false };
        }
      }
      buffer += decoder.decode();
      if (!sawRootElement) throw this.invalid('SITEMAP_ROOT_ELEMENT_REQUIRED');
      const final = this.consume(buffer, urls, limits.maxUrls);
      return {
        urls,
        bytesRead,
        truncated: final.limitReached,
        challengeDetected: false,
      };
    } catch (error) {
      if (error instanceof TypeError) throw this.invalid('SITEMAP_INVALID_UTF8');
      throw error;
    }
  }

  private consume(
    input: string,
    urls: string[],
    maxUrls: number,
  ): { remainder: string; limitReached: boolean } {
    let buffer = input;
    while (urls.length < maxUrls) {
      const match = LOC_OPEN.exec(buffer);
      if (!match || match.index === undefined) {
        return { remainder: buffer.slice(-32), limitReached: false };
      }
      const contentStart = match.index + match[0].length;
      const close = buffer.toLocaleLowerCase().indexOf('</loc>', contentStart);
      if (close === -1) {
        if (buffer.length - contentStart > MAX_LOC_LENGTH) {
          throw this.invalid('SITEMAP_LOC_TOO_LONG');
        }
        return { remainder: buffer.slice(match.index), limitReached: false };
      }

      const value = this.decodeEntities(buffer.slice(contentStart, close).trim());
      if (!value || value.length > MAX_LOC_LENGTH) {
        throw this.invalid('SITEMAP_INVALID_LOC');
      }
      urls.push(value);
      buffer = buffer.slice(close + '</loc>'.length);
    }
    return { remainder: buffer, limitReached: true };
  }

  private decodeEntities(value: string): string {
    return value
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
      .replace(/&#x([\da-f]+);/giu, (_, code: string) =>
        String.fromCodePoint(Number.parseInt(code, 16)),
      );
  }

  private invalid(code: string): BadRequestException {
    return new BadRequestException({ code, message: 'Invalid or unsafe sitemap XML.' });
  }
}
