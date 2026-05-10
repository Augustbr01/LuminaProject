import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import {
  PdfDecryptionService,
  PdfEncryptedError,
  PdfWrongPasswordError,
} from '../src/extratos/pdf-decryption.service';
import { IaService } from '../src/ia/ia.service';
import { createPrismaMock, PrismaMock } from './mocks/prisma.mock';

const mockVerifyToken = jest.fn<Promise<{ sub: string }>, unknown[]>();

jest.mock('@clerk/clerk-sdk-node', () => ({
  verifyToken: (...args: unknown[]): Promise<{ sub: string }> =>
    mockVerifyToken(...args),
}));

describe('Extratos (e2e) — POST /extratos', () => {
  let app: INestApplication;
  let prisma: PrismaMock;
  let pdfDecryption: { ensureDecrypted: jest.Mock };
  let iaService: { extractTransactions: jest.Mock };

  const clerkId = 'clerk_user_a';
  const internalUserId = 'internal-user-uuid';
  const validPdf = Buffer.from('%PDF-1.4 fake pdf content for tests');

  beforeAll(async () => {
    process.env.CLERK_SECRET_KEY = 'test_secret_key';
    prisma = createPrismaMock();
    pdfDecryption = { ensureDecrypted: jest.fn() };
    iaService = { extractTransactions: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PdfDecryptionService)
      .useValue(pdfDecryption)
      .overrideProvider(IaService)
      .useValue(iaService)
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
    prisma.extrato.findUnique.mockReset();
    prisma.$transaction.mockReset();
    pdfDecryption.ensureDecrypted.mockReset();
    iaService.extractTransactions.mockReset();
  });

  function authedRequest() {
    mockVerifyToken.mockResolvedValue({ sub: clerkId });
    prisma.user.findUnique.mockResolvedValue({ id: internalUserId });
    return request(app.getHttpServer() as App)
      .post('/extratos')
      .set('Authorization', 'Bearer valid.token');
  }

  it('returns 401 when no Authorization header is sent', async () => {
    await request(app.getHttpServer() as App)
      .post('/extratos')
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(401);

    expect(pdfDecryption.ensureDecrypted).not.toHaveBeenCalled();
    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 400 when no file is sent', async () => {
    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .expect(400);

    expect(pdfDecryption.ensureDecrypted).not.toHaveBeenCalled();
    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 400 when the file is not a PDF', async () => {
    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'extrato.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(pdfDecryption.ensureDecrypted).not.toHaveBeenCalled();
    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 400 when mesAno is malformed', async () => {
    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-13')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);

    expect(pdfDecryption.ensureDecrypted).not.toHaveBeenCalled();
    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 422 with code PDF_ENCRYPTED when the PDF needs a password', async () => {
    pdfDecryption.ensureDecrypted.mockRejectedValue(new PdfEncryptedError());

    const response = await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);

    expect(response.body).toMatchObject({ code: 'PDF_ENCRYPTED' });
    expect(prisma.extrato.findUnique).not.toHaveBeenCalled();
    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 422 with code WRONG_PASSWORD when the password is incorrect', async () => {
    pdfDecryption.ensureDecrypted.mockRejectedValue(
      new PdfWrongPasswordError(),
    );

    const response = await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .field('password', 'wrong')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(422);

    expect(response.body).toMatchObject({ code: 'WRONG_PASSWORD' });
    expect(prisma.extrato.findUnique).not.toHaveBeenCalled();
    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 409 when an extrato for the same banco+mesAno already exists', async () => {
    pdfDecryption.ensureDecrypted.mockResolvedValue(validPdf);
    prisma.extrato.findUnique.mockResolvedValue({ id: 'existing-id' });

    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(409);

    expect(iaService.extractTransactions).not.toHaveBeenCalled();
  });

  it('returns 502 when the IA call fails (extrato is not persisted)', async () => {
    const { IaApiError } = await import('../src/ia/types/ia-errors');
    pdfDecryption.ensureDecrypted.mockResolvedValue(validPdf);
    prisma.extrato.findUnique.mockResolvedValue(null);
    iaService.extractTransactions.mockRejectedValue(
      new IaApiError('IA upstream'),
    );

    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(502);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns 201 with the persisted extrato and transactions on the happy path', async () => {
    pdfDecryption.ensureDecrypted.mockResolvedValue(validPdf);
    prisma.extrato.findUnique.mockResolvedValue(null);
    iaService.extractTransactions.mockResolvedValue([
      {
        date: '2026-04-03',
        description: 'IFOOD CLUB',
        amount: 35.9,
        type: 'debit',
        category: 'alimentacao',
        confidence: 0.95,
      },
    ]);

    const extratoId = 'extrato-uuid-1';
    const createdAt = new Date('2026-04-30T12:00:00.000Z');
    const persistedTransaction = {
      id: 'tx-1',
      extratoId,
      date: new Date('2026-04-03'),
      description: 'IFOOD CLUB',
      amount: '35.90',
      type: 'debit',
      category: 'alimentacao',
      confidence: '0.95',
      reviewed: false,
      createdAt,
      updatedAt: createdAt,
    };

    prisma.$transaction.mockImplementation(
      async (cb: (tx: PrismaMock) => Promise<unknown>) => {
        const tx = createPrismaMock();
        tx.extrato.create.mockResolvedValue({
          id: extratoId,
          banco: 'nubank',
          mesAno: '2026-04',
          createdAt,
        });
        tx.transaction.createMany.mockResolvedValue({ count: 1 });
        tx.transaction.findMany.mockResolvedValue([persistedTransaction]);
        return cb(tx);
      },
    );

    const response = await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(iaService.extractTransactions).toHaveBeenCalledWith(
      validPdf,
      'nubank',
      '2026-04',
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      data: {
        extrato: { id: extratoId, banco: 'nubank', mesAno: '2026-04' },
        transactions: [
          {
            id: 'tx-1',
            description: 'IFOOD CLUB',
            type: 'debit',
            category: 'alimentacao',
            reviewed: false,
          },
        ],
      },
    });

    // Invariant 1 (PDF never lands in durable storage). The pdf bytes
    // are never passed to any prisma write — only the structured
    // extraction is. Walk every prisma model write call and assert.
    const allWriteCalls = [
      ...prisma.extrato.create.mock.calls,
      ...prisma.extrato.createMany.mock.calls,
      ...prisma.transaction.create.mock.calls,
      ...prisma.transaction.createMany.mock.calls,
    ];
    for (const call of allWriteCalls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toContain('%PDF-1.4');
    }
  });
});
