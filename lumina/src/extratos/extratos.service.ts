import {
  ConflictException,
  Injectable,
  NotImplementedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ImportExtratoDto } from './dto/import-extrato.dto';
import { EXTRATO_ERROR_CODES } from './types/extrato-errors';
import {
  PdfDecryptionService,
  PdfEncryptedError,
  PdfWrongPasswordError,
} from './pdf-decryption.service';

@Injectable()
export class ExtratosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly pdfDecryption: PdfDecryptionService,
  ) {}

  async import(
    clerkId: string,
    dto: ImportExtratoDto,
    fileBuffer: Buffer,
  ): Promise<never> {
    await this.decryptOrReject(fileBuffer, dto.password);

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

    throw new NotImplementedException(
      'IA extraction and persistence will be implemented in S7',
    );
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
}
