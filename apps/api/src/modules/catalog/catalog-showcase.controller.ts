import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { StoreLocale } from './book.model';
import { CatalogService } from './catalog.service';

@ApiTags('catalog')
@Controller('catalog/showcase')
export class CatalogShowcaseController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Return bounded, localized homepage book selections from the local catalog' })
  get(@Query('locale') locale = 'hy') {
    if (!['hy', 'ru', 'en'].includes(locale)) {
      throw new BadRequestException('locale must be hy, ru, or en');
    }
    return this.catalog.getShowcase(locale as StoreLocale);
  }
}
