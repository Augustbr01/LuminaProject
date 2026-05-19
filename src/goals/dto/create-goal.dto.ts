import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MinDate,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsPositive()
  targetAmount!: number;

  @Type(() => Date)
  @IsDate()
  @MinDate(() => new Date(), {
    message: 'deadline must be a future date',
  })
  deadline!: Date;
}
