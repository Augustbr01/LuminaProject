import Anthropic from '@anthropic-ai/sdk';
import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { ANTHROPIC_CLIENT } from './ia.tokens';

@Module({
  providers: [
    IaService,
    {
      provide: ANTHROPIC_CLIENT,
      useFactory: (): Anthropic =>
        new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
    },
  ],
  exports: [IaService],
})
export class IaModule {}
