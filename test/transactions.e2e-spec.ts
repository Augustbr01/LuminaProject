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

describe('Transactions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

  const clerkIdA = 'clerk_user_a';
  const clerkIdB = 'clerk_user_b';
  const userIdA = 'user-a-internal';
  const userIdB = 'user-b-internal';

  const userATxs = [
    {
      id: 'tx-a-2',
      extratoId: 'e-a-1',
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
      id: 'tx-a-1',
      extratoId: 'e-a-1',
      date: new Date('2026-04-03'),
      description: 'IFOOD CLUB',
      amount: '35.90',
      type: 'debit',
      category: 'alimentacao',
      confidence: '0.95',
      reviewed: true,
      createdAt: new Date('2026-04-30T12:00:00.000Z'),
      updatedAt: new Date('2026-04-30T12:00:00.000Z'),
    },
  ];

  const userBTxs = [
    {
      id: 'tx-b-1',
      extratoId: 'e-b-1',
      date: new Date('2026-04-10'),
      description: 'UBER',
      amount: '24.50',
      type: 'debit',
      category: 'transporte',
      confidence: '0.92',
      reviewed: false,
      createdAt: new Date('2026-04-30T12:00:00.000Z'),
      updatedAt: new Date('2026-04-30T12:00:00.000Z'),
    },
  ];

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
    prisma.transaction.findMany.mockReset();
    prisma.transaction.updateMany.mockReset();
    prisma.transaction.findUniqueOrThrow.mockReset();
  });

  it('returns 401 when no Authorization header is sent', async () => {
    await request(app.getHttpServer() as App)
      .get('/transactions')
      .expect(401);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('returns only the authenticated user’s transactions (ownership isolation between two users)', async () => {
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

    prisma.transaction.findMany.mockImplementation(
      (args: { where: { extrato: { userId: string } } }) => {
        if (args.where.extrato.userId === userIdA)
          return Promise.resolve(userATxs);
        if (args.where.extrato.userId === userIdB)
          return Promise.resolve(userBTxs);
        return Promise.resolve([]);
      },
    );

    const responseA = await request(app.getHttpServer() as App)
      .get('/transactions')
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    const responseB = await request(app.getHttpServer() as App)
      .get('/transactions')
      .set('Authorization', 'Bearer token.user.b')
      .expect(200);

    const bodyA = responseA.body as { data: Array<{ id: string }> };
    const bodyB = responseB.body as { data: Array<{ id: string }> };
    const dataA = bodyA.data;
    const dataB = bodyB.data;

    expect(dataA.map((t) => t.id)).toEqual(['tx-a-2', 'tx-a-1']);
    expect(dataB.map((t) => t.id)).toEqual(['tx-b-1']);

    // No leakage between users.
    expect(dataA.some((t) => t.id.startsWith('tx-b-'))).toBe(false);
    expect(dataB.some((t) => t.id.startsWith('tx-a-'))).toBe(false);

    // Every findMany call carried the correct userId filter under extrato —
    // never sourced from the request.
    const findManyCalls = prisma.transaction.findMany.mock.calls as Array<
      [{ where: { extrato: { userId: string } } }]
    >;
    const calledUserIds = findManyCalls.map(
      (call) => call[0].where.extrato.userId,
    );
    expect(calledUserIds).toEqual([userIdA, userIdB]);
  });

  it('returns only unreviewed transactions when onlyUnreviewed=true', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });
    const unreviewed = userATxs.filter((t) => t.reviewed === false);
    prisma.transaction.findMany.mockResolvedValue(unreviewed);

    const response = await request(app.getHttpServer() as App)
      .get('/transactions')
      .query({ onlyUnreviewed: 'true' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId: userIdA }, reviewed: false },
      orderBy: { date: 'desc' },
    });
    const body = response.body as {
      data: Array<{ id: string; reviewed: boolean }>;
    };
    expect(body.data.map((t) => t.id)).toEqual(['tx-a-2']);
    expect(body.data.every((t) => t.reviewed === false)).toBe(true);
  });

  it('applies the mesAno filter to extrato', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });
    prisma.transaction.findMany.mockResolvedValue([]);

    await request(app.getHttpServer() as App)
      .get('/transactions')
      .query({ mesAno: '2026-04' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId: userIdA, mesAno: '2026-04' } },
      orderBy: { date: 'desc' },
    });
  });

  it('applies the banco filter to extrato', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });
    prisma.transaction.findMany.mockResolvedValue([]);

    await request(app.getHttpServer() as App)
      .get('/transactions')
      .query({ banco: 'nubank' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(200);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: { extrato: { userId: userIdA, banco: 'nubank' } },
      orderBy: { date: 'desc' },
    });
  });

  it('returns 400 when mesAno is malformed', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });

    await request(app.getHttpServer() as App)
      .get('/transactions')
      .query({ mesAno: '2026-13' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(400);

    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('returns 400 when onlyUnreviewed is not a valid boolean', async () => {
    mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
    prisma.user.findUnique.mockResolvedValue({ id: userIdA });

    await request(app.getHttpServer() as App)
      .get('/transactions')
      .query({ onlyUnreviewed: 'maybe' })
      .set('Authorization', 'Bearer token.user.a')
      .expect(400);

    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  describe('PATCH /transactions/:id', () => {
    const transactionId = 'tx-a-1';
    const updatedTx = {
      ...userATxs[1],
      category: 'transporte',
      reviewed: true,
      updatedAt: new Date('2026-05-10T12:00:00.000Z'),
    };

    it('returns 401 when no Authorization header is sent', async () => {
      await request(app.getHttpServer() as App)
        .patch(`/transactions/${transactionId}`)
        .send({ category: 'transporte' })
        .expect(401);
      expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    });

    it('updates category and sets reviewed=true, scoped to the user via extrato.userId', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });
      prisma.transaction.updateMany.mockResolvedValue({ count: 1 });
      prisma.transaction.findUniqueOrThrow.mockResolvedValue(updatedTx);

      const response = await request(app.getHttpServer() as App)
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', 'Bearer token.user.a')
        .send({ category: 'transporte' })
        .expect(200);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: transactionId, extrato: { userId: userIdA } },
        data: { category: 'transporte', reviewed: true },
      });

      const body = response.body as {
        data: { id: string; category: string; reviewed: boolean };
      };
      expect(body.data.id).toBe(transactionId);
      expect(body.data.category).toBe('transporte');
      expect(body.data.reviewed).toBe(true);
    });

    it('returns 404 when user B tries to edit a transaction owned by user A (no existence leak)', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdB });
      prisma.user.findUnique.mockResolvedValue({ id: userIdB });
      prisma.transaction.updateMany.mockResolvedValue({ count: 0 });

      await request(app.getHttpServer() as App)
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', 'Bearer token.user.b')
        .send({ category: 'transporte' })
        .expect(404);

      expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
        where: { id: transactionId, extrato: { userId: userIdB } },
        data: { category: 'transporte', reviewed: true },
      });
      expect(prisma.transaction.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it('returns 400 when category is not in the allowed enum', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });

      await request(app.getHttpServer() as App)
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', 'Bearer token.user.a')
        .send({ category: 'comida' })
        .expect(400);

      expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    });

    it('returns 400 when category is missing', async () => {
      mockVerifyToken.mockResolvedValue({ sub: clerkIdA });
      prisma.user.findUnique.mockResolvedValue({ id: userIdA });

      await request(app.getHttpServer() as App)
        .patch(`/transactions/${transactionId}`)
        .set('Authorization', 'Bearer token.user.a')
        .send({})
        .expect(400);

      expect(prisma.transaction.updateMany).not.toHaveBeenCalled();
    });
  });
});
