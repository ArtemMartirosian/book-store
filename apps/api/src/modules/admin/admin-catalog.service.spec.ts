import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AdminCatalogService } from './admin-catalog.service';

describe('AdminCatalogService', () => {
  it('lists the public page address alongside the unchanged private supplier key', async () => {
    const book = {
      id: '11111111-1111-4111-8111-111111111111',
      supplierSku: 'SUPPLIER-122337',
      slug: 'books-am-122337',
      publicSlug: 'madhouse-at-the-end-of-the-earth',
      title: 'Madhouse at the End of the Earth',
      translations: [{ locale: 'en' }],
    };
    const findMany = jest.fn().mockResolvedValue([book]);
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
      catalogBook: { findMany, count: jest.fn().mockResolvedValue(1) },
    } as unknown as PrismaService;

    const result = await new AdminCatalogService(prisma).list({ offset: 0, limit: 50 });

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({ supplierSku: true, slug: true, publicSlug: true }),
    }));
    expect(result.items[0]).toMatchObject({
      supplierSku: book.supplierSku, slug: book.slug, publicSlug: book.publicSlug,
    });
  });

  it('preserves source URLs and both addresses in the private book editor response', async () => {
    const book = {
      id: '11111111-1111-4111-8111-111111111111',
      supplierSku: 'SUPPLIER-122337',
      slug: 'books-am-122337',
      publicSlug: 'madhouse-at-the-end-of-the-earth',
      sourceUrl: 'https://www.books.am/en/catalog/product/view/id/122337/',
      translations: [{ locale: 'en', sourceUrl: 'https://www.books.am/en/catalog/product/view/id/122337/' }],
      categories: [],
    };
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
      catalogBook: { findUnique: jest.fn().mockResolvedValue(book) },
      catalogCategory: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    const result = await new AdminCatalogService(prisma).get(book.id);

    expect(result).toMatchObject({
      supplierSku: book.supplierSku, slug: book.slug, publicSlug: book.publicSlug,
      sourceUrl: book.sourceUrl, localizations: book.translations,
    });
  });

  it('updates localized fields while accepting an unchanged legacy key without a collision lookup', async () => {
    const translationUpdate = jest.fn().mockResolvedValue({});
    const bookUpdate = jest.fn().mockResolvedValue({});
    const current = {
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'books-am-122337',
      publicSlug: 'madhouse-at-the-end-of-the-earth',
      supplierSku: 'SUPPLIER-122337',
      sourceUrl: 'https://www.books.am/en/catalog/product/view/id/122337/',
      locale: 'ru',
      translations: [{ id: 'tr-ru', locale: 'ru' }],
    };
    const returned = {
      ...current,
      title: 'Новое название',
      translations: [],
      categories: [],
    };
    const transaction = {
      catalogBook: {
        findUnique: jest.fn().mockResolvedValue(current),
        findFirst: jest.fn(),
        update: bookUpdate,
      },
      catalogBookTranslation: { update: translationUpdate },
    };
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(async (operation: unknown) =>
        Array.isArray(operation)
          ? Promise.all(operation)
          : (operation as (client: typeof transaction) => unknown)(transaction)),
      catalogBook: { findUnique: jest.fn().mockResolvedValue(returned) },
      catalogCategory: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await service.update(current.id, {
      slug: 'books-am-122337',
      sourcePriceAmd: 4500,
      localizations: [{ locale: 'ru', title: 'Новое название', imageUrls: ['https://example.com/book.jpg'] }],
    });

    expect(translationUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tr-ru' },
      data: expect.objectContaining({
        title: 'Новое название',
        imageUrls: ['https://example.com/book.jpg'],
        manualEdited: true,
        parserVersion: 'manual-admin-v1',
      }),
    }));
    expect(bookUpdate.mock.calls[0][0].data).not.toHaveProperty('publicSlug');
    expect(bookUpdate.mock.calls[0][0].data).not.toHaveProperty('supplierSku');
    expect(bookUpdate.mock.calls[0][0].data).not.toHaveProperty('sourceUrl');
    expect(transaction.catalogBook.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(bookUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: current.id },
      data: expect.objectContaining({
        slug: 'books-am-122337',
        title: 'Новое название',
        sourcePriceAmd: 4500,
        coverImageUrl: 'https://example.com/book.jpg',
        manualEdited: true,
      }),
    }));
  });

  it('rejects changing a private key to another book public address before any writes', async () => {
    const current = {
      id: '11111111-1111-4111-8111-111111111111', slug: 'books-am-122337',
      publicSlug: 'own-page', supplierSku: 'SUPPLIER-122337', sourceUrl: 'https://www.books.am/en/catalog/product/view/id/122337/',
      locale: 'en', translations: [{ id: 'tr-en', locale: 'en' }],
    };
    const transaction = {
      catalogBook: {
        findUnique: jest.fn().mockResolvedValue(current),
        findFirst: jest.fn().mockResolvedValue({ id: '22222222-2222-4222-8222-222222222222' }),
        update: jest.fn(),
      },
      catalogBookTranslation: { update: jest.fn() },
    };
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(async (operation: (client: typeof transaction) => unknown) => operation(transaction)),
    } as unknown as PrismaService;

    await expect(new AdminCatalogService(prisma).update(current.id, {
      slug: 'another-public-address', localizations: [{ locale: 'en', title: 'Must not be written' }],
    })).rejects.toBeInstanceOf(ConflictException);

    expect(transaction.catalogBook.findFirst).toHaveBeenCalledWith({
      where: { id: { not: current.id }, publicSlug: 'another-public-address' }, select: { id: true },
    });
    expect(transaction.catalogBook.update).not.toHaveBeenCalled();
    expect(transaction.catalogBookTranslation.update).not.toHaveBeenCalled();
    expect(current).toMatchObject({ slug: 'books-am-122337', publicSlug: 'own-page', supplierSku: 'SUPPLIER-122337' });
  });

  it('keeps the existing API semantics for a changed legacy key that is not a public address', async () => {
    const current = {
      id: '11111111-1111-4111-8111-111111111111', slug: 'books-am-122337',
      publicSlug: 'own-page', locale: 'en', translations: [], categories: [],
    };
    const update = jest.fn().mockResolvedValue({});
    const transaction = {
      catalogBook: {
        findUnique: jest.fn().mockResolvedValue(current),
        findFirst: jest.fn().mockResolvedValue(null),
        update,
      },
    };
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(async (operation: unknown) => Array.isArray(operation)
        ? Promise.all(operation)
        : (operation as (client: typeof transaction) => unknown)(transaction)),
      catalogBook: { findUnique: jest.fn().mockResolvedValue(current) },
      catalogCategory: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;

    await new AdminCatalogService(prisma).update(current.id, { slug: 'free-private-key' });

    expect(transaction.catalogBook.findFirst).toHaveBeenCalledWith({
      where: { id: { not: current.id }, publicSlug: 'free-private-key' }, select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: current.id }, data: { manualEdited: true, slug: 'free-private-key' } });
  });

  it('returns a retryable 409 for a Serializable write conflict without silently retrying the edit', async () => {
    const writeConflict = new Prisma.PrismaClientKnownRequestError('Transaction write conflict', {
      code: 'P2034', clientVersion: '6.19.3',
    });
    const runTransaction = jest.fn().mockRejectedValue(writeConflict);
    const prisma = { isPostgres: true, $transaction: runTransaction } as unknown as PrismaService;

    const error: unknown = await new AdminCatalogService(prisma)
      .update('11111111-1111-4111-8111-111111111111', { sourcePriceAmd: 4500 })
      .catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ConflictException);
    if (!(error instanceof ConflictException)) throw new Error('Expected a catalog write conflict');
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toMatchObject({ code: 'CATALOG_WRITE_CONFLICT', retryable: true, message: expect.stringMatching(/retry/iu) });
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(runTransaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  });

  it('rejects duplicate locale payloads before writing', async () => {
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const service = new AdminCatalogService(prisma);

    await expect(service.update('11111111-1111-4111-8111-111111111111', {
      localizations: [{ locale: 'ru' }, { locale: 'ru' }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
