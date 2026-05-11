import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ListTransactionsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'mesAno must match the format YYYY-MM',
  })
  mesAno?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  banco?: string;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean({ message: 'onlyUnreviewed must be "true" or "false"' })
  onlyUnreviewed?: boolean;
}
