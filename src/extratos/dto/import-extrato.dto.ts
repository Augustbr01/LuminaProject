import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ImportExtratoDto {
  @IsString()
  @IsNotEmpty()
  banco!: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'mesAno must match the format YYYY-MM',
  })
  mesAno!: string;

  @IsString()
  @IsOptional()
  password?: string;
}
