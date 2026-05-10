import {
  ConflictException,
  NotImplementedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ExtratosService } from './extratos.service';
import {
  PdfDecryptionService,
  PdfEncryptedError,
  PdfWrongPasswordError,
} from './pdf-decryption.service';
import { EXTRATO_ERROR_CODES } from './types/extrato-errors';
import { createPrismaMock, PrismaMock } from '../../test/mocks/prisma.mock';

describe('ExtratosService', () => {
  let service: ExtratosService;
  let prisma: PrismaMock;
  let usersService: { resolveUserId: jest.Mock };
  let pdfDecryption: { ensureDecrypted: jest.Mock };

  const clerkId = 'clerk_user_a';
  const userId = 'internal-user-uuid';
  const fileBuffer = Buffer.from('%PDF-1.4 raw');
  const validDto = {
    banco: 'nubank',
    mesAno: '2026-04',
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    usersService = { resolveUserId: jest.fn() };
    pdfDecryption = { ensureDecrypted: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExtratosService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: PdfDecryptionService, useValue: pdfDecryption },
      ],
    }).compile();

    service = moduleRef.get(ExtratosService);
  });

  describe('encryption flow (runs before duplicate check)', () => {
    it('throws 422 PDF_ENCRYPTED when the PDF is encrypted and no password is provided', async () => {
      pdfDecryption.ensureDecrypted.mockRejectedValue(new PdfEncryptedError());

      try {
        await service.import(clerkId, { ...validDto }, fileBuffer);
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const response = (err as UnprocessableEntityException).getResponse();
        expect(response).toMatchObject({
          code: EXTRATO_ERROR_CODES.PDF_ENCRYPTED,
        });
      }

      expect(usersService.resolveUserId).not.toHaveBeenCalled();
      expect(prisma.extrato.findUnique).not.toHaveBeenCalled();
    });

    it('throws 422 WRONG_PASSWORD when the password is incorrect', async () => {
      pdfDecryption.ensureDecrypted.mockRejectedValue(
        new PdfWrongPasswordError(),
      );

      try {
        await service.import(
          clerkId,
          { ...validDto, password: 'wrong' },
          fileBuffer,
        );
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(UnprocessableEntityException);
        const response = (err as UnprocessableEntityException).getResponse();
        expect(response).toMatchObject({
          code: EXTRATO_ERROR_CODES.WRONG_PASSWORD,
        });
      }

      expect(usersService.resolveUserId).not.toHaveBeenCalled();
      expect(prisma.extrato.findUnique).not.toHaveBeenCalled();
    });

    it('proceeds when password is correct and the PDF is decrypted', async () => {
      pdfDecryption.ensureDecrypted.mockResolvedValue(
        Buffer.from('%PDF-1.4 decrypted'),
      );
      usersService.resolveUserId.mockResolvedValue(userId);
      prisma.extrato.findUnique.mockResolvedValue(null);

      await expect(
        service.import(clerkId, { ...validDto, password: 'right' }, fileBuffer),
      ).rejects.toBeInstanceOf(NotImplementedException);

      expect(pdfDecryption.ensureDecrypted).toHaveBeenCalledWith(
        fileBuffer,
        'right',
      );
    });

    it('rethrows unexpected decryption errors as-is (e.g. damaged file)', async () => {
      const unknown = new Error('qpdf: file is damaged');
      pdfDecryption.ensureDecrypted.mockRejectedValue(unknown);

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBe(unknown);
    });
  });

  describe('duplicate check', () => {
    beforeEach(() => {
      pdfDecryption.ensureDecrypted.mockResolvedValue(fileBuffer);
      usersService.resolveUserId.mockResolvedValue(userId);
    });

    it('throws ConflictException when an extrato already exists for the same userId+banco+mesAno', async () => {
      prisma.extrato.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.extrato.findUnique).toHaveBeenCalledWith({
        where: {
          userId_banco_mesAno: {
            userId,
            banco: 'nubank',
            mesAno: '2026-04',
          },
        },
        select: { id: true },
      });
    });

    it('throws NotImplementedException (501) on the happy path — IA + persistence land in S7', async () => {
      prisma.extrato.findUnique.mockResolvedValue(null);

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });
  });
});
