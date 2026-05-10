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

describe('Dashboard (e2e) — GET /dashboard/summary', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  const clerkIdA = 'clerk_user_a';
  const clerkIdB = 'clerk_user_b';
  const userIdA = 'user-a-internal';
  const userIdB = 'user-b-internal';

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
    prisma.transaction.groupBy.mockReset();
    prisma.transaction.aggregate.mockReset();
  });

  it('returns 401 when no Authorization header is sent', async () => {
    await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-04' })
      .expect(401);

    expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });

  it('returns zeros and nulls when the month has no data', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const response = await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-04' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    const body = response.body as {
      data: {
        mesAno: string;
        totalGasto: number;
        categoriaMaior: unknown;
        variacaoVsMesAnterior: number | null;
        pieChart: unknown[];
      };
    };
    expect(body.data).toEqual({
      mesAno: '2026-04',
      totalGasto: 0,
      categoriaMaior: null,
      variacaoVsMesAnterior: null,
      pieChart: [],
    });
  });

  it('returns the full summary with pieChart percentuals summing to ~100', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });
    prisma.transaction.groupBy.mockResolvedValue([
      { category: 'alimentacao', _sum: { amount: '300.00' } },
      { category: 'transporte', _sum: { amount: '500.00' } },
      { category: 'moradia', _sum: { amount: '200.00' } },
    ]);
    prisma.transaction.aggregate.mockResolvedValue({
      _sum: { amount: '800.00' },
    });

    const response = await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-04' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    const body = response.body as {
      data: {
        mesAno: string;
        totalGasto: number;
        categoriaMaior: { categoria: string; valor: number };
        variacaoVsMesAnterior: number;
        pieChart: Array<{
          categoria: string;
          valor: number;
          percentual: number;
        }>;
      };
    };
    expect(body.data.mesAno).toBe('2026-04');
    expect(body.data.totalGasto).toBe(1000);
    expect(body.data.categoriaMaior).toEqual({
      categoria: 'transporte',
      valor: 500,
    });
    expect(body.data.variacaoVsMesAnterior).toBe(25);

    const sum = body.data.pieChart.reduce((acc, r) => acc + r.percentual, 0);
    expect(sum).toBeGreaterThanOrEqual(99.99);
    expect(sum).toBeLessThanOrEqual(100.01);
  });

  it('isolates dashboard summaries between two distinct users', async () => {
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

    prisma.transaction.groupBy.mockImplementation(
      (args: { where: { extrato: { userId: string } } }) => {
        if (args.where.extrato.userId === userIdA)
          return Promise.resolve([
            { category: 'alimentacao', _sum: { amount: '400.00' } },
          ]);
        if (args.where.extrato.userId === userIdB)
          return Promise.resolve([
            { category: 'transporte', _sum: { amount: '200.00' } },
          ]);
        return Promise.resolve([]);
      },
    );

    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const responseA = await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-04' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    const responseB = await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-04' })
      .set('Authorization', 'Bearer token.user.b')
      .expect(200);

    const bodyA = responseA.body as {
      data: {
        totalGasto: number;
        categoriaMaior: { categoria: string } | null;
      };
    };
    const bodyB = responseB.body as {
      data: {
        totalGasto: number;
        categoriaMaior: { categoria: string } | null;
      };
    };
    expect(bodyA.data.totalGasto).toBe(400);
    expect(bodyA.data.categoriaMaior?.categoria).toBe('alimentacao');
    expect(bodyB.data.totalGasto).toBe(200);
    expect(bodyB.data.categoriaMaior?.categoria).toBe('transporte');

    // Each groupBy call carried the correct userId; ownership never sourced
    // from the request.
    const groupByCalls = prisma.transaction.groupBy.mock.calls as Array<
      [{ where: { extrato: { userId: string } } }]
    >;
    const aggregateCalls = prisma.transaction.aggregate.mock.calls as Array<
      [{ where: { extrato: { userId: string } } }]
    >;
    const calledGroupByUserIds = groupByCalls.map(
      (c) => c[0].where.extrato.userId,
    );
    const calledAggregateUserIds = aggregateCalls.map(
      (c) => c[0].where.extrato.userId,
    );
    expect(calledGroupByUserIds).toEqual([userIdA, userIdB]);
    expect(calledAggregateUserIds).toEqual([userIdA, userIdB]);
  });

  it('forwards the banco filter to Prisma when provided (OQ-3)', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });
    prisma.transaction.groupBy.mockResolvedValue([]);
    prisma.transaction.aggregate.mockResolvedValue({ _sum: { amount: null } });

    await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-04', banco: 'nubank' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    expect(prisma.transaction.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          extrato: expect.objectContaining({
            userId: userIdA,
            mesAno: '2026-04',
            banco: 'nubank',
          }) as unknown,
        }) as unknown,
      }) as unknown,
    );
    expect(prisma.transaction.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          extrato: expect.objectContaining({
            userId: userIdA,
            mesAno: '2026-03',
            banco: 'nubank',
          }) as unknown,
        }) as unknown,
      }) as unknown,
    );
  });

  it('returns 400 when mesAno is malformed', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });

    await request(app.getHttpServer() as App)
      .get('/dashboard/summary')
      .query({ mesAno: '2026-13' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(400);

    expect(prisma.transaction.groupBy).not.toHaveBeenCalled();
    expect(prisma.transaction.aggregate).not.toHaveBeenCalled();
  });
});
