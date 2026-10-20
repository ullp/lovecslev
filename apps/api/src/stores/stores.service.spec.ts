import { StoresService, DEFAULT_RADIUS_KM } from './stores.service';
import type { NearbyStoresQuery, StoreNearbyView, StoresRepository } from './stores.types';

class FakeStoresRepository implements StoresRepository {
  lastQuery: NearbyStoresQuery | null = null;

  constructor(private readonly result: readonly StoreNearbyView[]) {}

  async findNearby(query: NearbyStoresQuery): Promise<readonly StoreNearbyView[]> {
    this.lastQuery = query;
    return this.result;
  }
}

const STORE: StoreNearbyView = {
  id: 'store-1',
  name: 'Lidl Vodičkova',
  address: 'Vodičkova 30',
  city: 'Praha',
  chainCode: 'LIDL',
  chainName: 'Lidl',
  colorHex: '#0050AA',
  latitude: 50.081,
  longitude: 14.425,
  distanceMeters: 812,
  hasActiveLeaflet: true,
};

describe('StoresService (spec §5 F5)', () => {
  it('default radius 5 km a dnešní datum v Europe/Prague', async () => {
    const repository = new FakeStoresRepository([STORE]);
    const service = new StoresService(repository);

    const result = await service.nearby({ lat: 50.0755, lng: 14.4378 });

    expect(result).toEqual([STORE]);
    expect(repository.lastQuery).toMatchObject({ lat: 50.0755, lng: 14.4378, radiusKm: DEFAULT_RADIUS_KM });
    expect(repository.lastQuery?.activeOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('předá radiusKm i activeOn', async () => {
    const repository = new FakeStoresRepository([]);
    const service = new StoresService(repository);

    await service.nearby({ lat: 50.1, lng: 14.4, radiusKm: 10, activeOn: '2026-10-20' });

    expect(repository.lastQuery).toEqual({
      lat: 50.1,
      lng: 14.4,
      radiusKm: 10,
      activeOn: '2026-10-20',
    });
  });

  it('odmítne neplatné souřadnice a radius', async () => {
    const service = new StoresService(new FakeStoresRepository([]));

    await expect(service.nearby({ lat: 95, lng: 14.4 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.nearby({ lat: 50, lng: 200 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.nearby({ lat: 50, lng: 14, radiusKm: 0 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(service.nearby({ lat: 50, lng: 14, radiusKm: 26 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(service.nearby({ lat: Number.NaN, lng: 14 })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });
});
