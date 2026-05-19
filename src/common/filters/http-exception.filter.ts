import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * Standard error envelope returned for every failed request.
 * Mirrors the shape documented in `context/code-standards.md`.
 * `code` is an optional extension carried over from domain
 * exceptions that expose a machine-readable code (e.g. the
 * `PDF_ENCRYPTED` / `WRONG_PASSWORD` 422s from Extratos).
 */
interface ErrorBody {
  error: string;
  message: string;
  statusCode: number;
  code?: string;
}

/** Status at/above which a failure is treated as a server error. */
const SERVER_ERROR_FLOOR = 500;

const STATUS_LABELS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
  [HttpStatus.BAD_GATEWAY]: 'Bad Gateway',
};

/**
 * Global exception filter. Normalizes every thrown error into the
 * standard `{ error, message, statusCode }` envelope and logs it.
 * Non-HTTP exceptions are reported as 500 with a generic message —
 * stack traces and internal details are logged server-side only,
 * never sent to the client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const body = this.buildBody(exception);

    if (body.statusCode >= SERVER_ERROR_FLOOR) {
      this.logger.error(
        `${request.method} ${request.url} ${body.statusCode} — ${body.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} ${body.statusCode} — ${body.message}`,
      );
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown): ErrorBody {
    if (!(exception instanceof HttpException)) {
      return {
        error: STATUS_LABELS[HttpStatus.INTERNAL_SERVER_ERROR],
        message: 'Internal server error',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    const statusCode = exception.getStatus();
    const fallbackLabel = STATUS_LABELS[statusCode] ?? 'Error';
    const res = exception.getResponse();

    if (typeof res === 'string') {
      return { error: fallbackLabel, message: res, statusCode };
    }

    const obj = res as Record<string, unknown>;
    const error = typeof obj.error === 'string' ? obj.error : fallbackLabel;
    const message = this.normalizeMessage(obj.message) ?? fallbackLabel;
    const code = typeof obj.code === 'string' ? obj.code : undefined;

    return { error, message, statusCode, ...(code ? { code } : {}) };
  }

  private normalizeMessage(raw: unknown): string | undefined {
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw.map(String).join('; ');
    return undefined;
  }
}
