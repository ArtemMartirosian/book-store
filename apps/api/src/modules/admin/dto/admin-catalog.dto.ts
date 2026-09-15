import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCatalogBooksQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}

export class AdminBookAttributeDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  label!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5_000)
  value!: string;
}

export class AdminBookDetailSectionDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  code?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100_000)
  content!: string;

  @ApiProperty({ type: [AdminBookAttributeDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AdminBookAttributeDto)
  attributes!: AdminBookAttributeDto[];
}

export class UpdateAdminBookLocalizationDto {
  @ApiProperty({ enum: ['hy', 'ru', 'en'] })
  @IsIn(['hy', 'ru', 'en'])
  locale!: 'hy' | 'ru' | 'en';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  author?: string;

  @ApiPropertyOptional({ maxLength: 100_000 })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  description?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  languageLabel?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  isbn?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  publisher?: string | null;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  productCode?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  weight?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  barcode?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsBoolean()
  isNew?: boolean | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 100_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  pageCount?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  coverType?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  dimensions?: string | null;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 9999 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  publicationYear?: number | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 10_000 })
  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  series?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] }, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ type: [AdminBookAttributeDto], maxItems: 300 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  @ValidateNested({ each: true })
  @Type(() => AdminBookAttributeDto)
  attributes?: AdminBookAttributeDto[];

  @ApiPropertyOptional({ type: [AdminBookDetailSectionDto], maxItems: 100 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => AdminBookDetailSectionDto)
  detailSections?: AdminBookDetailSectionDto[];
}

export class UpdateAdminCatalogBookDto {
  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @Matches(/^[\p{L}\p{N}][\p{L}\p{N}._~-]{0,179}$/u)
  slug?: string;

  @ApiPropertyOptional({ enum: ['hy', 'ru', 'en'] })
  @IsOptional()
  @IsIn(['hy', 'ru', 'en'])
  language?: 'hy' | 'ru' | 'en';

  @ApiPropertyOptional({ minimum: 1, maximum: 1_000_000_000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  sourcePriceAmd?: number;

  @ApiPropertyOptional({ enum: ['PRELIMINARY_AVAILABLE', 'OUT_OF_STOCK'] })
  @IsOptional()
  @IsIn(['PRELIMINARY_AVAILABLE', 'OUT_OF_STOCK'])
  availability?: 'PRELIMINARY_AVAILABLE' | 'OUT_OF_STOCK';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  manualEdited?: boolean;

  @ApiPropertyOptional({ type: [UpdateAdminBookLocalizationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminBookLocalizationDto)
  localizations?: UpdateAdminBookLocalizationDto[];

  @ApiPropertyOptional({ type: [String], description: 'Internal catalog category UUIDs' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(183)
  @IsUUID('all', { each: true })
  categoryIds?: string[];
}
