import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AdminCategoriesService } from './admin-categories.service';

const categoryId = '11111111-1111-4111-8111-111111111111';
const childId = '22222222-2222-4222-8222-222222222222';

describe('AdminCategoriesService', () => {
  it('saves localized names and protects them from later crawler overwrites', async () => {
    const categoryUpdate = jest.fn().mockResolvedValue({});
    const translationUpdate = jest.fn().mockResolvedValue({});
    const transaction = {
      catalogCategory: {
        findMany: jest.fn().mockResolvedValue([
          { id: categoryId, parentId: null },
          { id: childId, parentId: null },
        ]),
        update: categoryUpdate,
      },
      catalogCategoryTranslation: {
        findUnique: jest.fn().mockResolvedValue({ id: 'translation-ru' }),
        update: translationUpdate,
      },
    };
    const returned = {
      id: categoryId,
      manualEdited: true,
      translations: [{ locale: 'ru', name: 'Новая категория' }],
      parentOptions: [],
    };
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn(async (operation: unknown) =>
        Array.isArray(operation)
          ? Promise.all(operation)
          : (operation as (client: typeof transaction) => unknown)(transaction)),
      catalogCategory: {
        findUnique: jest.fn().mockResolvedValue(returned),
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as unknown as PrismaService;

    const service = new AdminCategoriesService(prisma);
    await service.update(categoryId, {
      parentId: childId,
      position: 25,
      translations: [{ locale: 'ru', name: ' Новая категория ' }],
    });

    expect(categoryUpdate).toHaveBeenCalledWith({
      where: { id: categoryId },
      data: {
        manualEdited: true,
        position: 25,
        parent: { connect: { id: childId } },
      },
    });
    expect(translationUpdate).toHaveBeenCalledWith({
      where: { id: 'translation-ru' },
      data: { name: 'Новая категория', manualEdited: true },
    });
  });

  it('rejects assigning a descendant as the parent', async () => {
    const transaction = {
      catalogCategory: {
        findMany: jest.fn().mockResolvedValue([
          { id: categoryId, parentId: null },
          { id: childId, parentId: categoryId },
        ]),
      },
    };
    const prisma = {
      isPostgres: true,
      $transaction: jest.fn((operation: (client: typeof transaction) => unknown) =>
        operation(transaction)),
    } as unknown as PrismaService;
    const service = new AdminCategoriesService(prisma);

    await expect(service.update(categoryId, { parentId: childId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
