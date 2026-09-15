import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { AdminCatalogService } from './admin-catalog.service';
import { CrawlerService } from '../crawler/crawler.service';
import {
  AdminCatalogBooksQueryDto,
  UpdateAdminCatalogBookDto,
} from './dto/admin-catalog.dto';

@ApiTags('admin-catalog')
@ApiSecurity('admin-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin/catalog/books')
export class AdminCatalogController {
  constructor(
    private readonly catalog: AdminCatalogService,
    private readonly crawler: CrawlerService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search every local catalog book for administration' })
  list(@Query() query: AdminCatalogBooksQueryDto) {
    return this.catalog.list(query);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh one book from all three localized Books.am pages' })
  refresh(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.crawler.refreshBook(id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return all editable fields and localizations for one book' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.catalog.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update book data and localized fields with parser protection' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateAdminCatalogBookDto,
  ) {
    return this.catalog.update(id, input);
  }
}
