import { ApiError } from '../lib/api';
import { describeError } from '../lib/errors';
import { formatDate, formatQuantity, formatUnitPriceMinor } from '../lib/format';

describe('format (web)', () => {
  it('formatuje datum z ISO bez časové zóny', () => {
    expect(formatDate('2026-10-14')).toBe('14. 10. 2026');
    expect(formatDate('2026-01-05')).toBe('5. 1. 2026');
    expect(formatDate('nesmysl')).toBe('nesmysl');
  });

  it('formatuje množství v base jednotkách', () => {
    expect(formatQuantity(6000, 'ML')).toBe('6 l');
    expect(formatQuantity(750, 'ML')).toBe('750 ml');
    expect(formatQuantity(2000, 'G')).toBe('2 kg');
    expect(formatQuantity(250, 'G')).toBe('250 g');
    expect(formatQuantity(8, 'PCS')).toBe('8 ks');
  });

  it('jednotkovou cenu zobrazí s jednotkou', () => {
    expect(formatUnitPriceMinor(1990, 'Kč/l')).toContain('19,90');
    expect(formatUnitPriceMinor(17960, 'Kč/kg')).toContain('/ kg');
    expect(formatUnitPriceMinor(874, 'Kč/ks')).toContain('/ ks');
  });
});

describe('describeError', () => {
  it('přeloží známé doménové kódy do češtiny', () => {
    expect(describeError(new ApiError('PREMIUM_REQUIRED', 'x', 403))).toContain('Premium');
    expect(describeError(new ApiError('PLAN_LIMIT_REACHED', 'x', 403))).toContain('limitu');
    expect(describeError(new ApiError('UNAUTHORIZED', 'x', 401))).toContain('Přihlaste');
    expect(describeError(new ApiError('NOT_FOUND', 'x', 404))).toContain('neexistuje');
  });

  it('u neznámé chyby vrátí text', () => {
    expect(describeError(new Error('spadlo'))).toBe('spadlo');
    expect(describeError('cokoliv')).toBe('Neznámá chyba');
  });
});
