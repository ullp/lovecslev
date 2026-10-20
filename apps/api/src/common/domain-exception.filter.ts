import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError, type DomainErrorCode } from '@slevari/shared';

/** Mapování doménových kódů na HTTP statusy (spec §13.4). */
const STATUS_BY_CODE: Readonly<Partial<Record<DomainErrorCode, number>>> = {
  VALIDATION_ERROR: 400,
  INVALID_UNIT: 400,
  INVALID_PRICE: 400,
  INVALID_QUANTITY: 400,
  INVALID_PACKAGE_AMOUNT: 400,
  INVALID_OPTIMIZER_INPUT: 400,
  UNAUTHORIZED: 401,
  PREMIUM_REQUIRED: 403,
  PLAN_LIMIT_REACHED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

/**
 * Mapuje doménové chyby na API kontrakt (spec §13.4, §13.5).
 * Doménová vrstva nesmí nic vědět o HTTP — mapování patří sem.
 */
@Catch(DomainError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    const status = STATUS_BY_CODE[exception.code] ?? 500;

    response.status(status).json({
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
      },
    });
  }
}
