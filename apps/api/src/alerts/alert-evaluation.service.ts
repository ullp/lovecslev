import { Inject, Injectable } from '@nestjs/common';
import { formatCzk } from '@slevari/shared';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../catalog/catalog.repository';
import { todayInPrague } from '../common/date';
import {
  ALERT_REPOSITORY,
  PUSH_TOKEN_REPOSITORY,
  type AlertRepository,
  type PushTokenRepository,
} from './alerts.types';
import { NOTIFICATION_SENDER, type NotificationSender } from './notification.sender';

/** Max 1 notifikace za 24 h na alert (spec §6 P2). */
export const NOTIFICATION_THROTTLE_MS = 24 * 60 * 60 * 1000;

export type SkipReason =
  | 'NO_OFFER'
  | 'ABOVE_TARGET'
  | 'THROTTLED'
  | 'NOT_NEW_MINIMUM'
  | 'NOT_CONFIGURED'
  | 'NOT_DELIVERED';

export interface EvaluationDetail {
  readonly alertId: string;
  readonly productName: string;
  readonly reason: SkipReason;
}

export interface EvaluationReport {
  readonly evaluated: number;
  readonly notified: number;
  readonly skipped: number;
  readonly failed: number;
  readonly details: readonly EvaluationDetail[];
}

/**
 * Vyhodnocení hlídače cen po importu (spec §6 P2, §14.3 bod 6).
 * Posílá jen NOVÉ minimum pod prahem, max 1× za 24 h, push → e-mail fallback.
 */
@Injectable()
export class AlertEvaluationService {
  constructor(
    @Inject(ALERT_REPOSITORY) private readonly alerts: AlertRepository,
    @Inject(PUSH_TOKEN_REPOSITORY) private readonly pushTokens: PushTokenRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
    @Inject(NOTIFICATION_SENDER) private readonly notifier: NotificationSender,
  ) {}

  async evaluate(options: { activeOn?: string; now?: Date } = {}): Promise<EvaluationReport> {
    const activeOn = options.activeOn ?? todayInPrague();
    const now = options.now ?? new Date();
    const alerts = await this.alerts.listActive();

    const productIds = [...new Set(alerts.map((alert) => alert.productId))];
    const offersByProduct = await this.catalog.findOffers(productIds, activeOn);

    let notified = 0;
    let skipped = 0;
    let failed = 0;
    const details: EvaluationDetail[] = [];

    const skip = (alertId: string, productName: string, reason: SkipReason): void => {
      skipped += 1;
      details.push({ alertId, productName, reason });
    };

    for (const alert of alerts) {
      const offers = (offersByProduct.get(alert.productId) ?? []).filter(
        (offer) => alert.chainCode === null || offer.chainCode === alert.chainCode,
      );

      // Repository řadí nabídky vzestupně dle jednotkové ceny (spec §5 F2).
      const best = offers[0];
      if (best === undefined) {
        skip(alert.id, alert.productName, 'NO_OFFER');
        continue;
      }
      if (best.unitPriceMinor > alert.targetUnitPriceMinor) {
        skip(alert.id, alert.productName, 'ABOVE_TARGET');
        continue;
      }
      if (
        alert.lastNotifiedAt !== null &&
        now.getTime() - alert.lastNotifiedAt.getTime() < NOTIFICATION_THROTTLE_MS
      ) {
        skip(alert.id, alert.productName, 'THROTTLED');
        continue;
      }
      if (
        alert.lastNotifiedUnitPriceMinor !== null &&
        best.unitPriceMinor >= alert.lastNotifiedUnitPriceMinor
      ) {
        skip(alert.id, alert.productName, 'NOT_NEW_MINIMUM');
        continue;
      }

      const message = {
        title: `${alert.productName} je v akci`,
        body: `${alert.productName} je nyní v ${best.chainName} za ${formatCzk(
          best.unitPriceMinor,
        )} / ${best.unitLabel.replace(/^Kč\//, '')}`,
      };

      const tokens = await this.pushTokens.listForUser(alert.userId);
      if (tokens.length === 0 && !this.notifier.isEmailConfigured()) {
        // Žádný doručovací kanál není nastaven — není to chyba alertu, jen konfigurace.
        skip(alert.id, alert.productName, 'NOT_CONFIGURED');
        continue;
      }

      const pushSent =
        tokens.length > 0 ? await this.notifier.sendPush(tokens.map((token) => token.token), message) : false;
      const delivered = pushSent || (await this.notifier.sendEmail(alert.userEmail, message.title, message.body));

      if (!delivered) {
        failed += 1;
        details.push({ alertId: alert.id, productName: alert.productName, reason: 'NOT_DELIVERED' });
        continue;
      }

      await this.alerts.markNotified(alert.id, now, best.unitPriceMinor);
      notified += 1;
    }

    return { evaluated: alerts.length, notified, skipped, failed, details };
  }
}
