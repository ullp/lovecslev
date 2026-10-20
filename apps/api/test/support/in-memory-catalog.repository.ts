import type { CatalogRepository, LeafletProductsQuery } from '../../src/catalog/catalog.repository';
import type {
  ChainView,
  LeafletDetail,
  LeafletSummary,
  OfferView,
  PriceHistoryRow,
  ProductRecord,
} from '../../src/catalog/catalog.types';

const CHAINS: readonly ChainView[] = [
  { id: 'chain-lidl', code: 'LIDL', name: 'Lidl', colorHex: '#0050AA', isMvp: true, hasActiveLeaflet: true },
  { id: 'chain-kaufland', code: 'KAUFLAND', name: 'Kaufland', colorHex: '#E10915', isMvp: true, hasActiveLeaflet: true },
  { id: 'chain-penny', code: 'PENNY', name: 'Penny Market', colorHex: '#C8102E', isMvp: false, hasActiveLeaflet: false },
];

const LEAFLETS: readonly LeafletSummary[] = [
  {
    id: 'leaflet-lidl',
    chainCode: 'LIDL',
    chainName: 'Lidl',
    colorHex: '#0050AA',
    title: 'Leták LIDL 2026-10-14 – 2026-10-20',
    validFrom: '2026-10-14',
    validTo: '2026-10-20',
    productCount: 5,
    promotionCount: 5,
    topDiscounts: [20, 17, 13],
  },
  {
    id: 'leaflet-kaufland',
    chainCode: 'KAUFLAND',
    chainName: 'Kaufland',
    colorHex: '#E10915',
    title: 'Leták KAUFLAND 2026-10-14 – 2026-10-20',
    validFrom: '2026-10-14',
    validTo: '2026-10-20',
    productCount: 6,
    promotionCount: 6,
    topDiscounts: [22],
  },
];

const LEAFLET_DETAIL: LeafletDetail = {
  id: 'leaflet-lidl',
  chainCode: 'LIDL',
  chainName: 'Lidl',
  title: 'Leták LIDL 2026-10-14 – 2026-10-20',
  validFrom: '2026-10-14',
  validTo: '2026-10-20',
  page: 1,
  pageSize: 20,
  total: 2,
  categories: ['Mléčné výrobky', 'Maso a ryby'],
  products: [
    {
      productId: 'prd_mleko',
      name: 'Mléko polotučné',
      brand: 'Madeta',
      category: 'Mléčné výrobky',
      priceMinor: 1990,
      regularPriceMinor: 2490,
      discountPercent: 20,
      unitPriceMinor: 1990,
      unitLabel: 'Kč/l',
      packageAmount: 1000,
      baseUnit: 'ML',
    },
    {
      productId: 'prd_kureci_prsa',
      name: 'Kuřecí prsa',
      brand: null,
      category: 'Maso a ryby',
      priceMinor: 12900,
      regularPriceMinor: 14900,
      discountPercent: 13,
      unitPriceMinor: 12900,
      unitLabel: 'Kč/kg',
      packageAmount: 1000,
      baseUnit: 'G',
    },
  ],
};

const OFFERS: ReadonlyMap<string, readonly OfferView[]> = new Map([
  [
    'prd_mleko',
    [
      {
        productId: 'prd_mleko',
        chainCode: 'LIDL',
        chainName: 'Lidl',
        colorHex: '#0050AA',
        priceMinor: 1990,
        regularPriceMinor: 2490,
        discountPercent: 20,
        unitPriceMinor: 1990,
        unitLabel: 'Kč/l',
        packageAmount: 1000,
        baseUnit: 'ML',
        pricingMode: 'PACKAGE',
        validFrom: '2026-10-14',
        validTo: '2026-10-20',
      },
      {
        productId: 'prd_mleko',
        chainCode: 'KAUFLAND',
        chainName: 'Kaufland',
        colorHex: '#E10915',
        priceMinor: 2790,
        regularPriceMinor: 2990,
        discountPercent: 7,
        unitPriceMinor: 2790,
        unitLabel: 'Kč/l',
        packageAmount: 1000,
        baseUnit: 'ML',
        pricingMode: 'PACKAGE',
        validFrom: '2026-10-14',
        validTo: '2026-10-20',
      },
    ],
  ],
  [
    'prd_maslo',
    [
      {
        productId: 'prd_maslo',
        chainCode: 'LIDL',
        chainName: 'Lidl',
        colorHex: '#0050AA',
        priceMinor: 5490,
        regularPriceMinor: 5990,
        discountPercent: 8,
        unitPriceMinor: 21960,
        unitLabel: 'Kč/kg',
        packageAmount: 250,
        baseUnit: 'G',
        pricingMode: 'PACKAGE',
        validFrom: '2026-10-14',
        validTo: '2026-10-20',
      },
      {
        productId: 'prd_maslo',
        chainCode: 'KAUFLAND',
        chainName: 'Kaufland',
        colorHex: '#E10915',
        priceMinor: 4490,
        regularPriceMinor: 5490,
        discountPercent: 18,
        unitPriceMinor: 17960,
        unitLabel: 'Kč/kg',
        packageAmount: 250,
        baseUnit: 'G',
        pricingMode: 'PACKAGE',
        validFrom: '2026-10-14',
        validTo: '2026-10-20',
      },
    ],
  ],
]);

