import {
  BadGatewayException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { IaService } from '../ia/ia.service';
import { IaApiError, IaParseError } from '../ia/types/ia-errors';
import { ExtractedTransaction } from '../ia/types/extracted-transaction.schema';
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
  let iaService: { extractTransactions: jest.Mock };

  const clerkId = 'clerk_user_a';
  const userId = 'internal-user-uuid';
  const fileBuffer = Buffer.from('%PDF-1.4 raw');
  const decryptedBuffer = Buffer.from('%PDF-1.4 decrypted');
  const validDto = {
    banco: 'nubank',
    mesAno: '2026-04',
  };

  const sampleExtracted: ExtractedTransaction[] = [
    {
      date: '2026-04-03',
      description: 'IFOOD CLUB',
      amount: 35.9,
      type: 'debit',
      category: 'alimentacao',
      confidence: 0.95,
    },
    {
      date: '2026-04-15',
      description: 'SALARIO',
      amount: 4800,
      type: 'credit',
      category: 'outro',
      confidence: 0.99,
    },
  ];

  beforeEach(async () => {
    prisma = createPrismaMock();
    usersService = { resolveUserId: jest.fn() };
    pdfDecryption = { ensureDecrypted: jest.fn() };
    iaService = { extractTransactions: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExtratosService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: PdfDecryptionService, useValue: pdfDecryption },
        { provide: IaService, useValue: iaService },
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
      expect(iaService.extractTransactions).not.toHaveBeenCalled();
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
      expect(iaService.extractTransactions).not.toHaveBeenCalled();
    });

    it('rethrows unexpected decryption errors as-is (e.g. damaged file)', async () => {
      const unknown = new Error('qpdf: file is damaged');
      pdfDecryption.ensureDecrypted.mockRejectedValue(unknown);

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBe(unknown);
      expect(iaService.extractTransactions).not.toHaveBeenCalled();
    });
  });

  describe('duplicate check (runs before IA)', () => {
    beforeEach(() => {
      pdfDecryption.ensureDecrypted.mockResolvedValue(decryptedBuffer);
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
      expect(iaService.extractTransactions).not.toHaveBeenCalled();
    });
  });

  describe('happy path — IA + persistence', () => {
    const extratoId = 'extrato-uuid-1';
    const createdAt = new Date('2026-04-30T12:00:00.000Z');

    let txMock: PrismaMock;
    let createdTransactions: unknown[];

    beforeEach(() => {
      pdfDecryption.ensureDecrypted.mockResolvedValue(decryptedBuffer);
      usersService.resolveUserId.mockResolvedValue(userId);
      prisma.extrato.findUnique.mockResolvedValue(null);
      iaService.extractTransactions.mockResolvedValue(sampleExtracted);

      createdTransactions = sampleExtracted.map((t, idx) => ({
        id: `tx-${idx}`,
        extratoId,
        date: new Date(t.date),
        description: t.description,
        amount: t.amount,
        type: t.type,
        category: t.category,
        confidence: t.confidence,
        reviewed: false,
        createdAt,
        updatedAt: createdAt,
      }));

      txMock = createPrismaMock();
      txMock.extrato.create.mockResolvedValue({
        id: extratoId,
        banco: validDto.banco,
        mesAno: validDto.mesAno,
        createdAt,
      });
      txMock.transaction.createMany.mockResolvedValue({
        count: sampleExtracted.length,
      });
      txMock.transaction.findMany.mockResolvedValue(createdTransactions);

      prisma.$transaction.mockImplementation(
        async (cb: (tx: PrismaMock) => Promise<unknown>) => cb(txMock),
      );
    });

    it('calls the IA with the decrypted buffer, banco and mesAno (in that order)', async () => {
      await service.import(clerkId, { ...validDto }, fileBuffer);

      expect(iaService.extractTransactions).toHaveBeenCalledWith(
        decryptedBuffer,
        validDto.banco,
        validDto.mesAno,
      );
    });

    it('creates the extrato + transactions atomically inside prisma.$transaction', async () => {
      await service.import(clerkId, { ...validDto }, fileBuffer);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(txMock.extrato.create).toHaveBeenCalledWith({
        data: {
          userId,
          banco: validDto.banco,
          mesAno: validDto.mesAno,
        },
        select: { id: true, banco: true, mesAno: true, createdAt: true },
      });
      expect(txMock.transaction.createMany).toHaveBeenCalledWith({
        data: [
          {
            extratoId,
            date: new Date('2026-04-03'),
            description: 'IFOOD CLUB',
            amount: 35.9,
            type: 'debit',
            category: 'alimentacao',
            confidence: 0.95,
          },
          {
            extratoId,
            date: new Date('2026-04-15'),
            description: 'SALARIO',
            amount: 4800,
            type: 'credit',
            category: 'outro',
            confidence: 0.99,
          },
        ],
      });
      expect(txMock.transaction.findMany).toHaveBeenCalledWith({
        where: { extratoId },
        orderBy: { date: 'asc' },
      });
    });

    it('returns the persisted extrato + transactions', async () => {
      const result = await service.import(
        clerkId,
        { ...validDto },
        fileBuffer,
      );

      expect(result).toEqual({
        extrato: {
          id: extratoId,
          banco: validDto.banco,
          mesAno: validDto.mesAno,
          createdAt,
        },
        transactions: createdTransactions,
      });
    });

    it('skips the bulk insert when the IA returns zero transactions, but still creates the extrato', async () => {
      iaService.extractTransactions.mockResolvedValue([]);
      txMock.transaction.findMany.mockResolvedValue([]);

      const result = await service.import(
        clerkId,
        { ...validDto },
        fileBuffer,
      );

      expect(txMock.transaction.createMany).not.toHaveBeenCalled();
      expect(txMock.extrato.create).toHaveBeenCalledTimes(1);
      expect(result.transactions).toEqual([]);
    });
  });

  describe('failure paths after the duplicate check', () => {
    beforeEach(() => {
      pdfDecryption.ensureDecrypted.mockResolvedValue(decryptedBuffer);
      usersService.resolveUserId.mockResolvedValue(userId);
      prisma.extrato.findUnique.mockResolvedValue(null);
    });

    it('maps IaApiError to BadGatewayException (502) and persists nothing', async () => {
      iaService.extractTransactions.mockRejectedValue(
        new IaApiError('upstream 503', new Error('boom')),
      );

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('maps IaParseError to BadGatewayException (502) and persists nothing', async () => {
      iaService.extractTransactions.mockRejectedValue(
        new IaParseError('schema mismatch'),
      );

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBeInstanceOf(BadGatewayException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('rethrows unexpected IA errors as-is (not BadGatewayException)', async () => {
      const unknown = new Error('unexpected');
      iaService.extractTransactions.mockRejectedValue(unknown);

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBe(unknown);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('maps a P2002 race-condition during persistence to ConflictException (409)', async () => {
      iaService.extractTransactions.mockResolvedValue(sampleExtracted);
      const raceError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '6.0.0' },
      );
      prisma.$transaction.mockRejectedValue(raceError);

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('rethrows other Prisma errors during persistence as-is', async () => {
      iaService.extractTransactions.mockResolvedValue(sampleExtracted);
      const otherError = new Prisma.PrismaClientKnownRequestError(
        'Some other failure',
        { code: 'P2003', clientVersion: '6.0.0' },
      );
      prisma.$transaction.mockRejectedValue(otherError);

      await expect(
        service.import(clerkId, { ...validDto }, fileBuffer),
      ).rejects.toBe(otherError);
    });
  });
});
