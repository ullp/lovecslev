import { CHAIN_SEED } from './chain-seed';

describe('CHAIN_SEED (spec §4.2, D1)', () => {
  it('obsahuje všech 9 řetězců bez duplicit', () => {
    expect(CHAIN_SEED).toHaveLength(9);
    expect(new Set(CHAIN_SEED.map((chain) => chain.code)).size).toBe(9);
  });

  it('přesně 4 řetězce mají import cen v MVP', () => {
    const mvp = CHAIN_SEED.filter((chain) => chain.isMvp).map((chain) => chain.code);
    expect(mvp.sort()).toEqual(['ALBERT', 'BILLA', 'KAUFLAND', 'LIDL']);
  });

  it('Penny je aktivní, ale bez cen v MVP', () => {
    const penny = CHAIN_SEED.find((chain) => chain.code === 'PENNY');
    expect(penny?.isActive).toBe(true);
    expect(penny?.isMvp).toBe(false);
  });

  it('scraping není právně schválený ani u jednoho řetězce (právní gate D16)', () => {
    expect(CHAIN_SEED.every((chain) => chain.legalApproved === false)).toBe(true);
  });

  it('barvy jsou platné HEX a kódy velkými písmeny', () => {
    for (const chain of CHAIN_SEED) {
      expect(chain.colorHex).toMatch(/^#[0-9A-F]{6}$/);
      expect(chain.code).toBe(chain.code.toUpperCase());
      expect(chain.countryCode).toBe('CZ');
    }
  });
});
