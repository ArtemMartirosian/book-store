import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { AdminApiKeyGuard } from '../../common/guards/admin-api-key.guard';
import { AdminCategoriesService } from './admin-categories.service';
import {
  AdminCategoriesQueryDto,
  UpdateAdminCategoryDto,
} from './dto/admin-category.dto';

@ApiTags('admin-categories')
@ApiSecurity('admin-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin/catalog/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Search the local Books.am category tree' })
  list(@Query() query: AdminCategoriesQueryDto) {
    return this.categories.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return one editable category with all localizations' })
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.categories.get(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit category hierarchy and localized names' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() input: UpdateAdminCategoryDto,
  ) {
    return this.categories.update(id, input);
  }
}
