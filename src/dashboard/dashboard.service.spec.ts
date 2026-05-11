import { Test } from '@nestjs/testing';
import { Category, TransactionType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { DashboardService } from './dashboard.service';
import { createPrismaMock, PrismaMock } from '../../test/mocks/prisma.mock';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: PrismaMock;
  let usersService: { resolveUserId: jest.Mock };

  const clerkId = 'clerk_user_a';
  const userId = 'internal-user-uuid';

  beforeEach(async () => {
    prisma = createPrismaMock();
    usersService = { resolveUserId: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
    usersService.resolveUserId.mockResolvedValue(userId);
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });
  });

  describe('summary', () => {
    it('returns zeros when the requested month has no data', async () => {
      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(usersService.resolveUserId).toHaveBeenCalledWith(clerkId);
      expect(result).toEqual({
        mesAno: '2026-04',
        totalGasto: 0,
        categoriaMaior: null,
        variacaoVsMesAnterior: null,
        pieChart: [],
      });
    });

    it('scopes both queries to the authenticated user (userId never from request)', async () => {
      await service.summary(clerkId, { mesAno: '2026-04' });

      const groupByCalls = prisma.transaction.groupBy.mock.calls as Array<
        [{ where: { extrato: { userId: string } } }]
      >;
      const aggregateCalls = prisma.transaction.aggregate.mock.calls as Array<
        [{ where: { extrato: { userId: string } } }]
      >;
      expect(groupByCalls[0][0].where.extrato.userId).toBe(userId);
      expect(aggregateCalls[0][0].where.extrato.userId).toBe(userId);
    });

    it('filters by debit type and the requested mesAno in groupBy; previous mesAno in aggregate', async () => {
      await service.summary(clerkId, { mesAno: '2026-04' });

      expect(prisma.transaction.groupBy).toHaveBeenCalledWith({
        by: ['category'],
        where: {
          type: TransactionType.debit,
          extrato: { userId, mesAno: '2026-04' },
        },
        _sum: { amount: true },
      });
      expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: {
          type: TransactionType.debit,
          extrato: { userId, mesAno: '2026-03' },
        },
        _sum: { amount: true },
      });
    });

    it('applies the banco filter to both queries when provided', async () => {
      await service.summary(clerkId, { mesAno: '2026-04', banco: 'nubank' });

      const groupByCalls = prisma.transaction.groupBy.mock.calls as Array<
        [{ where: { extrato: { banco?: string } } }]
      >;
      const aggregateCalls = prisma.transaction.aggregate.mock.calls as Array<
        [{ where: { extrato: { banco?: string } } }]
      >;
      expect(groupByCalls[0][0].where.extrato.banco).toBe('nubank');
      expect(aggregateCalls[0][0].where.extrato.banco).toBe('nubank');
    });

    it('crosses the year boundary when computing previousMesAno for January', async () => {
      await service.summary(clerkId, { mesAno: '2026-01' });

      expect(prisma.transaction.aggregate).toHaveBeenCalledWith({
        where: {
          type: TransactionType.debit,
          extrato: { userId, mesAno: '2025-12' },
        },
        _sum: { amount: true },
      });
    });

    it('defaults mesAno to the current month when not provided', async () => {
      const now = new Date();
      const expectedMesAno = `${now.getUTCFullYear()}-${String(
        now.getUTCMonth() + 1,
      ).padStart(2, '0')}`;

      const result = await service.summary(clerkId, {});

      expect(result.mesAno).toBe(expectedMesAno);
      const calls = prisma.transaction.groupBy.mock.calls as Array<
        [{ where: { extrato: { mesAno: string } } }]
      >;
      expect(calls[0][0].where.extrato.mesAno).toBe(expectedMesAno);
    });

    it('returns pieChart with 100% for a single category', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: '480.50' } },
      ]);

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(result.totalGasto).toBe(480.5);
      expect(result.pieChart).toEqual([
        { categoria: Category.alimentacao, valor: 480.5, percentual: 100 },
      ]);
      expect(result.categoriaMaior).toEqual({
        categoria: Category.alimentacao,
        valor: 480.5,
      });
    });

    it('builds a pieChart whose percentuals sum to ~100 (within [99.99, 100.01]) for many categories', async () => {
      const equalShare = '100.00';
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: equalShare } },
        { category: Category.transporte, _sum: { amount: equalShare } },
        { category: Category.moradia, _sum: { amount: equalShare } },
        { category: Category.lazer, _sum: { amount: equalShare } },
        { category: Category.saude, _sum: { amount: equalShare } },
        { category: Category.assinaturas, _sum: { amount: equalShare } },
        { category: Category.compras, _sum: { amount: equalShare } },
      ]);

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      const sum = result.pieChart.reduce((acc, r) => acc + r.percentual, 0);
      expect(sum).toBeGreaterThanOrEqual(99.99);
      expect(sum).toBeLessThanOrEqual(100.01);
      expect(result.totalGasto).toBe(700);
    });

    it('marks the largest category as categoriaMaior even when not first in the list', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: '50.00' } },
        { category: Category.transporte, _sum: { amount: '300.00' } },
        { category: Category.moradia, _sum: { amount: '150.00' } },
      ]);

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(result.categoriaMaior).toEqual({
        categoria: Category.transporte,
        valor: 300,
      });
    });

    it('computes a positive variacaoVsMesAnterior when current month > previous', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: '1200.00' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: '1000.00' },
      });

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(result.variacaoVsMesAnterior).toBe(20);
    });

    it('computes a negative variacaoVsMesAnterior when current month < previous', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: '800.00' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: '1000.00' },
      });

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(result.variacaoVsMesAnterior).toBe(-20);
    });

    it('computes zero variacaoVsMesAnterior when current month equals previous', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: '500.00' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: '500.00' },
      });

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(result.variacaoVsMesAnterior).toBe(0);
    });

    it('returns variacaoVsMesAnterior null when previous month has no data (no division by zero)', async () => {
      prisma.transaction.groupBy.mockResolvedValue([
        { category: Category.alimentacao, _sum: { amount: '500.00' } },
      ]);
      prisma.transaction.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.summary(clerkId, { mesAno: '2026-04' });

      expect(result.variacaoVsMesAnterior).toBeNull();
    });

    it('propagates NotFoundException when the user does not exist', async () => {
      const notFound = new Error('User not found');
      usersService.resolveUserId.mockReset();
      usersService.resolveUserId.mockRejectedValue(notFound);

      await expect(
        service.summary(clerkId, { mesAno: '2026-04' }),
      ).rejects.toBe(notFound);
      expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
      expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
    });
  });
});