/** In-memory katalog pro testy služby a e2e (bez DB). */
export class InMemoryCatalogRepository implements CatalogRepository {
  readonly calls: string[] = [];

  async listChains(): Promise<readonly ChainView[]> {
    this.calls.push('listChains');
    return CHAINS;
  }

  async listLeaflets(_activeOn: string, chainCode?: string): Promise<readonly LeafletSummary[]> {
    this.calls.push('listLeaflets');
    return chainCode === undefined ? LEAFLETS : LEAFLETS.filter((leaflet) => leaflet.chainCode === chainCode);
  }

  async getLeaflet(leafletId: string, query: LeafletProductsQuery): Promise<LeafletDetail | null> {
    this.calls.push('getLeaflet');
    if (leafletId !== 'leaflet-lidl') return null;

    const filtered =
      query.category === undefined
        ? LEAFLET_DETAIL.products
        : LEAFLET_DETAIL.products.filter((product) => product.category === query.category);
    const start = (query.page - 1) * query.pageSize;

    return {
      ...LEAFLET_DETAIL,
      page: query.page,
      pageSize: query.pageSize,
      total: filtered.length,
      products: filtered.slice(start, start + query.pageSize),
    };
  }

  async findOffers(productIds: readonly string[]): Promise<ReadonlyMap<string, readonly OfferView[]>> {
    this.calls.push('findOffers');
    const result = new Map<string, readonly OfferView[]>();
    for (const productId of productIds) {
      const offers = OFFERS.get(productId);
      if (offers !== undefined) result.set(productId, offers);
    }
    return result;
  }

  async findProduct(productId: string): Promise<ProductRecord | null> {
    this.calls.push('findProduct');
    const product = PRODUCTS.find((entry) => entry.productId === productId);
    return product ?? null;
  }

  async findChainByCode(code: string): Promise<{ id: string; code: string } | null> {
    this.calls.push('findChainByCode');
    const chain = CHAINS.find((entry) => entry.code === code);
    return chain === undefined ? null : { id: chain.id, code: chain.code };
  }

  async findPriceHistory(productId: string, from: string, to: string): Promise<readonly PriceHistoryRow[]> {
    this.calls.push('findPriceHistory');
    return HISTORY.filter((row) => row.productId === productId && row.date >= from && row.date <= to);
  }
}

interface HistoryRow extends PriceHistoryRow {
  readonly productId: string;
}

const HISTORY: readonly HistoryRow[] = [
  { productId: 'prd_mleko', date: '2026-08-01', chainCode: 'LIDL', chainName: 'Lidl', priceMinor: 2190, unitPriceMinor: 2190, packageAmount: 1000, baseUnit: 'ML', granularity: 'daily' },
  { productId: 'prd_mleko', date: '2026-09-01', chainCode: 'LIDL', chainName: 'Lidl', priceMinor: 1990, unitPriceMinor: 1990, packageAmount: 1000, baseUnit: 'ML', granularity: 'daily' },
  { productId: 'prd_mleko', date: '2026-09-01', chainCode: 'KAUFLAND', chainName: 'Kaufland', priceMinor: 2790, unitPriceMinor: 2790, packageAmount: 1000, baseUnit: 'ML', granularity: 'daily' },
  { productId: 'prd_mleko', date: '2026-10-01', chainCode: 'LIDL', chainName: 'Lidl', priceMinor: 3990, unitPriceMinor: 1995, packageAmount: 2000, baseUnit: 'ML', granularity: 'daily' },
];

const PRODUCTS: readonly ProductRecord[] = [
  { productId: 'prd_mleko', name: 'Mléko polotučné', brand: 'Madeta', category: 'Mléčné výrobky', baseUnit: 'ML' },
  { productId: 'prd_maslo', name: 'Máslo', brand: 'Madeta', category: 'Mléčné výrobky', baseUnit: 'G' },
  { productId: 'prd_kureci_prsa', name: 'Kuřecí prsa', brand: null, category: 'Maso a ryby', baseUnit: 'G' },
];
