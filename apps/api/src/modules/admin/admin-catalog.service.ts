import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  AdminCatalogBooksQueryDto,
  UpdateAdminBookLocalizationDto,
  UpdateAdminCatalogBookDto,
} from './dto/admin-catalog.dto';

const localizedFields = [
  'title',
  'author',
  'description',
  'languageLabel',
  'isbn',
  'publisher',
  'productCode',
  'weight',
  'barcode',
  'isNew',
  'pageCount',
  'coverType',
  'dimensions',
  'publicationYear',
  'series',
  'imageUrls',
  'attributes',
  'detailSections',
] as const;

@Injectable()
export class AdminCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminCatalogBooksQueryDto) {
    this.assertPostgres();
    const needle = query.q?.trim();
    const where: Prisma.CatalogBookWhereInput = needle
      ? {
          OR: [
            { title: { contains: needle, mode: 'insensitive' } },
            { author: { contains: needle, mode: 'insensitive' } },
            { supplierSku: { contains: needle, mode: 'insensitive' } },
            { productCode: { contains: needle, mode: 'insensitive' } },
            { isbn: { contains: needle, mode: 'insensitive' } },
            { barcode: { contains: needle, mode: 'insensitive' } },
            {
              translations: {
                some: {
                  OR: [
                    { title: { contains: needle, mode: 'insensitive' } },
                    { author: { contains: needle, mode: 'insensitive' } },
                    { productCode: { contains: needle, mode: 'insensitive' } },
                    { isbn: { contains: needle, mode: 'insensitive' } },
                    { barcode: { contains: needle, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogBook.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: query.offset,
        take: query.limit,
        select: {
          id: true,
          supplierSku: true,
          slug: true,
          title: true,
          author: true,
          productCode: true,
          sourcePriceAmd: true,
          availability: true,
          coverImageUrl: true,
          manualEdited: true,
          updatedAt: true,
          translations: { select: { locale: true } },
        },
      }),
      this.prisma.catalogBook.count({ where }),
    ]);
    return {
      items: items.map(({ translations, ...book }) => ({
        ...book,
        availableLocales: translations.map(({ locale }) => locale),
      })),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  async get(id: string) {
    this.assertPostgres();
    const [book, categoryOptions] = await this.prisma.$transaction([
      this.prisma.catalogBook.findUnique({
        where: { id },
        include: {
          translations: { orderBy: { locale: 'asc' } },
          categories: { select: { categoryId: true } },
        },
      }),
      this.prisma.catalogCategory.findMany({
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
    if (!book) throw new NotFoundException('Book not found');
    return {
      ...book,
      categoryIds: book.categories.map(({ categoryId }) => categoryId),
      categoryOptions,
      localizations: book.translations,
      translations: undefined,
      categories: undefined,
    };
  }

  async update(id: string, input: UpdateAdminCatalogBookDto) {
    this.assertPostgres();
    const locales = input.localizations?.map(({ locale }) => locale) ?? [];
    if (new Set(locales).size !== locales.length) {
      throw new BadRequestException('Each locale may appear only once');
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const book = await transaction.catalogBook.findUnique({
          where: { id },
          include: { translations: true },
        });
        if (!book) throw new NotFoundException('Book not found');

        const baseData: Prisma.CatalogBookUpdateInput = {
          manualEdited: input.manualEdited ?? true,
        };
        if (input.slug !== undefined) baseData.slug = input.slug;
        if (input.language !== undefined) baseData.language = input.language;
        if (input.sourcePriceAmd !== undefined) baseData.sourcePriceAmd = input.sourcePriceAmd;
        if (input.availability !== undefined) baseData.availability = input.availability;

        for (const localization of input.localizations ?? []) {
          const current = book.translations.find(({ locale }) => locale === localization.locale);
          if (!current) {
            throw new BadRequestException(`Localization ${localization.locale} does not exist`);
          }
          const data = this.localizationUpdate(localization, input.manualEdited ?? true);
          await transaction.catalogBookTranslation.update({
            where: { id: current.id },
            data,
          });
          if (localization.locale === book.locale) {
            this.syncBaseLocalization(baseData, localization);
          }
        }

        if (input.categoryIds !== undefined) {
          const categoryIds = [...new Set(input.categoryIds)];
          const existingCategories = await transaction.catalogCategory.findMany({
            where: { id: { in: categoryIds } },
            select: { id: true },
          });
          if (existingCategories.length !== categoryIds.length) {
            throw new BadRequestException('One or more categories do not exist');
          }
          await transaction.catalogBookCategory.deleteMany({ where: { bookId: id } });
          if (categoryIds.length) {
            await transaction.catalogBookCategory.createMany({
              data: categoryIds.map((categoryId) => ({
                bookId: id,
                categoryId,
                observedAt: new Date(),
              })),
            });
          }
        }

        await transaction.catalogBook.update({ where: { id }, data: baseData });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Slug or localized source URL is already in use');
      }
      throw error;
    }
    return this.get(id);
  }

  private localizationUpdate(
    input: UpdateAdminBookLocalizationDto,
    manualEdited: boolean,
  ): Prisma.CatalogBookTranslationUpdateInput {
    const data: Prisma.CatalogBookTranslationUpdateInput = {
      manualEdited,
      parserVersion: manualEdited ? 'manual-admin-v1' : 'books-html-v3',
    };
    for (const field of localizedFields) {
      const value = input[field];
      if (value === undefined) continue;
      if (field === 'attributes' || field === 'detailSections') {
        data[field] = value as Prisma.InputJsonValue;
      } else {
        Object.assign(data, { [field]: value });
      }
    }
    return data;
  }

  private syncBaseLocalization(
    data: Prisma.CatalogBookUpdateInput,
    input: UpdateAdminBookLocalizationDto,
  ): void {
    const directFields = [
      'title',
      'author',
      'description',
      'isbn',
      'publisher',
      'productCode',
      'weight',
      'barcode',
      'isNew',
      'pageCount',
      'coverType',
      'dimensions',
      'publicationYear',
      'series',
      'imageUrls',
      'attributes',
      'detailSections',
    ] as const;
    for (const field of directFields) {
      const value = input[field];
      if (value === undefined) continue;
      if (field === 'attributes' || field === 'detailSections') {
        data[field] = value as Prisma.InputJsonValue;
      } else {
        Object.assign(data, { [field]: value });
      }
    }
    if (input.imageUrls !== undefined) data.coverImageUrl = input.imageUrls[0] ?? null;
  }

  private assertPostgres(): void {
    if (!this.prisma.isPostgres) {
      throw new ServiceUnavailableException('Admin catalog editing requires PostgreSQL');
    }
  }
}
