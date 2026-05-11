import { Category } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateTransactionDto {
  @IsEnum(Category, {
    message: 'category must be one of the allowed values',
  })
  category!: Category;
}
