import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { load, type CheerioAPI } from 'cheerio';
import type { ParsedBookSnapshot } from './crawler.types';

type JsonObject = Record<string, unknown>;

@Injectable()
export class BooksHtmlParserService {
  parse(html: string, sourceUrl: string, observedAt = new Date().toISOString()): ParsedBookSnapshot {
    const $ = load(html);
    const product = this.findProductJsonLd($);
    const offer = this.findOffer(product);
    const attributes = this.readAttributes($);
    const warnings: string[] = [];
    const sourceCurrency = this.text(offer?.priceCurrency);
    if (sourceCurrency && sourceCurrency.toLocaleUpperCase() !== 'AMD') {
      throw this.invalid('UNSUPPORTED_CURRENCY');
    }
    if (!sourceCurrency) warnings.push('CURRENCY_MISSING_ASSUMED_AMD');

    const jsonPrice = this.parseAmd(offer?.price);
    const domPrice = this.parseAmd(
      $('[itemprop="price"]').first().attr('content') ??
        $('[data-price-amount]').first().attr('data-price-amount') ??
        $('.price').first().text(),
    );
    const sourcePriceAmd = jsonPrice ?? domPrice;
    if (jsonPrice !== null && domPrice !== null && jsonPrice !== domPrice) {
      warnings.push('PRICE_CONFLICT');
    }

    const title = this.text(product?.name) ?? this.cleanText($('h1.page-title').first().text());
    const supplierSku =
      this.text(product?.sku) ??
      this.cleanText($('[itemprop="sku"]').first().attr('content')) ??
      this.cleanText($('[data-product-sku]').first().attr('data-product-sku'));
    if (!title) throw this.invalid('TITLE_MISSING');
    if (!supplierSku) throw this.invalid('SKU_MISSING');
    if (sourcePriceAmd === null || sourcePriceAmd <= 0) throw this.invalid('PRICE_MISSING_OR_INVALID');

    const availability = this.text(offer?.availability);
    const domAvailable = $('.stock.available, [data-stock-status="in-stock"]').length > 0;
    const domUnavailable = $('.stock.unavailable, [data-stock-status="out-of-stock"]').length > 0;
    let preliminarilySalable = availability?.toLocaleLowerCase().includes('instock') ?? false;
    if (!availability) {
      preliminarilySalable = domAvailable && !domUnavailable;
      if (!domAvailable && !domUnavailable) warnings.push('AVAILABILITY_MISSING');
    }

    const canonicalCandidate = $('link[rel="canonical"]').first().attr('href');
    const canonicalUrl = canonicalCandidate ? new URL(canonicalCandidate, sourceUrl).toString() : sourceUrl;
    const image = Array.isArray(product?.image) ? product?.image[0] : product?.image;

    return {
      parserVersion: 'books-html-v1',
      sourceUrl,
      canonicalUrl,
      supplierSku,
      title,
      author: this.author(product?.author) ?? attributes.author ?? null,
      description:
        this.plainText(product?.description) ??
        this.cleanText($('.product.attribute.description').first().text()) ??
        null,
      isbn: this.text(product?.isbn) ?? attributes.isbn ?? null,
      publisher: this.namedEntity(product?.publisher) ?? attributes.publisher ?? null,
      language: attributes.language ?? $('html').attr('lang')?.split('-')[0] ?? null,
      imageUrl: this.text(image) ? new URL(this.text(image)!, sourceUrl).toString() : null,
      sourcePriceAmd,
      currency: 'AMD',
      preliminarilySalable,
      observedAt,
      warnings,
      quarantineReason: warnings.includes('PRICE_CONFLICT') ? 'PARSER_CONFLICT' : null,
    };
  }

  private findProductJsonLd($: CheerioAPI): JsonObject | null {
    for (const node of $('script[type="application/ld+json"]').toArray()) {
      const raw = $(node).text().trim();
      if (!raw) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        const candidates = this.flattenJsonLd(parsed);
        const product = candidates.find((candidate) => {
          const type = candidate['@type'];
          return type === 'Product' || (Array.isArray(type) && type.includes('Product'));
        });
        if (product) return product;
      } catch {
        // A broken unrelated JSON-LD block must not prevent parsing other blocks.
      }
    }
    return null;
  }

  private flattenJsonLd(value: unknown): JsonObject[] {
    if (Array.isArray(value)) return value.flatMap((item) => this.flattenJsonLd(item));
    if (!this.isObject(value)) return [];
    const graph = value['@graph'];
    return graph ? [value, ...this.flattenJsonLd(graph)] : [value];
  }

  private findOffer(product: JsonObject | null): JsonObject | null {
    const offers = product?.offers;
    if (Array.isArray(offers)) return offers.find((offer) => this.isObject(offer)) ?? null;
    return this.isObject(offers) ? offers : null;
  }

  private readAttributes($: CheerioAPI): Record<string, string> {
    const result: Record<string, string> = {};
    $('.additional-attributes tr, [data-attribute-code]').each((_index, element) => {
      const row = $(element);
      const rawKey =
        row.attr('data-attribute-code') ?? row.find('th, .label').first().text().trim().toLocaleLowerCase();
      const value = this.cleanText(row.find('td, .data, .value').first().text());
      if (!rawKey || !value) return;
      const normalized = rawKey.toLocaleLowerCase();
      if (normalized.includes('isbn')) result.isbn = value;
      if (normalized.includes('author') || normalized.includes('автор')) result.author = value;
      if (normalized.includes('publisher') || normalized.includes('издатель')) result.publisher = value;
      if (normalized.includes('language') || normalized.includes('язык')) result.language = value;
    });
    return result;
  }

  private parseAmd(value: unknown): number | null {
    if (typeof value === 'number') return Number.isSafeInteger(value) ? value : null;
    if (typeof value !== 'string') return null;
    const match = value.match(/-?\d[\d\s,]*(?:\.\d{1,2})?/u);
    if (!match) return null;
    const amount = Number(match[0].replace(/[\s,]/gu, ''));
    return Number.isSafeInteger(amount) ? amount : null;
  }

  private author(value: unknown): string | null {
    if (Array.isArray(value)) {
      const names = value.map((item) => this.namedEntity(item)).filter((item): item is string => Boolean(item));
      return names.length > 0 ? names.join(', ') : null;
    }
    return this.namedEntity(value);
  }

  private namedEntity(value: unknown): string | null {
    if (this.isObject(value)) return this.text(value.name);
    return this.text(value);
  }

  private text(value: unknown): string | null {
    return typeof value === 'string' ? this.cleanText(value) : null;
  }

  private plainText(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    return this.cleanText(load(value).text());
  }

  private cleanText(value: string | undefined): string | null {
    const cleaned = value?.replace(/\s+/gu, ' ').trim();
    return cleaned ? cleaned : null;
  }

  private isObject(value: unknown): value is JsonObject {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private invalid(code: string): UnprocessableEntityException {
    return new UnprocessableEntityException({ code: `PARSER_${code}`, quarantine: true });
  }
}
