import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import type { StoreLocale } from './book.model';
import { SearchBooksQueryDto } from './dto/search-books-query.dto';

@ApiTags('catalog')
@Controller('catalog/books')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Search the local catalog; never calls Books.am on request' })
  search(@Query() query: SearchBooksQueryDto) {
    return this.catalog.search({
      query: query.q,
      title: query.title,
      author: query.author,
      description: query.description,
      productCode: query.productCode,
      barcode: query.barcode,
      isbn: query.isbn,
      publisher: query.publisher,
      series: query.series,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      hasCover: query.hasCover,
      isNew: query.isNew,
      locale: query.locale,
      language: query.language,
      category: query.category,
      available: query.available,
      sort: query.sort,
      offset: query.offset,
      limit: query.limit,
    });
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Return a local catalog book by its public slug' })
  getBySlug(@Param('slug') slug: string, @Query('locale') localeValue = 'hy') {
    const locale = this.parseLocale(localeValue);
    if (!/^[\p{L}\p{N}][\p{L}\p{N}._~-]{0,179}$/u.test(slug)) {
      throw new BadRequestException('slug is invalid');
    }
    return this.catalog.getPublicBookBySlug(slug, locale);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a local catalog book with the customer price' })
  getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('locale') localeValue = 'hy',
  ) {
    return this.catalog.getPublicBook(id, this.parseLocale(localeValue));
  }

  private parseLocale(value: string): StoreLocale {
    if (!['hy', 'ru', 'en'].includes(value)) {
      throw new BadRequestException('locale must be hy, ru, or en');
    }
    return value as StoreLocale;
  }
}
