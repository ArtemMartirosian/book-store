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
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminCategoriesQueryDto {
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

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit = 100;
}

export class UpdateAdminCategoryTranslationDto {
  @ApiProperty({ enum: ['hy', 'ru', 'en'] })
  @IsIn(['hy', 'ru', 'en'])
  locale!: 'hy' | 'ru' | 'en';

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  name!: string;
}

export class UpdateAdminCategoryDto {
  @ApiPropertyOptional({ nullable: true, description: 'Parent category UUID' })
  @IsOptional()
  @IsUUID('all')
  parentId?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100_000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  position?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  manualEdited?: boolean;

  @ApiPropertyOptional({ type: [UpdateAdminCategoryTranslationDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => UpdateAdminCategoryTranslationDto)
  translations?: UpdateAdminCategoryTranslationDto[];
}
