/**
 * Číselník řetězců (spec §4.2, §9.2).
 * `isMvp = true` = řetězec má v MVP import cen (4 řetězce).
 * PENNY je v mapě, ale bez cen (Q/D1).
 * Barvy jsou orientační podklady pro mapové markery (D1) — nahradí je brand manuál.
 */
export interface ChainSeed {
  readonly code: string;
  readonly name: string;
  readonly countryCode: string;
  readonly colorHex: string;
  readonly isMvp: boolean;
  readonly isActive: boolean;
  /** Scraping povolen až po právním review (spec §14.5, D16). */
  readonly legalApproved: boolean;
}

export const CHAIN_SEED: readonly ChainSeed[] = [
  { code: 'LIDL', name: 'Lidl', countryCode: 'CZ', colorHex: '#0050AA', isMvp: true, isActive: true, legalApproved: false },
  { code: 'KAUFLAND', name: 'Kaufland', countryCode: 'CZ', colorHex: '#E10915', isMvp: true, isActive: true, legalApproved: false },
  { code: 'ALBERT', name: 'Albert', countryCode: 'CZ', colorHex: '#0F5EA8', isMvp: true, isActive: true, legalApproved: false },
  { code: 'BILLA', name: 'Billa', countryCode: 'CZ', colorHex: '#D5001C', isMvp: true, isActive: true, legalApproved: false },
  { code: 'PENNY', name: 'Penny Market', countryCode: 'CZ', colorHex: '#C8102E', isMvp: false, isActive: true, legalApproved: false },
  { code: 'TESCO', name: 'Tesco', countryCode: 'CZ', colorHex: '#00539F', isMvp: false, isActive: true, legalApproved: false },
  { code: 'GLOBUS', name: 'Globus', countryCode: 'CZ', colorHex: '#003C7D', isMvp: false, isActive: true, legalApproved: false },
  { code: 'COOP', name: 'Coop', countryCode: 'CZ', colorHex: '#E2001A', isMvp: false, isActive: true, legalApproved: false },
  { code: 'NORMA', name: 'Norma', countryCode: 'CZ', colorHex: '#003B71', isMvp: false, isActive: true, legalApproved: false },
];
