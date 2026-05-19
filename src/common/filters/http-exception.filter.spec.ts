import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

interface CapturedResponse {
  status: jest.Mock;
  json: jest.Mock;
}

function buildHost(): { host: ArgumentsHost; res: CapturedResponse } {
  const res: CapturedResponse = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const req = { method: 'GET', url: '/resource' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => req,
    }),
  } as unknown as ArgumentsHost;
  return { host, res };
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorLog: jest.SpyInstance;
  let warnLog: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    warnLog = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats a validation 400, joining the message array', () => {
    const { host, res } = buildHost();
    const exception = new BadRequestException({
      statusCode: 400,
      message: ['name should not be empty', 'property foo should not exist'],
      error: 'Bad Request',
    });

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Bad Request',
      message: 'name should not be empty; property foo should not exist',
      statusCode: 400,
    });
    expect(warnLog).toHaveBeenCalledTimes(1);
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('formats a 401 from a built-in exception', () => {
    const { host, res } = buildHost();

    filter.catch(
      new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED),
      host,
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Unauthorized',
      statusCode: 401,
    });
  });

  it('formats a 403 ForbiddenException', () => {
    const { host, res } = buildHost();

    filter.catch(new ForbiddenException(), host);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Forbidden',
      statusCode: 403,
    });
  });

  it('formats a 404 NotFoundException', () => {
    const { host, res } = buildHost();

    filter.catch(new NotFoundException('Usuário não encontrado'), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Usuário não encontrado',
      statusCode: 404,
    });
  });

  it('formats a 409 ConflictException', () => {
    const { host, res } = buildHost();

    filter.catch(new ConflictException('Extrato já existe'), host);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Conflict',
      message: 'Extrato já existe',
      statusCode: 409,
    });
  });

  it('preserves the domain `code` on a 422 with a custom payload', () => {
    const { host, res } = buildHost();

    filter.catch(
      new UnprocessableEntityException({
        code: 'PDF_ENCRYPTED',
        message: 'PDF está protegido por senha.',
      }),
      host,
    );

    expect(res.json).toHaveBeenCalledWith({
      error: 'Unprocessable Entity',
      message: 'PDF está protegido por senha.',
      statusCode: 422,
      code: 'PDF_ENCRYPTED',
    });
  });

  it('handles an HttpException whose response is a plain string', () => {
    const { host, res } = buildHost();

    filter.catch(new HttpException('teapot', 418), host);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Error',
      message: 'teapot',
      statusCode: 418,
    });
  });

  it('falls back to the status label when the payload has no message', () => {
    const { host, res } = buildHost();

    filter.catch(new HttpException({ foo: 'bar' }, HttpStatus.CONFLICT), host);

    expect(res.json).toHaveBeenCalledWith({
      error: 'Conflict',
      message: 'Conflict',
      statusCode: 409,
    });
  });

  it('maps a non-HTTP exception to a generic 500 and logs the stack', () => {
    const { host, res } = buildHost();
    const exception = new Error('database connection lost');

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Internal server error',
      statusCode: 500,
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    const stackArg = (errorLog.mock.calls[0] as unknown[])[1];
    expect(String(stackArg)).toContain('database connection lost');
    expect(warnLog).not.toHaveBeenCalled();
  });

  it('maps a non-Error thrown value to a generic 500 with no stack', () => {
    const { host, res } = buildHost();

    filter.catch('a bare string was thrown', host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Internal server error',
      statusCode: 500,
    });
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect((errorLog.mock.calls[0] as unknown[])[1]).toBeUndefined();
  });
});
