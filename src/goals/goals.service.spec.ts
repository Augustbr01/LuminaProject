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
    it('returns the user goals scoped by userId, ordered by createdAt desc', async () => {
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta 1',
          targetAmount: '1000',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
        },
      ]);

      const result = await service.list(clerkId);

      expect(usersService.resolveUserId).toHaveBeenCalledWith(clerkId);
      const findManyCalls = prisma.goal.findMany.mock.calls as Array<
        [{ where: { userId: string }; orderBy: { createdAt: string } }]
      >;
      expect(findManyCalls[0][0].where).toEqual({ userId });
      expect(findManyCalls[0][0].orderBy).toEqual({ createdAt: 'desc' });
      expect(result).toEqual([
        {
          id: 'g1',
          name: 'Meta 1',
          targetAmount: 1000,
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
        },
      ]);
    });

    it('does not expose userId in the payload and converts targetAmount to a number', async () => {
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta',
          targetAmount: '999.99',
          deadline: new Date('2027-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-05-10T00:00:00.000Z'),
        },
      ]);

      const result = await service.list(clerkId);

      expect(result[0]).not.toHaveProperty('userId');
      expect(result[0].targetAmount).toBe(999.99);
    });

    it('returns an empty array when the user has no goals', async () => {
      prisma.goal.findMany.mockResolvedValue([]);

      const result = await service.list(clerkId);

      expect(result).toEqual([]);
    });

    it('propagates NotFoundException when the user does not exist', async () => {
      const notFound = new Error('User not found');
      usersService.resolveUserId.mockReset();
      usersService.resolveUserId.mockRejectedValue(notFound);

      await expect(service.list(clerkId)).rejects.toBe(notFound);
      expect(prisma.goal.findMany).not.toHaveBeenCalled();
    });
  });
});
