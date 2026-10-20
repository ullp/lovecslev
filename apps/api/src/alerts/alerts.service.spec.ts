import { AlertsService } from './alerts.service';
import type { AlertRecord } from './alerts.types';
import { InMemoryCatalogRepository } from '../../test/support/in-memory-catalog.repository';
import { InMemoryAlertRepository } from '../../test/support/in-memory-alerts.repositories';
import { ALERT_REPOSITORY } from './alerts.types';

function setup() {
  const alerts = new InMemoryAlertRepository();
  const catalog = new InMemoryCatalogRepository();
  const service = new AlertsService(alerts, catalog);
  return { service, alerts, catalog };
}

function seedMany(alerts: InMemoryAlertRepository, count: number, userId = 'user-1'): void {
  const seeds: Partial<AlertRecord>[] = [];
  for (let index = 0; index < count; index += 1) {
    seeds.push({ userId, productId: `prd_${index}`, targetUnitPriceMinor: 1000 + index });
  }
  alerts.seed(seeds);
}

describe('AlertsService (spec §6 P2, §7)', () => {
  it('vytvoří alert s produktem a prahem', async () => {
    const { service } = setup();
    const alert = await service.create('user-1', {
      productId: 'prd_mleko',
      targetUnitPriceMinor: 1900,
    });

    expect(alert).toMatchObject({
      userId: 'user-1',
      productId: 'prd_mleko',
      productName: 'Mléko polotučné',
      targetUnitPriceMinor: 1900,
      isActive: true,
    });
  });

  it('limit 20 aktivních alertů (PLAN_LIMITS.PREMIUM.maxAlerts)', async () => {
    const { service, alerts } = setup();
    seedMany(alerts, 20);

    await expect(
      service.create('user-1', { productId: 'prd_mleko', targetUnitPriceMinor: 1900 }),
    ).rejects.toMatchObject({ code: 'PLAN_LIMIT_REACHED' });
  });

  it('neexistující produkt = NOT_FOUND', async () => {
    const { service } = setup();
    await expect(
      service.create('user-1', { productId: 'prd_neexistuje', targetUnitPriceMinor: 1000 }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('neexistující řetězec = NOT_FOUND', async () => {
    const { service } = setup();
    await expect(
      service.create('user-1', {
        productId: 'prd_mleko',
        targetUnitPriceMinor: 1000,
        chainCode: 'TESCO',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('duplicitní alert (produkt + řetězec) = CONFLICT', async () => {
    const { service } = setup();
    await service.create('user-1', { productId: 'prd_mleko', targetUnitPriceMinor: 1900 });

    await expect(
      service.create('user-1', { productId: 'prd_mleko', targetUnitPriceMinor: 1800 }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('neplatný práh = VALIDATION_ERROR', async () => {
    const { service } = setup();
    await expect(
      service.create('user-1', { productId: 'prd_mleko', targetUnitPriceMinor: 0 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      service.create('user-1', { productId: 'prd_mleko', targetUnitPriceMinor: 10.5 }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('smazání cizího alertu = NOT_FOUND', async () => {
    const { service, alerts } = setup();
    const alert = await service.create('user-1', { productId: 'prd_mleko', targetUnitPriceMinor: 1900 });

    await expect(service.remove('user-2', alert.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.remove('user-1', alert.id)).resolves.toBeUndefined();
    expect(alerts.alerts).toHaveLength(0);
  });

  it('exportuje ALERT_REPOSITORY token (DI)', () => {
    expect(typeof ALERT_REPOSITORY).toBe('symbol');
  });
});
