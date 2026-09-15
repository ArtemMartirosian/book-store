import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { load, type CheerioAPI } from 'cheerio';
import type {
  ParsedBookAttribute,
  ParsedBookDetailSection,
  ParsedBookSnapshot,
} from './crawler.types';

type JsonObject = Record<string, unknown>;

@Injectable()
export class BooksHtmlParserService {
  parse(html: string, sourceUrl: string, observedAt = new Date().toISOString()): ParsedBookSnapshot {
    const $ = load(html);
    const product = this.findProductJsonLd($);
    const offer = this.findOffer(product);
    const attributes = this.readAttributes($);
    const detailSections = this.readDetailSections($, attributes.all);
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

    const title =
      this.text(product?.name) ??
      this.cleanText($('.product.attribute.section_title').first().text()) ??
      this.cleanText($('h1.page-title').first().text()) ??
      this.cleanText($('meta[property="og:title"]').attr('content'));
    const supplierSku =
      this.text(product?.sku) ??
      this.cleanText($('[itemprop="sku"]').first().attr('content')) ??
      this.cleanText($('[data-product-sku]').first().attr('data-product-sku')) ??
      this.cleanText($('.product.attribute.sku').first().text())?.replace(/^\S+\s+/u, '') ??
      attributes.productCode;
    if (!title) throw this.invalid('TITLE_MISSING');
    if (!supplierSku) throw this.invalid('SKU_MISSING');
    if (sourcePriceAmd === null || sourcePriceAmd <= 0) throw this.invalid('PRICE_MISSING_OR_INVALID');

    const availability = this.text(offer?.availability);
    const domAvailable = $('.stock.available, .status_block.in_stock, [data-stock-status="in-stock"]').length > 0;
    const domUnavailable = $('.stock.unavailable, .status_block.out_stock, .status_block.out_of_stock, [data-stock-status="out-of-stock"]').length > 0;
    let preliminarilySalable = availability?.toLocaleLowerCase().includes('instock') ?? false;
    if (!availability) {
      preliminarilySalable = domAvailable && !domUnavailable;
      if (!domAvailable && !domUnavailable) warnings.push('AVAILABILITY_MISSING');
    }

    const canonicalCandidate = $('link[rel="canonical"]').first().attr('href');
    const canonicalUrl = canonicalCandidate ? new URL(canonicalCandidate, sourceUrl).toString() : sourceUrl;
    const imageUrls = this.imageUrls($, product?.image, sourceUrl);

    return {
      parserVersion: 'books-html-v3',
      sourceUrl,
      canonicalUrl,
      supplierSku,
      productCode: attributes.productCode ?? supplierSku,
      title,
      author:
        this.author(product?.author) ??
        attributes.author ??
        this.cleanText($('.product_brand').first().text()) ??
        null,
      description:
        this.plainText(product?.description) ??
        this.cleanText($('.product.attribute.description').first().text()) ??
        null,
      isbn: this.text(product?.isbn) ?? attributes.isbn ?? null,
      publisher: this.namedEntity(product?.publisher) ?? attributes.publisher ?? null,
      language: attributes.language ?? $('html').attr('lang')?.split('-')[0] ?? null,
      weight: attributes.weight,
      barcode: attributes.barcode,
      isNew: this.parseBoolean(attributes.newness),
      pageCount: this.parsePositiveInteger(attributes.pages),
      coverType: attributes.coverType,
      dimensions: attributes.dimensions,
      publicationYear: this.parsePublicationYear(attributes.publicationYear),
      series: attributes.series,
      imageUrl: imageUrls[0] ?? null,
      imageUrls,
      attributes: attributes.all,
      detailSections,
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

  private readAttributes($: CheerioAPI): {
    all: ParsedBookAttribute[];
    productCode: string | null;
    author: string | null;
    isbn: string | null;
    publisher: string | null;
    language: string | null;
    weight: string | null;
    barcode: string | null;
    newness: string | null;
    pages: string | null;
    coverType: string | null;
    dimensions: string | null;
    publicationYear: string | null;
    series: string | null;
  } {
    const all: ParsedBookAttribute[] = [];
    const seen = new Set<string>();
    $('.additional-attributes tr, [data-attribute-code], .details_info .details_block').each(
      (_index, element) => {
        const row = $(element);
        const code = this.cleanText(row.attr('data-attribute-code'));
        const label = this.cleanText(
          row.find('th, .label, .details_question, [data-role="label"]').first().text(),
        );
        const value = this.cleanText(
          row.find('td, .data, .value, .details_answer, [data-role="value"]').first().text(),
        );
        if ((!code && !label) || !value) return;
        const resolvedLabel = label ?? code!;
        const fingerprint = `${code ?? ''}\u0000${resolvedLabel}\u0000${value}`;
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);
        all.push({ code, label: resolvedLabel, value });
      },
    );

    const find = (...patterns: RegExp[]): string | null => {
      const match = all.find((attribute) => {
        const key = `${attribute.code ?? ''} ${attribute.label}`.toLocaleLowerCase();
        return patterns.some((pattern) => pattern.test(key));
      });
      return match?.value ?? null;
    };

    return {
      all,
      productCode: find(/product[_\s-]*code/u, /sku/u, /код\s*товара/u, /артикул/u, /ապրանքի\s*կոդ/u),
      author: find(/author/u, /автор/u, /հեղինակ/u),
      isbn: find(/isbn/u),
      publisher: find(/publisher/u, /издател/u, /հրատարակիչ/u),
      language: find(/language/u, /язык/u, /լեզու/u),
      weight: find(/weight/u, /вес/u, /քաշ/u),
      barcode: find(/bar[_\s-]*code/u, /штрих\s*код/u, /баркод/u, /բարկոդ/u),
      newness: find(/newness/u, /новин/u, /նորույթ/u),
      pages: find(/pages?/u, /страниц/u, /էջերի/u, /էջերի\s*քանակ/u),
      coverType: find(/printing[_\s-]*cover/u, /cover[_\s-]*type/u, /обложк/u, /перепл[её]т/u, /կազմ/u),
      dimensions: find(/printing[_\s-]*format/u, /dimensions?/u, /формат/u, /размер/u, /չափս/u),
      publicationYear: find(/publication[_\s-]*(?:date|year)/u, /год\s*издания/u, /հրատ.*տարեթիվ/u),
      series: find(/series/u, /серия/u, /серии/u, /շարք/u),
    };
  }

  private readDetailSections(
    $: CheerioAPI,
    allAttributes: ParsedBookAttribute[],
  ): ParsedBookDetailSection[] {
    const sections: ParsedBookDetailSection[] = [];
    const seen = new Set<string>();
    const add = (
      code: string | null,
      title: string | null,
      content: string | null,
      attributes: ParsedBookAttribute[] = [],
    ): void => {
      if (!title || (!content && attributes.length === 0)) return;
      const resolvedContent = content ?? attributes.map(({ label, value }) => `${label}: ${value}`).join('\n');
      const fingerprint = `${code ?? ''}\u0000${title}\u0000${resolvedContent}`;
      if (seen.has(fingerprint)) return;
      seen.add(fingerprint);
      sections.push({ code, title, content: resolvedContent, attributes });
    };

    $('.product.info.detailed [data-role="content"], .product.info.detailed .data.item.content').each(
      (_index, element) => {
        const content = $(element);
        const code = this.cleanText(content.attr('id') ?? content.attr('data-section'));
        const labelledBy = this.cleanText(content.attr('aria-labelledby'));
        let title = labelledBy
          ? this.cleanText(
              $('[id]')
                .filter((_labelIndex, label) => $(label).attr('id') === labelledBy)
                .first()
                .text(),
            )
          : null;
        title ??= this.cleanText(content.prev('.data.item.title, [data-role="collapsible"]').first().text());
        if (!title && code) {
          title = this.cleanText(
            $('a[href]')
              .filter((_linkIndex, link) => $(link).attr('href') === `#${code}`)
              .first()
              .text(),
          );
        }
        const sectionAttributes = this.attributesInside($, element);
        add(code, title ?? code, this.cleanText(content.text()), sectionAttributes);
      },
    );

    const description = this.cleanText($('.product.attribute.description').first().text());
    add('description', this.sectionTitle($, 'description') ?? 'Description', description);
    if (allAttributes.length > 0) {
      add(
        'additional',
        this.sectionTitle($, 'additional') ?? 'Details',
        allAttributes.map(({ label, value }) => `${label}: ${value}`).join('\n'),
        allAttributes,
      );
    }
    return sections;
  }

  private attributesInside($: CheerioAPI, element: Parameters<CheerioAPI>[0]): ParsedBookAttribute[] {
    const attributes: ParsedBookAttribute[] = [];
    $(element)
      .find('.additional-attributes tr, [data-attribute-code], .details_info .details_block')
      .each((_index, rowElement) => {
        const row = $(rowElement);
        const code = this.cleanText(row.attr('data-attribute-code'));
        const label = this.cleanText(
          row.find('th, .label, .details_question, [data-role="label"]').first().text(),
        );
        const value = this.cleanText(
          row.find('td, .data, .value, .details_answer, [data-role="value"]').first().text(),
        );
        if ((!code && !label) || !value) return;
        attributes.push({ code, label: label ?? code!, value });
      });
    return attributes;
  }

  private sectionTitle($: CheerioAPI, code: string): string | null {
    return this.cleanText(
      $(`a[href="#${code}"], [data-role="collapsible"][aria-controls="${code}"]`).first().text(),
    );
  }

  private imageUrls($: CheerioAPI, image: unknown, sourceUrl: string): string[] {
    const galleryCandidates: string[] = [];
    const fallbackCandidates: string[] = [];
    const appendJsonImage = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(appendJsonImage);
      } else if (typeof value === 'string') {
        fallbackCandidates.push(value);
      } else if (this.isObject(value)) {
        appendJsonImage(value.contentUrl ?? value.url);
      }
    };
    appendJsonImage(image);
    $('meta[property="og:image"], meta[name="twitter:image"]').each((_index, element) => {
      const value = $(element).attr('content');
      if (value) fallbackCandidates.push(value);
    });
    $('.product_images a[data-fancybox="product_images"][href]')
      .each((_index, element) => {
        const value = $(element).attr('href');
        if (value) galleryCandidates.push(value);
      });
    $('.product_images img.image_big_change, .product_images .big_images img, .product.media img, .gallery-placeholder img, [data-gallery-role="gallery-placeholder"] img, .fotorama__stage img')
      .each((_index, element) => {
        for (const attribute of ['data-full', 'data-image', 'data-zoom-image', 'data-src', 'src']) {
          const value = $(element).attr(attribute);
          if (value) galleryCandidates.push(value);
        }
      });
    $('.product_images a[href], .product.media a[href], .gallery-placeholder a[href], [data-gallery-role="gallery-placeholder"] a[href]')
      .each((_index, element) => {
        const value = $(element).attr('href');
        if (value && /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/iu.test(value)) galleryCandidates.push(value);
      });
    $('.product_images script, .product.media script, .gallery-placeholder script, [data-gallery-role="gallery-placeholder"] script, script[type="text/x-magento-init"]')
      .each((_index, element) => {
        const script = $(element).text();
        if (!$(element).closest('.product_images, .product.media, .gallery-placeholder, [data-gallery-role="gallery-placeholder"]').length && !/(?:gallery|fotorama)/iu.test(script)) {
          return;
        }
        for (const match of script.matchAll(/"(?:full|img|image|url)"\s*:\s*"((?:\\.|[^"\\])+)"/gu)) {
          try {
            galleryCandidates.push(JSON.parse(`"${match[1]}"`) as string);
          } catch {
            // Ignore a malformed gallery entry and keep the other images.
          }
        }
      });

    // Books.am exposes a landscape social preview in og:image and a portrait
    // product image in .product_images. The gallery must win so storefront
    // cards show the complete cover instead of a tiny cover on a 1200x630 canvas.
    const candidates = [...galleryCandidates, ...fallbackCandidates];
    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      try {
        const url = new URL(candidate.trim(), sourceUrl);
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        url.protocol = 'https:';
        const resolved = url.toString();
        if (seen.has(resolved)) continue;
        seen.add(resolved);
        normalized.push(resolved);
        if (normalized.length >= 100) break;
      } catch {
        // Ignore invalid image URLs from unrelated page scripts.
      }
    }
    return normalized;
  }

  private parseBoolean(value: string | null): boolean | null {
    const normalized = value?.trim().toLocaleLowerCase();
    if (!normalized) return null;
    if (/^(?:yes|true|1|да|есть|այո)$/u.test(normalized)) return true;
    if (/^(?:no|false|0|нет|ոչ)$/u.test(normalized)) return false;
    return null;
  }

  private parsePositiveInteger(value: string | null): number | null {
    const match = value?.match(/\d[\d\s,]*/u);
    if (!match) return null;
    const parsed = Number(match[0].replace(/[\s,]/gu, ''));
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private parsePublicationYear(value: string | null): number | null {
    const match = value?.match(/(?:^|\D)((?:1[5-9]|20)\d{2})(?:\D|$)/u);
    if (!match) return null;
    const year = Number(match[1]);
    return year <= new Date().getUTCFullYear() + 2 ? year : null;
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
