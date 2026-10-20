import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AlertRecord,
  AlertRepository,
  CreateAlertInput,
  PushTokenRecord,
  PushTokenRepository,
} from './alerts.types';

const ALERT_SELECT = {
  id: true,
  userId: true,
  productId: true,
  chainId: true,
  targetUnitPriceMinor: true,
  isActive: true,
  lastNotifiedAt: true,
  lastNotifiedUnitPriceMinor: true,
  createdAt: true,
  product: { select: { canonicalName: true } },
  chain: { select: { code: true } },
  user: { select: { email: true } },
} as const;

@Injectable()
export class PrismaAlertRepository implements AlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countActive(userId: string): Promise<number> {
    return this.prisma.priceAlert.count({ where: { userId, isActive: true } });
  }

  async findByTarget(
    userId: string,
    productId: string,
    chainId: string | null,
  ): Promise<AlertRecord | null> {
    const alert = await this.prisma.priceAlert.findFirst({
      where: { userId, productId, chainId },
      select: ALERT_SELECT,
    });
    return alert === null ? null : toRecord(alert);
  }

  async create(input: CreateAlertInput): Promise<AlertRecord> {
    const alert = await this.prisma.priceAlert.create({
      data: {
        userId: input.userId,
        productId: input.productId,
        chainId: input.chainId,
        targetUnitPriceMinor: input.targetUnitPriceMinor,
      },
      select: ALERT_SELECT,
    });
    return toRecord(alert);
  }

  async listForUser(userId: string): Promise<readonly AlertRecord[]> {
    const alerts = await this.prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: ALERT_SELECT,
    });
    return alerts.map(toRecord);
  }

  async findForUser(userId: string, alertId: string): Promise<AlertRecord | null> {
    const alert = await this.prisma.priceAlert.findFirst({
      where: { id: alertId, userId },
      select: ALERT_SELECT,
    });
    return alert === null ? null : toRecord(alert);
  }

  async delete(alertId: string): Promise<void> {
    await this.prisma.priceAlert.delete({ where: { id: alertId } });
  }

  async listActive(): Promise<readonly AlertRecord[]> {
    const alerts = await this.prisma.priceAlert.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: ALERT_SELECT,
    });
    return alerts.map(toRecord);
  }

  async markNotified(alertId: string, notifiedAt: Date, unitPriceMinor: number): Promise<void> {
    await this.prisma.priceAlert.update({
      where: { id: alertId },
      data: { lastNotifiedAt: notifiedAt, lastNotifiedUnitPriceMinor: unitPriceMinor },
    });
  }
}

@Injectable()
export class PrismaPushTokenRepository implements PushTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, token: string, platform: 'IOS' | 'ANDROID'): Promise<void> {
    await this.prisma.pushToken.upsert({
      where: { token },
      create: { userId, token, platform },
      update: { userId, platform },
    });
  }

  async listForUser(userId: string): Promise<readonly PushTokenRecord[]> {
    return this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true, platform: true },
    });
  }

  async delete(token: string): Promise<void> {
    await this.prisma.pushToken.deleteMany({ where: { token } });
  }
}

function toRecord(row: {
  id: string;
  userId: string;
  productId: string;
  chainId: string | null;
  targetUnitPriceMinor: number;
  isActive: boolean;
  lastNotifiedAt: Date | null;
  lastNotifiedUnitPriceMinor: number | null;
  createdAt: Date;
  product: { canonicalName: string };
  chain: { code: string } | null;
  user: { email: string };
}): AlertRecord {
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.user.email,
    productId: row.productId,
    productName: row.product.canonicalName,
    chainId: row.chainId,
    chainCode: row.chain?.code ?? null,
    targetUnitPriceMinor: row.targetUnitPriceMinor,
    isActive: row.isActive,
    lastNotifiedAt: row.lastNotifiedAt,
    lastNotifiedUnitPriceMinor: row.lastNotifiedUnitPriceMinor,
    createdAt: row.createdAt,
  };
}
