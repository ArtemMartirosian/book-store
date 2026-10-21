import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { YEREVAN_DISTRICTS } from '../orders/order.model';

const Trim = () => Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value);
export class UpdateCustomerDto {
  @Trim() @IsString() @MinLength(2) @MaxLength(100)
  fullName!: string;

  @IsIn(['hy', 'ru', 'en'])
  locale!: string;
}
export class SaveCustomerAddressDto {
  @Trim() @IsString() @MinLength(1) @MaxLength(40)
  label!: string;

  @Trim() @IsString() @MinLength(2) @MaxLength(100)
  fullName!: string;

  @IsString() @MaxLength(30)
  phone!: string;

  @IsIn([...YEREVAN_DISTRICTS])
  district!: string;

  @Trim() @IsString() @MinLength(5) @MaxLength(200)
  addressLine!: string;

  @IsOptional() @IsBoolean()
  isDefault = false;
}
