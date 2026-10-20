import { randomUUID } from 'node:crypto';
import type {
  AlertRecord,
  AlertRepository,
  CreateAlertInput,
  PushTokenRecord,
  PushTokenRepository,
} from '../../src/alerts/alerts.types';
import type { NotificationSender, PushMessage } from '../../src/alerts/notification.sender';

const PRODUCT_NAMES: Record<string, string> = {
  prd_mleko: 'Mléko polotučné',
  prd_maslo: 'Máslo',
  prd_kureci_prsa: 'Kuřecí prsa',
};

export class InMemoryAlertRepository implements AlertRepository {
  readonly alerts: AlertRecord[] = [];
  readonly notified: { alertId: string; unitPriceMinor: number }[] = [];

  seed(alerts: readonly Partial<AlertRecord>[]): void {
    for (const partial of alerts) {
      this.alerts.push({
        id: partial.id ?? randomUUID(),
        userId: partial.userId ?? 'user-1',
        userEmail: partial.userEmail ?? 'user@test.cz',
        productId: partial.productId ?? 'prd_mleko',
        productName: partial.productName ?? PRODUCT_NAMES[partial.productId ?? 'prd_mleko'] ?? 'Produkt',
        chainId: partial.chainId ?? null,
        chainCode: partial.chainCode ?? null,
        targetUnitPriceMinor: partial.targetUnitPriceMinor ?? 2000,
        isActive: partial.isActive ?? true,
        lastNotifiedAt: partial.lastNotifiedAt ?? null,
        lastNotifiedUnitPriceMinor: partial.lastNotifiedUnitPriceMinor ?? null,
        createdAt: partial.createdAt ?? new Date('2026-10-01T00:00:00Z'),
      });
    }
  }

  async countActive(userId: string): Promise<number> {
    return this.alerts.filter((alert) => alert.userId === userId && alert.isActive).length;
  }

  async findByTarget(userId: string, productId: string, chainId: string | null): Promise<AlertRecord | null> {
    return (
      this.alerts.find(
        (alert) => alert.userId === userId && alert.productId === productId && alert.chainId === chainId,
      ) ?? null
    );
  }

  async create(input: CreateAlertInput): Promise<AlertRecord> {
    const alert: AlertRecord = {
      id: randomUUID(),
      userId: input.userId,
      userEmail: `${input.userId}@test.cz`,
      productId: input.productId,
      productName: PRODUCT_NAMES[input.productId] ?? 'Produkt',
      chainId: input.chainId,
      chainCode: null,
      targetUnitPriceMinor: input.targetUnitPriceMinor,
      isActive: true,
      lastNotifiedAt: null,
      lastNotifiedUnitPriceMinor: null,
      createdAt: new Date(),
    };
    this.alerts.push(alert);
    return alert;
  }

  async listForUser(userId: string): Promise<readonly AlertRecord[]> {
    return this.alerts.filter((alert) => alert.userId === userId);
  }

  async findForUser(userId: string, alertId: string): Promise<AlertRecord | null> {
    return this.alerts.find((alert) => alert.id === alertId && alert.userId === userId) ?? null;
  }

  async delete(alertId: string): Promise<void> {
    const index = this.alerts.findIndex((alert) => alert.id === alertId);
    if (index >= 0) this.alerts.splice(index, 1);
  }

  async listActive(): Promise<readonly AlertRecord[]> {
    return this.alerts.filter((alert) => alert.isActive);
  }

  async markNotified(alertId: string, notifiedAt: Date, unitPriceMinor: number): Promise<void> {
    const alert = this.alerts.find((entry) => entry.id === alertId);
    if (alert === undefined) return;
    Object.assign(alert, { lastNotifiedAt: notifiedAt, lastNotifiedUnitPriceMinor: unitPriceMinor });
    this.notified.push({ alertId, unitPriceMinor });
  }
}

export class InMemoryPushTokenRepository implements PushTokenRepository {
  readonly tokens: { userId: string; token: string; platform: 'IOS' | 'ANDROID' }[] = [];

  async upsert(userId: string, token: string, platform: 'IOS' | 'ANDROID'): Promise<void> {
    const existing = this.tokens.find((entry) => entry.token === token);
    if (existing === undefined) this.tokens.push({ userId, token, platform });
    else Object.assign(existing, { userId, platform });
  }

  async listForUser(userId: string): Promise<readonly PushTokenRecord[]> {
    return this.tokens.filter((entry) => entry.userId === userId);
  }

  async delete(token: string): Promise<void> {
    const index = this.tokens.findIndex((entry) => entry.token === token);
    if (index >= 0) this.tokens.splice(index, 1);
  }
}

export class RecordingNotifier implements NotificationSender {
  readonly pushes: { tokens: readonly string[]; message: PushMessage }[] = [];
  readonly emails: { to: string; subject: string; text: string }[] = [];
  pushResult = true;
  emailResult = true;
  emailConfigured = true;

  isEmailConfigured(): boolean {
    return this.emailConfigured;
  }

  async sendPush(tokens: readonly string[], message: PushMessage): Promise<boolean> {
    this.pushes.push({ tokens, message });
    return this.pushResult;
  }

  async sendEmail(to: string, subject: string, text: string): Promise<boolean> {
    this.emails.push({ to, subject, text });
    return this.emailResult;
  }
}
