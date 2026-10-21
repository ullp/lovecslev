import type { BaseUnit } from '@lovecslev/shared';

export interface AlertRecord {
  readonly id: string;
  readonly userId: string;
  readonly userEmail: string;
  readonly productId: string;
  readonly productName: string;
  readonly chainId: string | null;
  readonly chainCode: string | null;
  readonly targetUnitPriceMinor: number;
  readonly isActive: boolean;
  readonly lastNotifiedAt: Date | null;
  readonly lastNotifiedUnitPriceMinor: number | null;
  readonly createdAt: Date;
}

export interface CreateAlertInput {
  readonly userId: string;
  readonly productId: string;
  readonly chainId: string | null;
  readonly targetUnitPriceMinor: number;
}

/** Port nad alerty (spec §6 P2, §9.11). */
export interface AlertRepository {
  countActive(userId: string): Promise<number>;
  findByTarget(userId: string, productId: string, chainId: string | null): Promise<AlertRecord | null>;
  create(input: CreateAlertInput): Promise<AlertRecord>;
  listForUser(userId: string): Promise<readonly AlertRecord[]>;
  findForUser(userId: string, alertId: string): Promise<AlertRecord | null>;
  delete(alertId: string): Promise<void>;
  listActive(): Promise<readonly AlertRecord[]>;
  markNotified(alertId: string, notifiedAt: Date, unitPriceMinor: number): Promise<void>;
}

export const ALERT_REPOSITORY = Symbol('ALERT_REPOSITORY');

export interface PushTokenRecord {
  readonly token: string;
  readonly platform: 'IOS' | 'ANDROID';
}

export interface PushTokenRepository {
  upsert(userId: string, token: string, platform: 'IOS' | 'ANDROID'): Promise<void>;
  listForUser(userId: string): Promise<readonly PushTokenRecord[]>;
  delete(token: string): Promise<void>;
}

export const PUSH_TOKEN_REPOSITORY = Symbol('PUSH_TOKEN_REPOSITORY');

export type AlertOffer = {
  readonly chainCode: string;
  readonly chainName: string;
  readonly unitPriceMinor: number;
  readonly unitLabel: string;
  readonly baseUnit: BaseUnit;
};
