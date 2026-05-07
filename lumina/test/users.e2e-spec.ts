import { INestApplication } from '@nestjs/common';
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

describe('Users (e2e) — POST /users/sync', () => {
  let app: INestApplication;
  let prisma: PrismaMock;

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
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockVerifyToken.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.create.mockReset();
  });

  it('returns 401 when no Authorization header is sent', async () => {
    await request(app.getHttpServer() as App)
      .post('/users/sync')
      .expect(401);
    expect(mockVerifyToken).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('returns 201 and persists the user on first call', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'clerk_user_a' });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'uuid-1',
      clerkId: 'clerk_user_a',
      createdAt: new Date('2026-05-07T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer() as App)
      .post('/users/sync')
      .set('Authorization', 'Bearer valid.token')
      .expect(201);

    expect(response.body).toEqual({
      data: {
        id: 'uuid-1',
        clerkId: 'clerk_user_a',
        createdAt: '2026-05-07T00:00:00.000Z',
      },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: { clerkId: 'clerk_user_a' },
      select: { id: true, clerkId: true, createdAt: true },
    });
  });

  it('returns 200 and the same record on subsequent calls (idempotent)', async () => {
    mockVerifyToken.mockResolvedValue({ sub: 'clerk_user_a' });
    const existing = {
      id: 'uuid-1',
      clerkId: 'clerk_user_a',
      createdAt: new Date('2026-05-07T00:00:00.000Z'),
    };
    prisma.user.findUnique.mockResolvedValue(existing);

    const response = await request(app.getHttpServer() as App)
      .post('/users/sync')
      .set('Authorization', 'Bearer valid.token')
      .expect(200);

    expect(response.body).toEqual({
      data: {
        id: 'uuid-1',
        clerkId: 'clerk_user_a',
        createdAt: '2026-05-07T00:00:00.000Z',
      },
    });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
