import { Controller, Get, Query } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListTransactionsQueryDto } from './dto/list-transactions.query';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  async list(
    @Query() query: ListTransactionsQueryDto,
    @CurrentUser() currentUser: { clerkId: string },
  ): Promise<{ data: Transaction[] }> {
    const transactions = await this.transactionsService.list(
      currentUser.clerkId,
      query,
    );
    return { data: transactions };
  }
}
