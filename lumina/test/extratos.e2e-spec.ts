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

  const clerkId = 'clerk_user_a';
  const internalUserId = 'internal-user-uuid';
  const validPdf = Buffer.from('%PDF-1.4 fake pdf content for tests');

  beforeAll(async () => {
    process.env.CLERK_SECRET_KEY = 'test_secret_key';
    prisma = createPrismaMock();
    pdfDecryption = { ensureDecrypted: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(PdfDecryptionService)
      .useValue(pdfDecryption)
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
    pdfDecryption.ensureDecrypted.mockReset();
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
  });

  it('returns 400 when no file is sent', async () => {
    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .expect(400);

    expect(pdfDecryption.ensureDecrypted).not.toHaveBeenCalled();
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
  });

  it('returns 501 on the happy path — IA + persistence land in S7', async () => {
    pdfDecryption.ensureDecrypted.mockResolvedValue(validPdf);
    prisma.extrato.findUnique.mockResolvedValue(null);

    await authedRequest()
      .field('banco', 'nubank')
      .field('mesAno', '2026-04')
      .attach('file', validPdf, {
        filename: 'extrato.pdf',
        contentType: 'application/pdf',
      })
      .expect(501);
  });
});
