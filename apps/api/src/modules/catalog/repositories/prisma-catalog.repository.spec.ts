import { PrismaService } from '../../../database/prisma.service';
import type { BookRecord } from '../book.model';
import { PrismaCatalogRepository } from './prisma-catalog.repository';

const observedAt = '2026-09-15T12:00:00.000Z';
const parsedBook = (): BookRecord => ({
  id: '11111111-1111-4111-8111-111111111111',
  supplierSku: 'BOOK-100',
  slug: 'books-am-100',
  title: 'Supplier title',
  author: 'Supplier author',
  description: 'Supplier description',
  language: 'ru',
  locale: 'ru',
  isbn: null,
  publisher: null,
  sourcePriceAmd: 7500,
  availability: 'OUT_OF_STOCK',
  sourceUrl: 'https://www.books.am/ru/catalog/product/view/id/100/',
  coverImageUrl: 'https://www.books.am/new-cover.jpg',
  imageUrls: ['https://www.books.am/new-cover.jpg'],
  observedAt,
  localizations: {
    ru: {
      parserVersion: 'books-html-v3',
      locale: 'ru',
      title: 'Supplier title',
      author: 'Supplier author',
      description: 'Supplier description',
      languageLabel: 'Русский',
      isbn: null,
      publisher: null,
      productCode: 'BOOK-100',
      weight: null,
      barcode: null,
      isNew: null,
      pageCount: null,
      coverType: null,
      dimensions: null,
      publicationYear: null,
      series: null,
      imageUrls: ['https://www.books.am/new-cover.jpg'],
      attributes: [],
      detailSections: [],
      sourceUrl: 'https://www.books.am/ru/catalog/product/view/id/100/',
      observedAt,
    },
  },
});

const harness = (manualEdited: boolean, translationManualEdited = false) => {
  const bookUpsert = jest.fn().mockResolvedValue({ id: parsedBook().id, manualEdited });
  const translationUpsert = jest.fn().mockResolvedValue({});
  const transaction = {
    catalogBook: {
      findUnique: jest.fn().mockResolvedValue({
        imageUrls: ['https://www.books.am/manual-cover.jpg'],
        manualEdited,
        translations: [{ manualEdited: translationManualEdited }],
      }),
      upsert: bookUpsert,
    },
    catalogBookTranslation: { upsert: translationUpsert },
  };
  const prisma = {
    $transaction: jest.fn(async (operation: (client: typeof transaction) => unknown) => operation(transaction)),
  } as unknown as PrismaService;
  return { repository: new PrismaCatalogRepository(prisma), bookUpsert, translationUpsert };
};

describe('PrismaCatalogRepository crawler updates', () => {
  it('refreshes supplier price, stock and observation time without touching a manually edited book or its translations', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(true, true);
    await repository.upsert(parsedBook());

    expect(bookUpsert.mock.calls[0][0].update).toEqual({
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
      observedAt: new Date(observedAt),
    });
    expect(translationUpsert).not.toHaveBeenCalled();
  });

  it('preserves an independently protected translation even when the parent manual flag is false', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(false, true);
    await repository.upsert(parsedBook());

    expect(bookUpsert.mock.calls[0][0].update).toEqual({
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
      observedAt: new Date(observedAt),
    });
    expect(translationUpsert).not.toHaveBeenCalled();
  });

  it('continues normal editorial and localized synchronization for an unprotected book', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(false);
    await repository.upsert(parsedBook());

    expect(bookUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      description: 'Supplier description',
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
    });
    expect(translationUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      description: 'Supplier description',
      parserVersion: 'books-html-v3',
    });
  });

  it('explicit force refresh replaces protected content and images and clears both manual flags', async () => {
    const { repository, bookUpsert, translationUpsert } = harness(true, true);
    await repository.upsert(parsedBook(), { force: true });

    expect(bookUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      description: 'Supplier description',
      sourcePriceAmd: 7500,
      availability: 'OUT_OF_STOCK',
      imageUrls: ['https://www.books.am/new-cover.jpg'],
      coverImageUrl: 'https://www.books.am/new-cover.jpg',
      manualEdited: false,
    });
    expect(translationUpsert.mock.calls[0][0].update).toMatchObject({
      title: 'Supplier title',
      imageUrls: ['https://www.books.am/new-cover.jpg'],
      manualEdited: false,
    });
  });
});
