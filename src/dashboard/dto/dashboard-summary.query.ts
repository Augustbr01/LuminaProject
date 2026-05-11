import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class DashboardSummaryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'mesAno must match the format YYYY-MM',
  })
  mesAno?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  banco?: string;
}
