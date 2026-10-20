import { DomainError } from '../errors';
import { assertMinor, formatCzk, sumMinor, toMinor } from '../money';

const NBSP = '\u00A0';

describe('money (spec §0.5, D8, §15.5)', () => {
  it('assertMinor přijme nezáporné celé haléře', () => {
    expect(() => assertMinor(0)).not.toThrow();
    expect(() => assertMinor(1990)).not.toThrow();
  });

  it('assertMinor odmítne desetinné číslo (float v penězích je chyba)', () => {
    expect(() => assertMinor(19.9)).toThrow(DomainError);
    expect(() => assertMinor(19.9)).toThrow(/haléřích/);
  });

  it('assertMinor odmítne zápornou hodnotu', () => {
    expect(() => assertMinor(-1)).toThrow(DomainError);
  });

  it('sumMinor sečte haléře bez plovoucí desetinné čárky', () => {
    expect(sumMinor([1990, 1990, 1990])).toBe(5970);
    expect(sumMinor([])).toBe(0);
    expect(() => sumMinor([1.5])).toThrow(DomainError);
  });

  it('toMinor převede koruny na haléře a zaokrouhlí', () => {
    expect(toMinor(19.9)).toBe(1990);
    expect(toMinor(129)).toBe(12900);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(() => toMinor(-5)).toThrow(DomainError);
  });

  it('formatCzk formátuje českou měnu', () => {
    expect(formatCzk(0)).toBe(`0,00${NBSP}Kč`);
    expect(formatCzk(1990)).toBe(`19,90${NBSP}Kč`);
    expect(formatCzk(64690)).toBe(`646,90${NBSP}Kč`);
    expect(formatCzk(123456789)).toBe(`1${NBSP}234${NBSP}567,89${NBSP}Kč`);
    expect(formatCzk(-1990)).toBe(`-19,90${NBSP}Kč`);
  });

  it('formatCzk odmítne necelé haléře', () => {
    expect(() => formatCzk(19.9)).toThrow(DomainError);
  });

  it('DomainError má výchozí prázdné details a kód', () => {
    const error = new DomainError('INVALID_PRICE', 'test');
    expect(error.code).toBe('INVALID_PRICE');
    expect(error.details).toEqual({});
    expect(error.name).toBe('DomainError');
    expect(error).toBeInstanceOf(Error);
  });
});
