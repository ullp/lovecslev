import { AlertEvaluationService } from './alert-evaluation.service';
import type { AlertRecord } from './alerts.types';
import { InMemoryCatalogRepository } from '../../test/support/in-memory-catalog.repository';
import {
  InMemoryAlertRepository,
  InMemoryPushTokenRepository,
  RecordingNotifier,
} from '../../test/support/in-memory-alerts.repositories';

const NOW = new Date('2026-10-20T12:00:00Z');
const ACTIVE_ON = '2026-10-20';

function setup(alerts: readonly Partial<AlertRecord>[] = [{}]) {
  const alertRepo = new InMemoryAlertRepository();
  alertRepo.seed(alerts);
  const pushTokens = new InMemoryPushTokenRepository();
  const catalog = new InMemoryCatalogRepository();
  const notifier = new RecordingNotifier();
  const service = new AlertEvaluationService(alertRepo, pushTokens, catalog, notifier);
  return { service, alertRepo, pushTokens, catalog, notifier };
}

describe('AlertEvaluationService (spec §6 P2)', () => {
  it('upozorní, když je cena pod prahem — push na registrovaná zařízení', async () => {
    const { service, alertRepo, pushTokens, notifier } = setup([
      { productId: 'prd_mleko', targetUnitPriceMinor: 2000 },
    ]);
    await pushTokens.upsert('user-1', 'ExponentPushToken[abc]', 'IOS');

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report).toMatchObject({ evaluated: 1, notified: 1, skipped: 0, failed: 0 });
    expect(notifier.pushes[0]?.tokens).toEqual(['ExponentPushToken[abc]']);
    expect(notifier.pushes[0]?.message.body).toContain('Lidl');
    expect(alertRepo.notified).toEqual([{ alertId: alertRepo.alerts[0]!.id, unitPriceMinor: 1990 }]);
  });

  it('cena nad prahem = skip ABOVE_TARGET', async () => {
    const { service, notifier } = setup([{ productId: 'prd_mleko', targetUnitPriceMinor: 1500 }]);

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report).toMatchObject({ notified: 0, skipped: 1 });
    expect(report.details[0]?.reason).toBe('ABOVE_TARGET');
    expect(notifier.pushes).toHaveLength(0);
  });

  it('do 24 h od posledního upozornění se neposílá znovu', async () => {
    const { service, notifier } = setup([
      {
        productId: 'prd_mleko',
        targetUnitPriceMinor: 2000,
        lastNotifiedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        lastNotifiedUnitPriceMinor: 2010,
      },
    ]);

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report.details[0]?.reason).toBe('THROTTLED');
    expect(notifier.pushes).toHaveLength(0);
  });

  it('stejná nebo vyšší cena než poslední upozornění = NOT_NEW_MINIMUM', async () => {
    const { service } = setup([
      {
        productId: 'prd_mleko',
        targetUnitPriceMinor: 2000,
        lastNotifiedAt: new Date(NOW.getTime() - 48 * 60 * 60 * 1000),
        lastNotifiedUnitPriceMinor: 1990,
      },
    ]);

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report.details[0]?.reason).toBe('NOT_NEW_MINIMUM');
  });

  it('bez push tokenu použije e-mail fallback', async () => {
    const { service, notifier, alertRepo } = setup([
      { productId: 'prd_mleko', targetUnitPriceMinor: 2000, userEmail: 'domacnost@test.cz' },
    ]);

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report.notified).toBe(1);
    expect(notifier.emails[0]?.to).toBe('domacnost@test.cz');
    expect(notifier.emails[0]?.subject).toContain('Mléko');
    expect(alertRepo.notified).toHaveLength(1);
  });

  it('když selže push i e-mail, alert se neoznačí a reportuje failed', async () => {
    const { service, notifier, alertRepo } = setup([{ productId: 'prd_mleko', targetUnitPriceMinor: 2000 }]);
    notifier.pushResult = false;
    notifier.emailResult = false;

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report).toMatchObject({ notified: 0, failed: 1 });
    expect(report.details[0]?.reason).toBe('NOT_DELIVERED');
    expect(alertRepo.notified).toHaveLength(0);
  });

  it('cílení na řetězec bere cenu jen z něj', async () => {
    const { service, notifier } = setup([
      { productId: 'prd_mleko', chainCode: 'KAUFLAND', targetUnitPriceMinor: 2000 },
    ]);

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    // Kaufland má 2790 > 2000 → nad prahem, i když Lidl má 1990.
    expect(report.details[0]?.reason).toBe('ABOVE_TARGET');
    expect(notifier.pushes).toHaveLength(0);
  });

  it('bez push tokenu a bez e-mailu = NOT_CONFIGURED (skip, ne failure)', async () => {
    const { service, notifier } = setup([{ productId: 'prd_mleko', targetUnitPriceMinor: 2000 }]);
    notifier.emailConfigured = false;

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report).toMatchObject({ notified: 0, failed: 0, skipped: 1 });
    expect(report.details[0]?.reason).toBe('NOT_CONFIGURED');
  });

  it('produkt bez akce = NO_OFFER', async () => {
    const { service } = setup([{ productId: 'prd_bez_akce', targetUnitPriceMinor: 5000 }]);

    const report = await service.evaluate({ activeOn: ACTIVE_ON, now: NOW });

    expect(report.details[0]?.reason).toBe('NO_OFFER');
  });
});
