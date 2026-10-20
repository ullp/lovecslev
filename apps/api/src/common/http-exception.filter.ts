import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

const CODE_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

/**
 * Normalizuje chyby Nestu (ValidationPipe, NotFoundException…) na kontrakt §13.5,
 * aby klient dostával vždy `{ error: { code, message, details } }`.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const message =
      typeof payload === 'string'
        ? payload
        : ((payload as { message?: string | string[] }).message ??
          exception.message);

    response.status(status).json({
      error: {
        code: CODE_BY_STATUS[status] ?? 'HTTP_ERROR',
        message: Array.isArray(message) ? message.join('; ') : message,
        details: typeof payload === 'object' ? {} : {},
      },
    });
  }
}
