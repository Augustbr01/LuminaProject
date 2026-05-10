import {
  Body,
  Controller,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ImportExtratoDto } from './dto/import-extrato.dto';
import { ExtratosService, ImportExtratoResult } from './extratos.service';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

interface UploadedPdf {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

@Controller('extratos')
export class ExtratosController {
  constructor(private readonly extratosService: ExtratosService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_PDF_SIZE_BYTES }),
          new FileTypeValidator({
            fileType: 'application/pdf',
            fallbackToMimetype: true,
          }),
        ],
      }),
    )
    file: UploadedPdf,
    @Body() dto: ImportExtratoDto,
    @CurrentUser() currentUser: { clerkId: string },
  ): Promise<{ data: ImportExtratoResult }> {
    const result = await this.extratosService.import(
      currentUser.clerkId,
      dto,
      file.buffer,
    );
    return { data: result };
  }
}
