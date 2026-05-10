import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { ExtratosController } from './extratos.controller';
import { ExtratosService } from './extratos.service';
import { PdfDecryptionService } from './pdf-decryption.service';

@Module({
  imports: [UsersModule],
  controllers: [ExtratosController],
  providers: [ExtratosService, PdfDecryptionService],
})
export class ExtratosModule {}
