import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/configure-app';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createPrismaMock, PrismaMock } from './mocks/prisma.mock';

const mockVerifyToken = jest.fn<Promise<{ sub: string }>, unknown[]>();

jest.mock('@clerk/clerk-sdk-node', () => ({
  verifyToken: (...args: unknown[]): Promise<{ sub: string }> =>
    mockVerifyToken(...args),
}));

interface ErrorBody {
  error: string;
  message: string;
  statusCode: number;
}

describe('App (e2e) — health and error format', () => {
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
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockVerifyToken.mockReset();
    prisma.user.findUnique.mockReset();
  });

  describe('GET /health', () => {
    it('responds 200 with { status: ok } and no token required', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({ status: 'ok' });
      expect(mockVerifyToken).not.toHaveBeenCalled();
    });
  });

  describe('standardized error envelope', () => {
    it('returns the standard shape for a 401 (no token)', async () => {
      const response = await request(app.getHttpServer() as App)
        .get('/goals')
        .expect(401);

      const body = response.body as ErrorBody;
      expect(body).toEqual({
        error: 'Unauthorized',
        message: 'Unauthorized',
        statusCode: 401,
      });
    });

    it('returns 400 with a clear message when the body has extra fields', async () => {
      mockVerifyToken.mockResolvedValue({ sub: 'clerk_user_a' });

      const response = await request(app.getHttpServer() as App)
        .post('/goals')
        .set('Authorization', 'Bearer valid.token')
        .send({
          name: 'Reserva',
          targetAmount: 1000,
          deadline: '2027-01-01T00:00:00.000Z',
          bogusField: 'should be rejected',
        })
        .expect(400);

      const body = response.body as ErrorBody;
      expect(body.error).toBe('Bad Request');
      expect(body.statusCode).toBe(400);
      expect(body.message).toContain('bogusField');
    });

    it('returns the standard shape for a 404 (user not synced)', async () => {
      mockVerifyToken.mockResolvedValue({ sub: 'clerk_unknown' });
      prisma.user.findUnique.mockResolvedValue(null);

      const response = await request(app.getHttpServer() as App)
        .get('/goals')
        .set('Authorization', 'Bearer valid.token')
        .expect(404);

      const body = response.body as ErrorBody;
      expect(body).toEqual({
        error: 'Not Found',
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('returns a generic 500 (no stack trace) on an unexpected error', async () => {
      mockVerifyToken.mockResolvedValue({ sub: 'clerk_user_a' });
      prisma.user.findUnique.mockRejectedValue(
        new Error('database connection lost'),
      );

      const response = await request(app.getHttpServer() as App)
        .get('/goals')
        .set('Authorization', 'Bearer valid.token')
        .expect(500);

      const body = response.body as ErrorBody & { stack?: string };
      expect(body).toEqual({
        error: 'Internal Server Error',
        message: 'Internal server error',
        statusCode: 500,
      });
      expect(body.stack).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('database connection lost');
    });
  });
});
