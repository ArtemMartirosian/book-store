import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BooksHtmlParserService } from './books-html-parser.service';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', `${name}.html`), 'utf8');

describe('BooksHtmlParserService', () => {
  const parser = new BooksHtmlParserService();

  it('extracts a normalized book snapshot from a saved HTML fixture', () => {
    const result = parser.parse(
      fixture('book-detail'),
      'https://www.books.am/am/fixture-book-detail.html',
      '2026-08-14T10:00:00.000Z',
    );

    expect(result.supplierSku).toBe('FIXTURE-HY-001');
    expect(result.title).toBe('Fixture Book Title');
    expect(result.sourcePriceAmd).toBe(3800);
    expect(result.currency).toBe('AMD');
    expect(result.preliminarilySalable).toBe(true);
    expect(result.quarantineReason).toBeNull();
    expect(result.observedAt).toBe('2026-08-14T10:00:00.000Z');
  });

  it('quarantines conflicting prices instead of silently publishing one', () => {
    const result = parser.parse(
      fixture('book-price-conflict'),
      'https://www.books.am/ru/fixture-price-conflict.html',
    );

    expect(result.warnings).toContain('PRICE_CONFLICT');
    expect(result.quarantineReason).toBe('PARSER_CONFLICT');
  });
});
