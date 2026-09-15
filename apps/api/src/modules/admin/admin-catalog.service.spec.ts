import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminCatalogService } from './admin-catalog.service';

describe('AdminCatalogService', () => {
  it('updates localized fields, syncs the active base locale and protects manual edits', async () => {
    const translationUpdate = jest.fn().mockResolvedValue({});
    const bookUpdate = jest.fn().mockResolvedValue({});
    const current = {
      id: '11111111-1111-4111-8111-111111111111',
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
    expect(bookUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: current.id },
      data: expect.objectContaining({
        title: 'Новое название',
        sourcePriceAmd: 4500,
        coverImageUrl: 'https://example.com/book.jpg',
        manualEdited: true,
      }),
    }));
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
