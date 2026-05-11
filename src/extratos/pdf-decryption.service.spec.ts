import {
  PdfDecryptionService,
  PdfEncryptedError,
  PdfWrongPasswordError,
} from './pdf-decryption.service';

interface DecryptPayload {
  input: string;
  output?: string;
  password?: string;
}

const mockDecrypt = jest.fn<Promise<Buffer>, [DecryptPayload]>();
const mockInfo = jest.fn<
  Promise<string>,
  [{ input: string; password?: string }]
>();

jest.mock('node-qpdf2', () => ({
  __esModule: true,
  decrypt: (payload: DecryptPayload): Promise<Buffer> => mockDecrypt(payload),
  info: (payload: { input: string; password?: string }): Promise<string> =>
    mockInfo(payload),
}));

describe('PdfDecryptionService', () => {
  let service: PdfDecryptionService;

  beforeEach(() => {
    service = new PdfDecryptionService();
    mockDecrypt.mockReset();
    mockInfo.mockReset();
  });

  describe('ensureDecrypted', () => {
    const inputBuffer = Buffer.from('%PDF-1.4 fake content');

    it('returns the decrypted buffer when qpdf succeeds', async () => {
      const decrypted = Buffer.from('%PDF-1.4 decrypted content');
      mockDecrypt.mockResolvedValue(decrypted);

      const result = await service.ensureDecrypted(
        inputBuffer,
        'right-password',
      );

      expect(result).toBe(decrypted);
      expect(mockDecrypt).toHaveBeenCalledTimes(1);
      const call = mockDecrypt.mock.calls[0][0];
      expect(call.password).toBe('right-password');
      expect(call.input).toMatch(/lumina-pdf-/);
    });

    it('throws PdfEncryptedError when qpdf rejects with password error and no password was provided', async () => {
      mockDecrypt.mockRejectedValue('qpdf: input.pdf: invalid password\n');

      await expect(
        service.ensureDecrypted(inputBuffer, undefined),
      ).rejects.toBeInstanceOf(PdfEncryptedError);
    });

    it('throws PdfWrongPasswordError when qpdf rejects with password error and a password was provided', async () => {
      mockDecrypt.mockRejectedValue('qpdf: input.pdf: invalid password\n');

      await expect(
        service.ensureDecrypted(inputBuffer, 'wrong-password'),
      ).rejects.toBeInstanceOf(PdfWrongPasswordError);
    });

    it('preserves the underlying qpdf error as cause on PdfEncryptedError', async () => {
      const cause = 'qpdf: input.pdf: encrypted file requires a password\n';
      mockDecrypt.mockRejectedValue(cause);

      try {
        await service.ensureDecrypted(inputBuffer, undefined);
        fail('expected throw');
      } catch (err) {
        expect(err).toBeInstanceOf(PdfEncryptedError);
        expect((err as PdfEncryptedError).cause).toBe(cause);
      }
    });

    it('rethrows non-password errors unchanged', async () => {
      const cause = 'qpdf: input.pdf: file is damaged\n';
      mockDecrypt.mockRejectedValue(cause);

      await expect(service.ensureDecrypted(inputBuffer)).rejects.toBe(cause);
    });

    it('cleans up the temp dir even when decryption fails', async () => {
      let capturedInputPath: string | undefined;
      mockDecrypt.mockImplementation((payload) => {
        capturedInputPath = payload.input;
        // node-qpdf2 rejects with the raw stderr string (not an Error)
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject('qpdf: invalid password');
      });

      await expect(
        service.ensureDecrypted(inputBuffer, undefined),
      ).rejects.toBeInstanceOf(PdfEncryptedError);

      expect(capturedInputPath).toBeDefined();
      const { existsSync } = await import('node:fs');
      expect(existsSync(capturedInputPath!)).toBe(false);
    });
  });
});
