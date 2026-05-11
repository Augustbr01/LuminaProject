import type Anthropic from '@anthropic-ai/sdk';
import { Test } from '@nestjs/testing';
import { IaService } from './ia.service';
import { ANTHROPIC_CLIENT } from './ia.tokens';
import { IaApiError, IaParseError } from './types/ia-errors';

type CreateMock = jest.Mock<
  Promise<Anthropic.Messages.Message>,
  [Anthropic.Messages.MessageCreateParamsNonStreaming]
>;
type MockAnthropic = { messages: { create: CreateMock } };

const buildMessage = (text: string): Anthropic.Messages.Message =>
  ({
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    container: null,
    content: [{ type: 'text', text, citations: null }],
    model: 'claude-haiku-4-5',
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  }) as unknown as Anthropic.Messages.Message;

const validTransaction = {
  date: '2026-04-15',
  description: 'IFOOD*RESTAURANTE',
  amount: 49.9,
  type: 'debit',
  category: 'alimentacao',
  confidence: 0.95,
};

describe('IaService', () => {
  let service: IaService;
  let mockClient: MockAnthropic;

  const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf bytes');
  const banco = 'Itau';
  const mesAno = '2026-04';

  beforeEach(async () => {
    mockClient = { messages: { create: jest.fn() as CreateMock } };

    const moduleRef = await Test.createTestingModule({
      providers: [
        IaService,
        { provide: ANTHROPIC_CLIENT, useValue: mockClient },
      ],
    }).compile();

    service = moduleRef.get(IaService);
  });

  describe('extractTransactions — happy path', () => {
    it('returns the typed array when the IA responds with valid JSON', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(JSON.stringify({ transactions: [validTransaction] })),
      );

      const result = await service.extractTransactions(
        pdfBuffer,
        banco,
        mesAno,
      );

      expect(result).toEqual([validTransaction]);
    });

    it('returns an empty array when the IA reports no transactions', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(JSON.stringify({ transactions: [] })),
      );

      const result = await service.extractTransactions(
        pdfBuffer,
        banco,
        mesAno,
      );

      expect(result).toEqual([]);
    });

    it('sends the PDF as a base64 document block, the prompt as text, and uses claude-haiku-4-5', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(JSON.stringify({ transactions: [] })),
      );

      await service.extractTransactions(pdfBuffer, banco, mesAno);

      expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
      const call = mockClient.messages.create.mock.calls[0][0];
      expect(call.model).toBe('claude-haiku-4-5');
      expect(call.max_tokens).toBeGreaterThan(0);
      expect(call.messages).toHaveLength(1);

      const userMessage = call.messages[0];
      expect(userMessage.role).toBe('user');
      const content = userMessage.content;
      if (typeof content === 'string') {
        throw new Error('Expected content to be an array of blocks');
      }
      expect(content).toHaveLength(2);

      const documentBlock = content[0];
      expect(documentBlock.type).toBe('document');
      if (documentBlock.type !== 'document') {
        throw new Error('Expected document block');
      }
      expect(documentBlock.source.type).toBe('base64');
      if (documentBlock.source.type !== 'base64') {
        throw new Error('Expected base64 source');
      }
      expect(documentBlock.source.media_type).toBe('application/pdf');
      expect(documentBlock.source.data).toBe(pdfBuffer.toString('base64'));

      const textBlock = content[1];
      expect(textBlock.type).toBe('text');
      if (textBlock.type !== 'text') {
        throw new Error('Expected text block');
      }
      expect(textBlock.text).toContain(banco);
      expect(textBlock.text).toContain(mesAno);
    });
  });

  describe('extractTransactions — IaParseError paths', () => {
    it('throws IaParseError when the response has no text block', async () => {
      const noTextMessage = {
        ...buildMessage(''),
        content: [],
      } as unknown as Anthropic.Messages.Message;
      mockClient.messages.create.mockResolvedValue(noTextMessage);

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when the text is not valid JSON', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage('not json at all }{'),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when a required field is missing', async () => {
      const broken = {
        transactions: [{ date: '2026-04-15', amount: 10, type: 'debit' }],
      };
      mockClient.messages.create.mockResolvedValue(
        buildMessage(JSON.stringify(broken)),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when confidence is greater than 1', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(
          JSON.stringify({
            transactions: [{ ...validTransaction, confidence: 1.5 }],
          }),
        ),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when confidence is negative', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(
          JSON.stringify({
            transactions: [{ ...validTransaction, confidence: -0.1 }],
          }),
        ),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when category is outside the allowed enum', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(
          JSON.stringify({
            transactions: [{ ...validTransaction, category: 'crypto' }],
          }),
        ),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when type is not debit or credit', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(
          JSON.stringify({
            transactions: [{ ...validTransaction, type: 'transfer' }],
          }),
        ),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when amount is negative', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(
          JSON.stringify({
            transactions: [{ ...validTransaction, amount: -10 }],
          }),
        ),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });

    it('throws IaParseError when date is not in YYYY-MM-DD format', async () => {
      mockClient.messages.create.mockResolvedValue(
        buildMessage(
          JSON.stringify({
            transactions: [{ ...validTransaction, date: '15/04/2026' }],
          }),
        ),
      );

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaParseError);
    });
  });

  describe('extractTransactions — IaApiError paths', () => {
    it('wraps SDK 5xx errors as IaApiError', async () => {
      const sdkError = new Error('500 Internal Server Error');
      mockClient.messages.create.mockRejectedValue(sdkError);

      await expect(
        service.extractTransactions(pdfBuffer, banco, mesAno),
      ).rejects.toBeInstanceOf(IaApiError);
    });

    it('preserves the original error as cause when wrapping', async () => {
      const sdkError = new Error('connection reset');
      mockClient.messages.create.mockRejectedValue(sdkError);

      try {
        await service.extractTransactions(pdfBuffer, banco, mesAno);
        fail('expected IaApiError to be thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(IaApiError);
        expect((err as IaApiError).cause).toBe(sdkError);
      }
    });
  });
});
