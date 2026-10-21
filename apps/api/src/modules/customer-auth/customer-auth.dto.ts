import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class CustomerLoginDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail({ allow_utf8_local_part: false }) @MaxLength(254)
  email!: string;

  @IsString() @MinLength(1) @MaxLength(128)
  password!: string;
}
export class CustomerRegisterDto extends CustomerLoginDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(2, 100)
  fullName!: string;

  @IsOptional() @IsIn(['hy', 'ru', 'en'])
  locale: 'hy' | 'ru' | 'en' = 'hy';
}
export class CustomerPasswordDto {
  @IsString() @MinLength(1) @MaxLength(128)
  currentPassword!: string;

  @IsString() @MinLength(15) @MaxLength(128)
  newPassword!: string;
}
