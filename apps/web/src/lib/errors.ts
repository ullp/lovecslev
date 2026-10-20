import { ApiError } from './api';

/** Lidsky čitelná chyba pro UI — doménové kódy z API jsou pro uživatele nesrozumitelné. */
export function describeError(cause: unknown): string {
  if (cause instanceof ApiError) {
    switch (cause.code) {
      case 'PREMIUM_REQUIRED':
        return 'Tato funkce je dostupná v tarifu Premium.';
      case 'PLAN_LIMIT_REACHED':
        return 'Dosáhli jste limitu svého tarifu.';
      case 'UNAUTHORIZED':
        return 'Přihlaste se prosím znovu.';
      case 'NOT_FOUND':
        return 'Požadovaná položka neexistuje.';
      case 'VALIDATION_ERROR':
        return cause.message;
      default:
        return `${cause.message} (${cause.code})`;
    }
  }
  return cause instanceof Error ? cause.message : 'Neznámá chyba';
}
