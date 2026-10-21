import { DomainError, PLAN_LIMITS } from '@lovecslev/shared';
import { Inject, Injectable } from '@nestjs/common';
import { CATALOG_REPOSITORY, type CatalogRepository } from '../catalog/catalog.repository';
import {
  ALERT_REPOSITORY,
  PUSH_TOKEN_REPOSITORY,
  type AlertRecord,
  type AlertRepository,
  type PushTokenRepository,
} from './alerts.types';

export interface CreateAlertRequest {
  readonly productId: string;
  readonly targetUnitPriceMinor: number;
  readonly chainCode?: string;
}

/** Registrace zařízení pro push (spec §13.2). */
@Injectable()
export class PushTokensService {
  constructor(@Inject(PUSH_TOKEN_REPOSITORY) private readonly tokens: PushTokenRepository) {}

  async register(userId: string, token: string, platform: 'IOS' | 'ANDROID'): Promise<void> {
    if (token.trim() === '') {
      throw new DomainError('VALIDATION_ERROR', 'Push token nesmí být prázdný');
    }
    await this.tokens.upsert(userId, token.trim(), platform);
  }

  async remove(token: string): Promise<void> {
    await this.tokens.delete(token);
  }
}

/**
 * Hlídač cen (spec §6 P2). Limity: PREMIUM max 20 aktivních alertů (spec §7).
 * Volající MUSÍ být za `PremiumGuard`.
 */
@Injectable()
export class AlertsService {
  constructor(
    @Inject(ALERT_REPOSITORY) private readonly alerts: AlertRepository,
    @Inject(CATALOG_REPOSITORY) private readonly catalog: CatalogRepository,
  ) {}

  async list(userId: string): Promise<readonly AlertRecord[]> {
    return this.alerts.listForUser(userId);
  }

  async create(userId: string, request: CreateAlertRequest): Promise<AlertRecord> {
    if (!Number.isInteger(request.targetUnitPriceMinor) || request.targetUnitPriceMinor <= 0) {
      throw new DomainError('VALIDATION_ERROR', 'Prahová cena musí být kladné celé haléře', {
        targetUnitPriceMinor: request.targetUnitPriceMinor,
      });
    }

    const product = await this.catalog.findProduct(request.productId);
    if (product === null) {
      throw new DomainError('NOT_FOUND', `Produkt ${request.productId} neexistuje`, {
        productId: request.productId,
      });
    }

    const active = await this.alerts.countActive(userId);
    const limit = PLAN_LIMITS.PREMIUM.maxAlerts;
    if (active >= limit) {
      throw new DomainError('PLAN_LIMIT_REACHED', `Tarif Premium umožňuje ${limit} aktivních alertů`, {
        plan: 'PREMIUM',
        limit,
      });
    }

    const chainCode = request.chainCode?.trim().toUpperCase() ?? null;
    let chainId: string | null = null;

    if (chainCode !== null) {
      const chain = await this.catalog.findChainByCode(chainCode);
      if (chain === null) {
        throw new DomainError('NOT_FOUND', `Řetězec ${chainCode} neexistuje`, { chainCode });
      }
      chainId = chain.id;
    }

    const existing = await this.findExisting(userId, product.productId, chainCode);
    if (existing !== null) {
      throw new DomainError('CONFLICT', 'Pro tento produkt a řetězec už alert existuje', {
        alertId: existing.id,
      });
    }

    return this.alerts.create({
      userId,
      productId: product.productId,
      chainId,
      targetUnitPriceMinor: request.targetUnitPriceMinor,
    });
  }

  async remove(userId: string, alertId: string): Promise<void> {
    const alert = await this.alerts.findForUser(userId, alertId);
    if (alert === null) {
      throw new DomainError('NOT_FOUND', `Alert ${alertId} neexistuje`, { alertId });
    }
    await this.alerts.delete(alertId);
  }

  private async findExisting(
    userId: string,
    productId: string,
    chainCode: string | null,
  ): Promise<AlertRecord | null> {
    const list = await this.alerts.listForUser(userId);
    return (
      list.find(
        (alert) => alert.productId === productId && (alert.chainCode ?? null) === chainCode,
      ) ?? null
    );
  }
}
