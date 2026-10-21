import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class RequestCodeDto {
  @IsString() @MaxLength(30)
  phone!: string;

  @IsOptional() @IsIn(['hy', 'ru', 'en'])
  locale: 'hy' | 'ru' | 'en' = 'hy';

  @IsOptional() @IsBoolean()
  link = false;
}

export class VerifyCodeDto {
  @IsUUID()
  challengeId!: string;

  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Matches(/^\d{6}$/u)
  code!: string;
}
