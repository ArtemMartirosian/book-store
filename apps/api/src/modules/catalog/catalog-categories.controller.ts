import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { StoreLocale } from './book.model';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog/categories')
export class CatalogCategoriesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Return the local Books.am category tree' })
  list(@Query('locale') localeValue = 'hy') {
    if (!['hy', 'ru', 'en'].includes(localeValue)) {
      throw new BadRequestException('locale must be hy, ru, or en');
    }
    return this.catalog.listCategories(localeValue as StoreLocale);
  }
}
