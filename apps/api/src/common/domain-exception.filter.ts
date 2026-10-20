import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '@slevari/shared';

/**
 * Mapuje doménové chyby na API kontrakt (spec §13.4, §13.5).
 * Doménová vrstva nesmí nic vědět o HTTP — mapování patří sem.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status = exception.code === 'NOT_FOUND' ? 404 : 400;

    response.status(status).json({
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      },
    });
  }
}
