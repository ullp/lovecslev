import type {
  LeafletRepository,
  LeafletWrite,
  StoredLeaflet,
  WriteResult,
} from '../../src/import/leaflet.repository';

interface StoredLeafletRow {
  id: string;
  chainId: string;
  validFrom: string;
  validTo: string;
  checksum: string;
  promotionCount: number;
}

const keyOf = (chainId: string, validFrom: string, validTo: string): string =>
  `${chainId}|${validFrom}|${validTo}`;

/**
 * In-memory náhrada repozitáře pro testy importu (spec §16 bod 1–4).
 * Simuluje idempotenci, replace i quarantine bez potřeby Postgresu.
 */
export class InMemoryLeafletRepository implements LeafletRepository {
  readonly chains = new Map<string, string>();

  private readonly leaflets = new Map<string, StoredLeafletRow>();
  private readonly products = new Set<string>();

  writeCount = 0;

  constructor(chainCodes: readonly string[] = ['ALBERT', 'BILLA', 'KAUFLAND', 'LIDL', 'PENNY']) {
    for (const code of chainCodes) {
      this.chains.set(code, `chain-${code.toLowerCase()}`);
    }
  }

  async listActiveChainCodes(): Promise<readonly string[]> {
    return [...this.chains.keys()].sort();
  }

  async findChainIdByCode(code: string): Promise<string | null> {
    return this.chains.get(code) ?? null;
  }

  async findLeaflet(chainId: string, validFrom: string, validTo: string): Promise<StoredLeaflet | null> {
    const row = this.leaflets.get(keyOf(chainId, validFrom, validTo));
    return row === undefined ? null : { id: row.id, checksum: row.checksum };
  }

  async countPromotionsOfPreviousLeaflet(chainId: string, beforeValidFrom: string): Promise<number> {
    const previous = [...this.leaflets.values()]
      .filter((row) => row.chainId === chainId && row.validFrom < beforeValidFrom)
      .sort((a, b) => (a.validFrom < b.validFrom ? 1 : -1))[0];
    return previous?.promotionCount ?? 0;
  }

  async replaceLeaflet(input: LeafletWrite): Promise<WriteResult> {
    this.writeCount += 1;

    let productsCreated = 0;
    for (const promotion of input.promotions) {
      const key = `${promotion.name}|${promotion.brand ?? ''}`;
      if (!this.products.has(key)) {
        this.products.add(key);
        productsCreated += 1;
      }
    }

    const key = keyOf(input.chainId, input.validFrom, input.validTo);
    const existing = this.leaflets.get(key);
    const row: StoredLeafletRow = {
      id: existing?.id ?? `leaflet-${this.leaflets.size + 1}`,
      chainId: input.chainId,
      validFrom: input.validFrom,
      validTo: input.validTo,
      checksum: input.checksum,
      promotionCount: input.promotions.length,
    };
    this.leaflets.set(key, row);

    return {
      leafletId: row.id,
      promotionsWritten: input.promotions.length,
      productsCreated,
    };
  }

  promotionCount(chainCode: string, validFrom: string, validTo: string): number {
    const chainId = this.chains.get(chainCode);
    if (chainId === undefined) return 0;
    return this.leaflets.get(keyOf(chainId, validFrom, validTo))?.promotionCount ?? 0;
  }

  get leafletCount(): number {
    return this.leaflets.size;
  }

  get productCount(): number {
    return this.products.size;
  }
}
