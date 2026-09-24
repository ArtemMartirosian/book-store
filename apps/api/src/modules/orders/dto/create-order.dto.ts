import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEmail,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { YEREVAN_DISTRICTS, type YerevanDistrict } from '../order.model';

const Trim = () => Transform(({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value,
);

export class CreateOrderItemDto {
  @ApiProperty({ format: 'uuid' })
  @Trim()
  @IsUUID()
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;
}

export class CustomerDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({ example: '+37499123456' })
  @Trim()
  @IsString()
  @Matches(/^\+?[0-9]{8,15}$/)
  phone!: string;

  @ApiPropertyOptional()
  @Trim()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
}

export class DeliveryAddressDto {
  @ApiProperty({ enum: ['YEREVAN'] })
  @IsIn(['YEREVAN'])
  city!: 'YEREVAN';

  @ApiProperty({ enum: YEREVAN_DISTRICTS })
  @IsIn([...YEREVAN_DISTRICTS])
  district!: YerevanDistrict;

  @ApiProperty({ minLength: 5, maxLength: 250 })
  @Trim()
  @IsString()
  @MinLength(5)
  @MaxLength(250)
  addressLine!: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  apartment?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  entrance?: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  floor?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ enum: ['hy', 'ru', 'en'], default: 'hy' })
  @IsOptional()
  @IsIn(['hy', 'ru', 'en'])
  locale: 'hy' | 'ru' | 'en' = 'hy';

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @IsObject({ each: true })
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @ApiProperty({
    description: 'Integer AMD total displayed to the customer before submitting the request',
    minimum: 1,
    maximum: Number.MAX_SAFE_INTEGER,
    example: 4200,
  })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  expectedTotalAmd!: number;

  @ApiProperty({
    description: 'Pricing rule version used to calculate the displayed total',
    example: 'amd-fixed-v1',
    minLength: 1,
    maxLength: 64,
  })
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  expectedPricingRuleVersion!: string;

  @ApiProperty({ type: CustomerDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: DeliveryAddressDto })
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => DeliveryAddressDto)
  delivery!: DeliveryAddressDto;

  @ApiProperty({ enum: ['CASH_ON_DELIVERY'], default: 'CASH_ON_DELIVERY' })
  @IsIn(['CASH_ON_DELIVERY'])
  paymentMethod!: 'CASH_ON_DELIVERY';

  @ApiProperty({
    description: 'Explicit confirmation that displayed availability is preliminary',
    example: true,
  })
  @IsBoolean()
  acceptsPreliminaryAvailability!: boolean;
}
