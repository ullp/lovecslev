import { Injectable } from '@nestjs/common';
import type { Plan } from '@slevari/shared';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Zdroj pravdy o tarifu je `subscriptions` (spec §7 pravidlo 2, D19).
 * Klient nikdy nerozhoduje o plánu.
 */
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlan(userId: string): Promise<Plan> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { plan: true, status: true, currentPeriodEnd: true },
    });

    if (subscription === null) return 'FREE';
    if (subscription.plan !== 'PREMIUM') return 'FREE';
    if (subscription.status !== 'ACTIVE') return 'FREE';
    if (subscription.currentPeriodEnd !== null && subscription.currentPeriodEnd.getTime() < Date.now()) {
      return 'FREE';
    }

    return 'PREMIUM';
  }
}
