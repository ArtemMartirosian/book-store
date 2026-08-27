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
      locale: query.locale,
      available: query.available,
      offset: query.offset,
      limit: query.limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return a local catalog book with the customer price' })
  getOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('locale') localeValue = 'hy',
  ) {
    if (!['hy', 'ru', 'en'].includes(localeValue)) {
      throw new BadRequestException('locale must be hy, ru, or en');
    }
    const locale = localeValue as StoreLocale;
    return this.catalog.getPublicBook(id, locale);
  }
}
