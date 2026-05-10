import { Injectable, NotFoundException } from '@nestjs/common';
import { Transaction } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ListTransactionsQueryDto } from './dto/list-transactions.query';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async list(
    clerkId: string,
    query: ListTransactionsQueryDto,
  ): Promise<Transaction[]> {
    const userId = await this.usersService.resolveUserId(clerkId);

    return this.prisma.transaction.findMany({
      where: {
        extrato: {
          userId,
          ...(query.mesAno ? { mesAno: query.mesAno } : {}),
          ...(query.banco ? { banco: query.banco } : {}),
        },
        ...(query.onlyUnreviewed === true ? { reviewed: false } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  async update(
    clerkId: string,
    transactionId: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const userId = await this.usersService.resolveUserId(clerkId);

    const result = await this.prisma.transaction.updateMany({
      where: { id: transactionId, extrato: { userId } },
      data: { category: dto.category, reviewed: true },
    });

    if (result.count === 0) {
      throw new NotFoundException('Transaction not found');
    }

    return this.prisma.transaction.findUniqueOrThrow({
      where: { id: transactionId },
    });
  }
}
