import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { GoalsService } from './goals.service';
import { createPrismaMock, PrismaMock } from '../../test/mocks/prisma.mock';

describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: PrismaMock;
  let usersService: { resolveUserId: jest.Mock };

  const clerkId = 'clerk_user_a';
  const userId = 'internal-user-uuid';

  beforeEach(async () => {
    prisma = createPrismaMock();
    usersService = { resolveUserId: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        GoalsService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = moduleRef.get(GoalsService);
    usersService.resolveUserId.mockResolvedValue(userId);
  });

  describe('create', () => {
    const dto: CreateGoalDto = {
      name: 'Reserva de emergência',
      targetAmount: 10000,
      deadline: new Date('2027-01-01T00:00:00.000Z'),
    };

    it('persists the goal scoped to the resolved userId (never from the request)', async () => {
      prisma.goal.create.mockResolvedValue({
        id: 'goal-1',
        name: dto.name,
        targetAmount: '10000',
        deadline: dto.deadline,
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
      });

      const result = await service.create(clerkId, dto);

      expect(usersService.resolveUserId).toHaveBeenCalledWith(clerkId);
      const createCalls = prisma.goal.create.mock.calls as Array<
        [
          {
            data: {
              userId: string;
              name: string;
              targetAmount: number;
              deadline: Date;
            };
          },
        ]
      >;
      expect(createCalls[0][0].data).toEqual({
        userId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        deadline: dto.deadline,
      });
      expect(result).toEqual({
        id: 'goal-1',
        name: dto.name,
        targetAmount: 10000,
        deadline: dto.deadline,
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
      });
    });

    it('converts the Decimal targetAmount to a number in the response', async () => {
      prisma.goal.create.mockResolvedValue({
        id: 'goal-1',
        name: dto.name,
        targetAmount: '2500.50',
        deadline: dto.deadline,
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
      });

      const result = await service.create(clerkId, dto);

      expect(result.targetAmount).toBe(2500.5);
    });

    it('propagates NotFoundException when the user does not exist', async () => {
      const notFound = new Error('User not found');
      usersService.resolveUserId.mockReset();
      usersService.resolveUserId.mockRejectedValue(notFound);

      await expect(service.create(clerkId, dto)).rejects.toBe(notFound);
      expect(prisma.goal.create).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    type AggregateArgs = {
      where: { extrato: { userId: string }; date?: { gte: Date } };
      _max?: unknown;
    };

    /**
     * `transaction.aggregate` is hit twice in `list`: once for the user-level
     * monthly rate (no `_max`), once per goal for its contributions (with
     * `_max`). This routes each call by the presence of `_max`.
     */
    const stubAggregate = (
      rate: { _sum: { amount: string | null } },
      contributions: {
        _sum: { amount: string | null };
        _max: { date: Date | null };
      },
    ): void => {
      prisma.transaction.aggregate.mockImplementation((args: AggregateArgs) =>
        Promise.resolve(args._max ? contributions : rate),
      );
    };

    it('returns an empty array (and runs no progress queries) when the user has no goals', async () => {
      prisma.goal.findMany.mockResolvedValue([]);

      const result = await service.list(clerkId);

      expect(result).toEqual([]);
      expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
      expect(prisma.extrato.findMany).not.toHaveBeenCalled();
    });

    it('propagates NotFoundException when the user does not exist', async () => {
      const notFound = new Error('User not found');
      usersService.resolveUserId.mockReset();
      usersService.resolveUserId.mockRejectedValue(notFound);

      await expect(service.list(clerkId)).rejects.toBe(notFound);
      expect(prisma.goal.findMany).not.toHaveBeenCalled();
    });

    it('returns the goals scoped by userId, ordered by createdAt desc, without userId in the payload', async () => {
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta 1',
          targetAmount: '1000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
        },
      ]);
      prisma.extrato.findMany.mockResolvedValue([]);
      stubAggregate(
        { _sum: { amount: null } },
        { _sum: { amount: null }, _max: { date: null } },
      );

      const result = await service.list(clerkId);

      expect(usersService.resolveUserId).toHaveBeenCalledWith(clerkId);
      const findManyCalls = prisma.goal.findMany.mock.calls as Array<
        [{ where: { userId: string }; orderBy: { createdAt: string } }]
      >;
      expect(findManyCalls[0][0].where).toEqual({ userId });
      expect(findManyCalls[0][0].orderBy).toEqual({ createdAt: 'desc' });
      expect(result[0]).not.toHaveProperty('userId');
      expect(result[0].targetAmount).toBe(1000);
    });

    it('scopes every progress query to the resolved userId and the goal createdAt', async () => {
      const createdAt = new Date('2026-03-01T00:00:00.000Z');
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta',
          targetAmount: '1000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt,
        },
      ]);
      prisma.extrato.findMany.mockResolvedValue([{ mesAno: '2026-03' }]);
      stubAggregate(
        { _sum: { amount: '500' } },
        { _sum: { amount: '200' }, _max: { date: createdAt } },
      );

      await service.list(clerkId);

      const extratoCalls = prisma.extrato.findMany.mock.calls as Array<
        [{ where: { userId: string; transactions: { some: object } } }]
      >;
      expect(extratoCalls[0][0].where.userId).toBe(userId);
      expect(extratoCalls[0][0].where.transactions).toEqual({ some: {} });

      const aggCalls = prisma.transaction.aggregate.mock.calls as Array<
        [AggregateArgs]
      >;
      for (const [args] of aggCalls) {
        expect(args.where.extrato.userId).toBe(userId);
      }
      const contributionCall = aggCalls.find(([args]) => args._max);
      expect(contributionCall?.[0].where.date).toEqual({ gte: createdAt });
    });

    it('returns valorAcumulado 0, percentual 0 and previsao null when there is no history at all', async () => {
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta',
          targetAmount: '1000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ]);
      prisma.extrato.findMany.mockResolvedValue([]);
      stubAggregate(
        { _sum: { amount: null } },
        { _sum: { amount: null }, _max: { date: null } },
      );

      const result = await service.list(clerkId);

      expect(result[0].valorAcumulado).toBe(0);
      expect(result[0].percentual).toBe(0);
      expect(result[0].previsaoConclusao).toBeNull();
    });

    it('returns previsao null when months have transactions but none are investimento (rate zero)', async () => {
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta',
          targetAmount: '1000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
        },
      ]);
      prisma.extrato.findMany.mockResolvedValue([
        { mesAno: '2026-03' },
        { mesAno: '2026-04' },
        { mesAno: '2026-05' },
      ]);
      stubAggregate(
        { _sum: { amount: null } },
        { _sum: { amount: null }, _max: { date: null } },
      );

      const result = await service.list(clerkId);

      expect(result[0].valorAcumulado).toBe(0);
      expect(result[0].percentual).toBe(0);
      expect(result[0].previsaoConclusao).toBeNull();
    });

    it('forecasts a date even with 0 contributing transactions when the rate is positive', async () => {
      const createdAt = new Date('2026-05-01T00:00:00.000Z');
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta',
          targetAmount: '2000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt,
        },
      ]);
      // total 4000 over 2 distinct months → rate 2000/month.
      prisma.extrato.findMany.mockResolvedValue([
        { mesAno: '2026-03' },
        { mesAno: '2026-04' },
      ]);
      stubAggregate(
        { _sum: { amount: '4000' } },
        { _sum: { amount: null }, _max: { date: null } },
      );

      const result = await service.list(clerkId);

      expect(result[0].valorAcumulado).toBe(0);
      expect(result[0].percentual).toBe(0);
      // ceil(2000 / 2000) = 1 month after createdAt.
      expect(result[0].previsaoConclusao).toEqual(
        new Date('2026-06-01T00:00:00.000Z'),
      );
    });

    it('computes percentual and forecast for a goal in progress', async () => {
      const createdAt = new Date('2026-01-15T00:00:00.000Z');
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Reserva',
          targetAmount: '12000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt,
        },
      ]);
      // total 6000 over 3 distinct months (one duplicated) → rate 2000/month.
      prisma.extrato.findMany.mockResolvedValue([
        { mesAno: '2026-01' },
        { mesAno: '2026-01' },
        { mesAno: '2026-02' },
        { mesAno: '2026-03' },
      ]);
      stubAggregate(
        { _sum: { amount: '6000' } },
        {
          _sum: { amount: '3000' },
          _max: { date: new Date('2026-03-20T00:00:00.000Z') },
        },
      );

      const result = await service.list(clerkId);

      expect(result[0].valorAcumulado).toBe(3000);
      expect(result[0].percentual).toBe(25);
      // ceil((12000 - 3000) / 2000) = ceil(4.5) = 5 months after createdAt.
      expect(result[0].previsaoConclusao).toEqual(
        new Date('2026-06-15T00:00:00.000Z'),
      );
    });

    it('caps percentual at 100 and forecasts the last contributing transaction date when the goal is reached', async () => {
      const lastContribution = new Date('2026-04-20T10:00:00.000Z');
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta',
          targetAmount: '12000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]);
      prisma.extrato.findMany.mockResolvedValue([{ mesAno: '2026-01' }]);
      stubAggregate(
        { _sum: { amount: '15000' } },
        { _sum: { amount: '15000' }, _max: { date: lastContribution } },
      );

      const result = await service.list(clerkId);

      expect(result[0].valorAcumulado).toBe(15000);
      expect(result[0].percentual).toBe(100);
      expect(result[0].previsaoConclusao).toEqual(lastContribution);
    });
  });
});
