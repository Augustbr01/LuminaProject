import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TransactionsService } from './transactions.service';
import { createPrismaMock, PrismaMock } from '../../test/mocks/prisma.mock';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: PrismaMock;
  let usersService: { resolveUserId: jest.Mock };

  const clerkId = 'clerk_user_a';
  const userId = 'internal-user-uuid';

  const sampleTransactions = [
    {
      id: 'tx-2',
      extratoId: 'e-1',
      date: new Date('2026-04-15'),
      description: 'SALARIO',
      amount: '4800.00',
      type: 'credit',
      category: 'outro',
      confidence: '0.99',
      reviewed: false,
      createdAt: new Date('2026-04-30T12:00:00.000Z'),
      updatedAt: new Date('2026-04-30T12:00:00.000Z'),
    },
    {
      id: 'tx-1',
      extratoId: 'e-1',
      date: new Date('2026-04-03'),
      description: 'IFOOD CLUB',
      amount: '35.90',
      type: 'debit',
      category: 'alimentacao',
      confidence: '0.95',
      reviewed: false,
      createdAt: new Date('2026-04-30T12:00:00.000Z'),
      updatedAt: new Date('2026-04-30T12:00:00.000Z'),
    },
  ];

  beforeEach(async () => {
    prisma = createPrismaMock();
    usersService = { resolveUserId: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(TransactionsService);

    usersService.resolveUserId.mockResolvedValue(userId);
    prisma.transaction.findMany.mockResolvedValue(sampleTransactions);
  });

  it('scopes the query to the authenticated user via extrato.userId and orders by date desc', async () => {
    const result = await service.list(clerkId, {});

    expect(usersService.resolveUserId).toHaveBeenCalledWith(clerkId);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId } },
      orderBy: { date: 'desc' },
    });
    expect(result).toBe(sampleTransactions);
  });

  it('applies the mesAno filter to the nested extrato relation', async () => {
    await service.list(clerkId, { mesAno: '2026-04' });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId, mesAno: '2026-04' } },
      orderBy: { date: 'desc' },
    });
  });

  it('applies the banco filter to the nested extrato relation', async () => {
    await service.list(clerkId, { banco: 'nubank' });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId, banco: 'nubank' } },
      orderBy: { date: 'desc' },
    });
  });

  it('applies reviewed=false on the transaction itself when onlyUnreviewed=true', async () => {
    await service.list(clerkId, { onlyUnreviewed: true });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId }, reviewed: false },
      orderBy: { date: 'desc' },
    });
  });

  it('does NOT apply the reviewed filter when onlyUnreviewed=false', async () => {
    await service.list(clerkId, { onlyUnreviewed: false });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId } },
      orderBy: { date: 'desc' },
    });
  });

  it('combines mesAno, banco and onlyUnreviewed in a single where clause', async () => {
    await service.list(clerkId, {
      mesAno: '2026-04',
      banco: 'nubank',
      onlyUnreviewed: true,
    });

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        extrato: { userId, mesAno: '2026-04', banco: 'nubank' },
        reviewed: false,
      },
      orderBy: { date: 'desc' },
    });
  });

  it('never sources userId from the request — always resolved from clerkId', async () => {
    await service.list(clerkId, { mesAno: '2026-04', banco: 'nubank' });

    const calls = prisma.transaction.findMany.mock.calls as Array<
      [{ where: { extrato: { userId: string } } }]
    >;
    expect(calls[0][0].where.extrato.userId).toBe(userId);
  });

  it('propagates NotFoundException when the user does not exist', async () => {
    const notFound = new Error('User not found');
    usersService.resolveUserId.mockReset();
    usersService.resolveUserId.mockRejectedValue(notFound);

    await expect(service.list(clerkId, {})).rejects.toBe(notFound);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });
});
