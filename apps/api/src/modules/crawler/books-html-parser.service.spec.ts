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

  it('extracts the current Books.am product-page HTML structure', () => {
    const html = `
      <html lang="ru">
        <head><meta property="og:image" content="https://www.books.am/media/catalog/book.jpg"></head>
        <body>
          <form data-product-sku="00-00195758"></form>
          <div class="product attribute section_title">Армянские сказки</div>
          <div class="product_brand">Народные сказки</div>
          <span data-price-amount="6400"></span>
          <div class="status_block in_stock">В наличии</div>
          <div class="product_images">
            <div class="big_images">
              <a data-fancybox="product_images" href="/media/catalog/book-original.jpg">
                <img class="image_big_change" src="/media/catalog/book-large.jpg">
              </a>
            </div>
          </div>
          <div class="product media">
            <img data-full="/media/catalog/book-full.jpg" src="/media/catalog/book-small.jpg">
            <script>{"data":[{"thumb":"/thumb.jpg","img":"/page-2.jpg","full":"/page-2-full.jpg"}]}</script>
          </div>
          <div class="product info detailed">
            <div class="data item title" id="tab-label-description">Описание</div>
            <div class="data item content product attribute description" id="description" data-role="content" aria-labelledby="tab-label-description">Полное описание книги.</div>
            <div class="data item title" id="tab-label-additional">Подробнее</div>
            <div class="data item content" id="additional" data-role="content" aria-labelledby="tab-label-additional">
              <div class="details_info">
                <div class="details_block"><span class="details_question">Код товара</span><span class="details_answer">00-00195758</span></div>
                <div class="details_block"><span class="details_question">Вес</span><span class="details_answer">0.740000 кг</span></div>
                <div class="details_block"><span class="details_question">Штрих код</span><span class="details_answer">9781234567890</span></div>
                <div class="details_block"><span class="details_question">ISBN</span><span class="details_answer">978-1-234</span></div>
                <div class="details_block"><span class="details_question">Издатель</span><span class="details_answer">Lumi Press</span></div>
                <div class="details_block"><span class="details_question">Язык</span><span class="details_answer">Русский</span></div>
                <div class="details_block"><span class="details_question">Новинка</span><span class="details_answer">Да</span></div>
                <div class="details_block"><span class="details_question">Страниц</span><span class="details_answer">416</span></div>
                <div class="details_block"><span class="details_question">Обложка</span><span class="details_answer">Твердая</span></div>
                <div class="details_block"><span class="details_question">Формат</span><span class="details_answer">145 × 215 мм</span></div>
                <div class="details_block"><span class="details_question">Год издания</span><span class="details_answer">2025</span></div>
                <div class="details_block"><span class="details_question">Серия</span><span class="details_answer">Большая библиотека</span></div>
              </div>
            </div>
          </div>
        </body>
      </html>`;
    const result = parser.parse(
      html,
      'https://www.books.am/ru/catalog/product/view/id/98322/category/7463/',
      '2026-09-01T12:00:00.000Z',
    );

    expect(result).toMatchObject({
      parserVersion: 'books-html-v3',
      supplierSku: '00-00195758',
      productCode: '00-00195758',
      title: 'Армянские сказки',
      author: 'Народные сказки',
      isbn: '978-1-234',
      publisher: 'Lumi Press',
      language: 'Русский',
      weight: '0.740000 кг',
      barcode: '9781234567890',
      isNew: true,
      pageCount: 416,
      coverType: 'Твердая',
      dimensions: '145 × 215 мм',
      publicationYear: 2025,
      series: 'Большая библиотека',
      imageUrl: 'https://www.books.am/media/catalog/book-original.jpg',
      sourcePriceAmd: 6400,
      preliminarilySalable: true,
    });
    expect(result.imageUrls).toEqual(expect.arrayContaining([
      'https://www.books.am/media/catalog/book.jpg',
      'https://www.books.am/media/catalog/book-original.jpg',
      'https://www.books.am/media/catalog/book-full.jpg',
      'https://www.books.am/page-2-full.jpg',
    ]));
    expect(result.attributes).toContainEqual({ code: null, label: 'Штрих код', value: '9781234567890' });
    expect(result.detailSections).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'description', title: 'Описание', content: 'Полное описание книги.' }),
      expect.objectContaining({ code: 'additional', title: 'Подробнее' }),
    ]));
  });

  it.each([
    {
      locale: 'am',
      labels: ['Ապրանքի կոդ', 'Քաշ', 'Բարկոդ', 'Նորույթ', 'Էջերի քանակ', 'Կազմ', 'Չափս', 'Հրատ. տարեթիվ', 'Շարք'],
      values: ['ARM-1', '0.5', '12345', 'Այո', '320', 'Կոշտ', '140x210', '2024', 'Հայ դասականներ'],
    },
    {
      locale: 'en',
      labels: ['Product code', 'Weight', 'Barcode', 'Newness', 'Pages', 'Printing cover', 'Printing format', 'Publication date', 'Series'],
      values: ['ENG-1', '0.5', '12345', 'Yes', '320', 'Hardcover', '140x210', '2024', 'Classics'],
    },
    {
      locale: 'ru',
      labels: ['Код товара', 'Вес', 'Баркод', 'Новинка', 'Страниц', 'Обложка', 'Формат', 'Год издания', 'Серия'],
      values: ['RUS-1', '0.5', '12345', 'Да', '320', 'Твердая', '140x210', '2024', 'Классика'],
    },
  ])('recognizes every requested field on the $locale locale page', ({ locale, labels, values }) => {
    const rows = labels
      .map((label, index) => `<div class="details_block"><span class="details_question">${label}</span><span class="details_answer">${values[index]}</span></div>`)
      .join('');
    const result = parser.parse(
      `<html lang="${locale}"><body><form data-product-sku="${values[0]}"></form><h1 class="page-title">Book</h1><span data-price-amount="1000"></span><div class="status_block in_stock"></div><div class="details_info">${rows}</div></body></html>`,
      `https://www.books.am/${locale}/catalog/product/view/id/1/`,
    );

    expect(result).toMatchObject({
      productCode: values[0],
      weight: values[1],
      barcode: values[2],
      isNew: true,
      pageCount: 320,
      coverType: values[5],
      dimensions: values[6],
      publicationYear: 2024,
      series: values[8],
    });
  });
});
