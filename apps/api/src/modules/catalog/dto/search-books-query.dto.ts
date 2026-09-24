import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, Validate, ValidatorConstraint, type ValidationArguments, type ValidatorConstraintInterface } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const queryBoolean = ({ value }: { value: unknown }) => value === 'true' ? true : value === 'false' ? false : value;

@ValidatorConstraint({ name: 'validPriceRange', async: false })
class ValidPriceRange implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments) {
    const minimum = (args.object as SearchBooksQueryDto).minPrice;
    return minimum === undefined || typeof value !== 'number' || value >= minimum;
  }
  defaultMessage() { return 'maxPrice must be greater than or equal to minPrice'; }
}

export class SearchBooksQueryDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  author?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  productCode?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  barcode?: string;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  isbn?: string;

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  publisher?: string;

  @ApiPropertyOptional({ maxLength: 256 })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  series?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647, description: 'Minimum customer price in AMD, including the active item markup' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 2147483647, description: 'Maximum customer price in AMD, including the active item markup' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  @Validate(ValidPriceRange)
  maxPrice?: number;

  @ApiPropertyOptional({ type: Boolean, description: 'Filter editions with a cover image; false selects editions without an image' })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  hasCover?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Filter the actual parsed newness flag; unknown flags match neither true nor false' })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  isNew?: boolean;

  @ApiPropertyOptional({
    enum: ['hy', 'ru', 'en'],
    description: 'Localizes availability notices; book language is not filtered by this field',
  })
  @IsOptional()
  @IsIn(['hy', 'ru', 'en'])
  locale: 'hy' | 'ru' | 'en' = 'hy';

  @ApiPropertyOptional({
    enum: ['hy', 'ru', 'en'],
    description: 'Filters books by the language detected in the parsed edition',
  })
  @IsOptional()
  @IsIn(['hy', 'ru', 'en'])
  language?: 'hy' | 'ru' | 'en';

  @ApiPropertyOptional({ description: 'Books.am category id, for example 7466' })
  @IsOptional()
  @Matches(/^\d+$/u)
  category?: string;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  available?: boolean;

  @ApiPropertyOptional({
    enum: ['popular', 'new', 'price-asc', 'price-desc', 'title'],
    default: 'new',
  })
  @IsOptional()
  @IsIn(['popular', 'new', 'price-asc', 'price-desc', 'title'])
  sort: 'popular' | 'new' | 'price-asc' | 'price-desc' | 'title' = 'new';

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 24, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 24;
}
