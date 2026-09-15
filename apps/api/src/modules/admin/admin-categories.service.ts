import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  AdminCategoriesQueryDto,
  UpdateAdminCategoryDto,
} from './dto/admin-category.dto';

@Injectable()
export class AdminCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminCategoriesQueryDto) {
    this.assertPostgres();
    const needle = query.q?.trim();
    const where: Prisma.CatalogCategoryWhereInput = needle
      ? {
          OR: [
            { supplierCategoryId: { contains: needle, mode: 'insensitive' } },
            {
              translations: {
                some: { name: { contains: needle, mode: 'insensitive' } },
              },
            },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogCategory.findMany({
        where,
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        skip: query.offset,
        take: query.limit,
        include: {
          parent: { select: { id: true, supplierCategoryId: true } },
          translations: { orderBy: { locale: 'asc' } },
          _count: { select: { books: true, children: true } },
        },
      }),
      this.prisma.catalogCategory.count({ where }),
    ]);
    return { items, total, offset: query.offset, limit: query.limit };
  }

  async get(id: string) {
    this.assertPostgres();
    const [category, parentOptions] = await this.prisma.$transaction([
      this.prisma.catalogCategory.findUnique({
        where: { id },
        include: {
          parent: { select: { id: true, supplierCategoryId: true } },
          translations: { orderBy: { locale: 'asc' } },
          _count: { select: { books: true, children: true } },
        },
      }),
      this.prisma.catalogCategory.findMany({
        where: { id: { not: id } },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          supplierCategoryId: true,
          parentId: true,
          translations: {
            orderBy: { locale: 'asc' },
            select: { locale: true, name: true },
          },
        },
      }),
    ]);
    if (!category) throw new NotFoundException('Category not found');
    return { ...category, parentOptions };
  }

  async update(id: string, input: UpdateAdminCategoryDto) {
    this.assertPostgres();
    const locales = input.translations?.map(({ locale }) => locale) ?? [];
    if (new Set(locales).size !== locales.length) {
      throw new BadRequestException('Each locale may appear only once');
    }

    await this.prisma.$transaction(async (transaction) => {
      const categories = await transaction.catalogCategory.findMany({
        select: { id: true, parentId: true },
      });
      const category = categories.find((item) => item.id === id);
      if (!category) throw new NotFoundException('Category not found');

      if (input.parentId !== undefined) {
        this.assertValidParent(id, input.parentId, categories);
      }
      const manualEdited = input.manualEdited ?? true;
      await transaction.catalogCategory.update({
        where: { id },
        data: {
          manualEdited,
          ...(input.position === undefined ? {} : { position: input.position }),
          ...(input.parentId === undefined
            ? {}
            : input.parentId === null
              ? { parent: { disconnect: true } }
              : { parent: { connect: { id: input.parentId } } }),
        },
      });

      for (const translation of input.translations ?? []) {
        const existing = await transaction.catalogCategoryTranslation.findUnique({
          where: { categoryId_locale: { categoryId: id, locale: translation.locale } },
          select: { id: true },
        });
        if (!existing) {
          throw new BadRequestException(`Translation ${translation.locale} does not exist`);
        }
        await transaction.catalogCategoryTranslation.update({
          where: { id: existing.id },
          data: {
            name: translation.name.trim(),
            manualEdited,
          },
        });
      }
    });
    return this.get(id);
  }

  private assertValidParent(
    id: string,
    parentId: string | null,
    categories: Array<{ id: string; parentId: string | null }>,
  ): void {
    if (parentId === null) return;
    const byId = new Map(categories.map((category) => [category.id, category]));
    if (!byId.has(parentId)) throw new BadRequestException('Parent category does not exist');
    const visited = new Set<string>();
    let current: string | null = parentId;
    while (current) {
      if (current === id) throw new BadRequestException('Category hierarchy cycle is not allowed');
      if (visited.has(current)) throw new BadRequestException('Existing category hierarchy is invalid');
      visited.add(current);
      current = byId.get(current)?.parentId ?? null;
    }
  }

  private assertPostgres(): void {
    if (!this.prisma.isPostgres) {
      throw new ServiceUnavailableException('Admin category editing requires PostgreSQL');
    }
  }
}
