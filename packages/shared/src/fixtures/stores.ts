/**
 * Referenční prodejny (spec F5, §9.3). Souřadnice jsou přibližné polohy poboček v Praze
 * pro demo/mapu; produkční data MUSÍ pocházet z licencovaného zdroje (Q1).
 */
export type StoreChainCode = 'LIDL' | 'ALBERT' | 'KAUFLAND' | 'BILLA' | 'PENNY';

export interface StoreSeed {
  readonly chainCode: StoreChainCode;
  readonly name: string;
  readonly address: string;
  readonly city: string;
  readonly zip: string;
  readonly latitude: number;
  readonly longitude: number;
}

export const STORE_SEED: readonly StoreSeed[] = [
  { chainCode: 'LIDL', name: 'Lidl Vodičkova', address: 'Vodičkova 30', city: 'Praha', zip: '11000', latitude: 50.081, longitude: 14.425 },
  { chainCode: 'LIDL', name: 'Lidl Dělnická', address: 'Dělnická 12', city: 'Praha', zip: '17000', latitude: 50.101, longitude: 14.439 },
  { chainCode: 'BILLA', name: 'Billa Národní', address: 'Národní 25', city: 'Praha', zip: '11000', latitude: 50.0825, longitude: 14.418 },
  { chainCode: 'BILLA', name: 'Billa Vinohradská', address: 'Vinohradská 60', city: 'Praha', zip: '13000', latitude: 50.0775, longitude: 14.452 },
  { chainCode: 'PENNY', name: 'Penny Seifertova', address: 'Seifertova 33', city: 'Praha', zip: '13000', latitude: 50.084, longitude: 14.443 },
  { chainCode: 'ALBERT', name: 'Albert Plzeňská', address: 'Plzeňská 8', city: 'Praha', zip: '15000', latitude: 50.0715, longitude: 14.398 },
  { chainCode: 'ALBERT', name: 'Albert Koněvova', address: 'Koněvova 100', city: 'Praha', zip: '13000', latitude: 50.087, longitude: 14.465 },
  { chainCode: 'KAUFLAND', name: 'Kaufland U nákladového nádraží', address: 'U nákladového nádraží 7', city: 'Praha', zip: '13000', latitude: 50.083, longitude: 14.462 },
  { chainCode: 'KAUFLAND', name: 'Kaufland Strakonická', address: 'Strakonická 140', city: 'Praha', zip: '15000', latitude: 50.047, longitude: 14.41 },
];
