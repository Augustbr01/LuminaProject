import {
  BadGatewayException,
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Transaction } from '@prisma/client';
import { IaService } from '../ia/ia.service';
import { ExtractedTransaction } from '../ia/types/extracted-transaction.schema';
import { IaApiError, IaParseError } from '../ia/types/ia-errors';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ImportExtratoDto } from './dto/import-extrato.dto';
import { ListExtratosQueryDto } from './dto/list-extratos.query';
import { EXTRATO_ERROR_CODES } from './types/extrato-errors';
import {
  PdfDecryptionService,
  PdfEncryptedError,
  PdfWrongPasswordError,
} from './pdf-decryption.service';

export interface ImportExtratoResult {
  extrato: {
    id: string;
    banco: string;
    mesAno: string;
    createdAt: Date;
  };
  transactions: Transaction[];
}

export interface ExtratoListItem {
  id: string;
  banco: string;
  mesAno: string;
  createdAt: Date;
}

@Injectable()
export class ExtratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly pdfDecryption: PdfDecryptionService,
    private readonly iaService: IaService,
  ) {}

  async import(
    clerkId: string,
    dto: ImportExtratoDto,
    fileBuffer: Buffer,
  ): Promise<ImportExtratoResult> {
    const decryptedBuffer = await this.decryptOrReject(
      fileBuffer,
      dto.password,
    );

    const userId = await this.usersService.resolveUserId(clerkId);

    const existing = await this.prisma.extrato.findUnique({
      where: {
        userId_banco_mesAno: {
          userId,
          banco: dto.banco,
          mesAno: dto.mesAno,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Extrato já existe para este banco e mês');
    }

    const extracted = await this.callIa(decryptedBuffer, dto);

    return this.persist(userId, dto, extracted);
  }

  async list(
    clerkId: string,
    query: ListExtratosQueryDto,
  ): Promise<ExtratoListItem[]> {
    const userId = await this.usersService.resolveUserId(clerkId);

    return this.prisma.extrato.findMany({
      where: {
        userId,
        ...(query.mesAno ? { mesAno: query.mesAno } : {}),
        ...(query.banco ? { banco: query.banco } : {}),
      },
      select: { id: true, banco: true, mesAno: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async decryptOrReject(
    fileBuffer: Buffer,
    password: string | undefined,
  ): Promise<Buffer> {
    try {
      return await this.pdfDecryption.ensureDecrypted(fileBuffer, password);
    } catch (err) {
      if (err instanceof PdfEncryptedError) {
        throw new UnprocessableEntityException({
          code: EXTRATO_ERROR_CODES.PDF_ENCRYPTED,
          message:
            'PDF está protegido por senha. Informe a senha para continuar.',
        });
      }
      if (err instanceof PdfWrongPasswordError) {
        throw new UnprocessableEntityException({
          code: EXTRATO_ERROR_CODES.WRONG_PASSWORD,
          message: 'A senha informada está incorreta.',
        });
      }
      throw err;
    }
  }

  private async callIa(
    pdfBuffer: Buffer,
    dto: ImportExtratoDto,
  ): Promise<ExtractedTransaction[]> {
    try {
      return await this.iaService.extractTransactions(
        pdfBuffer,
        dto.banco,
        dto.mesAno,
      );
    } catch (err) {
      if (err instanceof IaApiError || err instanceof IaParseError) {
        throw new BadGatewayException(
          'Falha ao extrair transações do PDF. Tente novamente em instantes.',
        );
      }
      throw err;
    }
  }

  private async persist(
    userId: string,
    dto: ImportExtratoDto,
    extracted: ExtractedTransaction[],
  ): Promise<ImportExtratoResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const extrato = await tx.extrato.create({
          data: {
            userId,
            banco: dto.banco,
            mesAno: dto.mesAno,
          },
          select: { id: true, banco: true, mesAno: true, createdAt: true },
        });

        if (extracted.length > 0) {
          await tx.transaction.createMany({
            data: extracted.map((t) => ({
              extratoId: extrato.id,
              date: new Date(t.date),
              description: t.description,
              amount: t.amount,
              type: t.type,
              category: t.category,
              confidence: t.confidence,
            })),
          });
        }

        const transactions = await tx.transaction.findMany({
          where: { extratoId: extrato.id },
          orderBy: { date: 'asc' },
        });

        return { extrato, transactions };
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Extrato já existe para este banco e mês');
      }
      throw err;
    }
  }
}
