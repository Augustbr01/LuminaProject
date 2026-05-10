import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ListTransactionsQueryDto } from './dto/list-transactions.query';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
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

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
    @CurrentUser() currentUser: { clerkId: string },
  ): Promise<{ data: Transaction }> {
    const transaction = await this.transactionsService.update(
      currentUser.clerkId,
      id,
      dto,
    );
    return { data: transaction };
  }
}
