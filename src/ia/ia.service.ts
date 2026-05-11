import Anthropic from '@anthropic-ai/sdk';
import { Inject, Injectable } from '@nestjs/common';
import { ANTHROPIC_CLIENT } from './ia.tokens';
import { buildExtractTransactionsPrompt } from './prompts/extract-transactions.prompt';
import {
  ExtractedTransaction,
  ExtractedTransactionsResponseSchema,
} from './types/extracted-transaction.schema';
import { IaApiError, IaParseError } from './types/ia-errors';

const MODEL = 'claude-haiku-4-5';
const MAX_TOKENS = 4096;

@Injectable()
export class IaService {
  constructor(@Inject(ANTHROPIC_CLIENT) private readonly client: Anthropic) {}

  async extractTransactions(
    pdfBuffer: Buffer,
    banco: string,
    mesAno: string,
  ): Promise<ExtractedTransaction[]> {
    const message = await this.callClaude(pdfBuffer, banco, mesAno);
    return this.parseResponse(message);
  }

  private async callClaude(
    pdfBuffer: Buffer,
    banco: string,
    mesAno: string,
  ): Promise<Anthropic.Messages.Message> {
    try {
      return await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBuffer.toString('base64'),
                },
              },
              {
                type: 'text',
                text: buildExtractTransactionsPrompt(banco, mesAno),
              },
            ],
          },
        ],
      });
    } catch (err) {
      throw new IaApiError('Claude API call failed', err);
    }
  }

  private parseResponse(
    message: Anthropic.Messages.Message,
  ): ExtractedTransaction[] {
    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new IaParseError('IA response has no text block');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(textBlock.text);
    } catch (err) {
      throw new IaParseError('IA response is not valid JSON', err);
    }

    const result = ExtractedTransactionsResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new IaParseError('IA response does not match schema', result.error);
    }
    return result.data.transactions;
  }
}
