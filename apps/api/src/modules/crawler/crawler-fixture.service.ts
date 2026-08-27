import { Injectable, NotFoundException } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { CrawlerFixtureName } from './crawler.types';

const FIXTURES: Record<CrawlerFixtureName, { file: string; sourceUrl: string }> = {
  'book-detail': {
    file: 'book-detail.html',
    sourceUrl: 'https://www.books.am/am/fixture-book-detail.html',
  },
  'book-price-conflict': {
    file: 'book-price-conflict.html',
    sourceUrl: 'https://www.books.am/ru/fixture-price-conflict.html',
  },
};

@Injectable()
export class CrawlerFixtureService {
  async load(name: CrawlerFixtureName): Promise<{ html: string; sourceUrl: string }> {
    const fixture = FIXTURES[name];
    if (!fixture) throw new NotFoundException('Crawler fixture not found');
    const html = await readFile(join(__dirname, 'fixtures', fixture.file), 'utf8');
    return { html, sourceUrl: fixture.sourceUrl };
  }
}
