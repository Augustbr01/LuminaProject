import { Injectable } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class PdfEncryptedError extends Error {
  override readonly cause?: unknown;
  constructor(cause?: unknown) {
    super('PDF is encrypted; password required');
    this.name = 'PdfEncryptedError';
    this.cause = cause;
  }
}

export class PdfWrongPasswordError extends Error {
  override readonly cause?: unknown;
  constructor(cause?: unknown) {
    super('PDF password is incorrect');
    this.name = 'PdfWrongPasswordError';
    this.cause = cause;
  }
}

type DecryptFn = (payload: {
  input: string;
  output?: string;
  password?: string;
}) => Promise<Buffer>;

@Injectable()
export class PdfDecryptionService {
  async ensureDecrypted(pdfBuffer: Buffer, password?: string): Promise<Buffer> {
    const { decrypt } = (await import('node-qpdf2')) as { decrypt: DecryptFn };
    const dir = await mkdtemp(join(tmpdir(), 'lumina-pdf-'));
    const inputPath = join(dir, 'input.pdf');

    try {
      await writeFile(inputPath, pdfBuffer);
      return await decrypt({ input: inputPath, password });
    } catch (err) {
      if (this.isPasswordError(err)) {
        throw password
          ? new PdfWrongPasswordError(err)
          : new PdfEncryptedError(err);
      }
      throw err;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private isPasswordError(err: unknown): boolean {
    const msg = String(err).toLowerCase();
    return (
      msg.includes('invalid password') ||
      msg.includes('encrypted') ||
      msg.includes('password')
    );
  }
}
