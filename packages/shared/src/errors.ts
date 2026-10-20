/**
 * Doménové chyby — kódy odpovídají API kontraktu (spec §13.4).
 * Doménová vrstva nesmí vyhazovat obecné Error; vždy DomainError s kódem.
 */
export type DomainErrorCode =
  | 'INVALID_UNIT'
  | 'INVALID_PRICE'
  | 'INVALID_QUANTITY'
  | 'INVALID_PACKAGE_AMOUNT'
  | 'INVALID_OPTIMIZER_INPUT'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'PLAN_LIMIT_REACHED'
  | 'PREMIUM_REQUIRED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(code: DomainErrorCode, message: string, details: Readonly<Record<string, unknown>> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
