import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createPrismaMock, PrismaMock } from './mocks/prisma.mock';

const mockVerifyToken = jest.fn<Promise<{ sub: string }>, unknown[]>();

jest.mock('@clerk/clerk-sdk-node', () => ({
  verifyToken: (...args: unknown[]): Promise<{ sub: string }> =>
    mockVerifyToken(...args),
}));

describe('Goals (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  const clerkIdA = 'clerk_user_a';
  const clerkIdB = 'clerk_user_b';
  const userIdA = 'user-a-internal';
  const userIdB = 'user-b-internal';
  const futureDeadline = '2030-06-01T00:00:00.000Z';

  beforeAll(async () => {
    process.env.CLERK_SECRET_KEY = 'test_secret_key';
    prisma = createPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockVerifyToken.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.goal.create.mockReset();
    prisma.goal.findMany.mockReset();
    prisma.transaction.aggregate.mockReset();
    prisma.extrato.findMany.mockReset();
  });

  // `transaction.aggregate` is hit both for the user-level monthly rate
  // (no `_max`) and per goal for its contributions (with `_max`).
  const stubAggregate = (
    rate: { _sum: { amount: string | null } },
    contributions: {
      _sum: { amount: string | null };
      _max: { date: Date | null };
    },
  ): void => {
    prisma.transaction.aggregate.mockImplementation((args: { _max?: unknown }) =>
      Promise.resolve(args._max ? contributions : rate),
    );
  };

  describe('POST /goals', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      await request(app.getHttpServer() as App)
        .post('/goals')
        .send({ name: 'Meta', targetAmount: 1000, deadline: futureDeadline })
        .expect(401);

      expect(prisma.goal.create).not.toHaveBeenCalled();
    });

    it('creates a goal (201) persisted with the userId resolved from the token', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });
      prisma.goal.create.mockResolvedValue({
        id: 'goal-1',
        name: 'Reserva de emergência',
        targetAmount: '12000',
        deadline: new Date(futureDeadline),
        createdAt: new Date('2026-05-19T00:00:00.000Z'),
      });

      const response = await request(app.getHttpServer() as App)
        .post('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .send({
          name: 'Reserva de emergência',
          targetAmount: 12000,
          deadline: futureDeadline,
        })
        .expect(201);

      const body = response.body as { data: Record<string, unknown> };
      expect(body.data).toEqual({
        id: 'goal-1',
        name: 'Reserva de emergência',
        targetAmount: 12000,
        deadline: futureDeadline,
        createdAt: '2026-05-19T00:00:00.000Z',
      });

      const createCalls = prisma.goal.create.mock.calls as Array<
        [{ data: { userId: string } }]
      >;
      expect(createCalls[0][0].data.userId).toBe(userIdA);
    });

    it('returns 400 when the deadline is in the past', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });

      await request(app.getHttpServer() as App)
        .post('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .send({
          name: 'Meta',
          targetAmount: 1000,
          deadline: '2020-01-01T00:00:00.000Z',
        })
        .expect(400);

      expect(prisma.goal.create).not.toHaveBeenCalled();
    });

    it('returns 400 when targetAmount is zero or negative', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });

      await request(app.getHttpServer() as App)
        .post('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .send({ name: 'Meta', targetAmount: 0, deadline: futureDeadline })
        .expect(400);

      await request(app.getHttpServer() as App)
        .post('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .send({ name: 'Meta', targetAmount: -50, deadline: futureDeadline })
        .expect(400);

      expect(prisma.goal.create).not.toHaveBeenCalled();
    });

    it('returns 400 when name is empty', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });

      await request(app.getHttpServer() as App)
        .post('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .send({ name: '', targetAmount: 1000, deadline: futureDeadline })
        .expect(400);

      expect(prisma.goal.create).not.toHaveBeenCalled();
    });
  });

  describe('GET /goals', () => {
    it('returns 401 when no Authorization header is sent', async () => {
      await request(app.getHttpServer() as App)
        .get('/goals')
        .expect(401);

      expect(prisma.goal.findMany).not.toHaveBeenCalled();
    });

    it('returns the goals of the authenticated user enriched with progress fields', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });
      prisma.goal.findMany.mockResolvedValue([
        {
          id: 'g1',
          name: 'Meta A',
          targetAmount: '5000',
          deadline: new Date(futureDeadline),
          createdAt: new Date('2026-05-12T00:00:00.000Z'),
        },
      ]);
      // total 4000 over 2 distinct months → rate 2000/month.
      prisma.extrato.findMany.mockResolvedValue([
        { mesAno: '2026-04' },
        { mesAno: '2026-05' },
      ]);
      stubAggregate(
        { _sum: { amount: '4000' } },
        {
          _sum: { amount: '2500' },
          _max: { date: new Date('2026-05-20T00:00:00.000Z') },
        },
      );

      const response = await request(app.getHttpServer() as App)
        .get('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .expect(200);

      const body = response.body as { data: Array<Record<string, unknown>> };
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toEqual({
        id: 'g1',
        name: 'Meta A',
        targetAmount: 5000,
        deadline: futureDeadline,
        createdAt: '2026-05-12T00:00:00.000Z',
        valorAcumulado: 2500,
        percentual: 50,
        // ceil((5000 - 2500) / 2000) = 2 months after createdAt.
        previsaoConclusao: '2026-07-12T00:00:00.000Z',
      });
      expect(body.data[0]).not.toHaveProperty('userId');
    });

    it('isolates goals between two distinct users', async () => {
      mockVerifyToken.mockImplementation((token: unknown) => {
        if (token === 'token.user.a') return Promise.resolve({ sub: clerkIdA });
        if (token === 'token.user.b') return Promise.resolve({ sub: clerkIdB });
        return Promise.reject(new Error('unexpected token'));
      });

      prisma.user.findUnique.mockImplementation(
        (args: { where: { clerkId: string } }) => {
          if (args.where.clerkId === clerkIdA)
            return Promise.resolve({ id: userIdA });
          if (args.where.clerkId === clerkIdB)
            return Promise.resolve({ id: userIdB });
          return Promise.resolve(null);
        },
      );

      prisma.goal.findMany.mockImplementation(
        (args: { where: { userId: string } }) => {
          if (args.where.userId === userIdA)
            return Promise.resolve([
              {
                id: 'g1',
                name: 'A1',
                targetAmount: '100',
                deadline: new Date(futureDeadline),
                createdAt: new Date('2026-05-01T00:00:00.000Z'),
              },
              {
                id: 'g2',
                name: 'A2',
                targetAmount: '200',
                deadline: new Date(futureDeadline),
                createdAt: new Date('2026-05-02T00:00:00.000Z'),
              },
            ]);
          return Promise.resolve([]);
        },
      );

      prisma.extrato.findMany.mockResolvedValue([]);
      stubAggregate(
        { _sum: { amount: null } },
        { _sum: { amount: null }, _max: { date: null } },
      );

      const responseA = await request(app.getHttpServer() as App)
        .get('/goals')
        .set('Authorization', 'Bearer token.user.a')
        .expect(200);

      const responseB = await request(app.getHttpServer() as App)
        .get('/goals')
        .set('Authorization', 'Bearer token.user.b')
        .expect(200);

      const bodyA = responseA.body as { data: unknown[] };
      const bodyB = responseB.body as { data: unknown[] };
      expect(bodyA.data).toHaveLength(2);
      expect(bodyB.data).toHaveLength(0);

      // Each findMany call carried the correct userId resolved from the token —
      // ownership is never sourced from the request.
      const findManyCalls = prisma.goal.findMany.mock.calls as Array<
        [{ where: { userId: string } }]
      >;
      expect(findManyCalls.map((c) => c[0].where.userId)).toEqual([
        userIdA,
        userIdB,
      ]);
    });
  });
});
