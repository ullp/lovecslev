import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { DomainError } from '@lovecslev/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SubscriptionsService } from './subscriptions.service';

/**
 * Vynucení PREMIUM na serveru (spec §7 pravidlo 1, D19).
 * MUSÍ být použito až po `AuthGuard` (potřebuje `request.user`).
 */
@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (request.user === undefined) {
      throw new DomainError('UNAUTHORIZED', 'Chybí přihlášený uživatel');
    }

    const plan = await this.subscriptions.getPlan(request.user.userId);
    if (plan !== 'PREMIUM') {
      throw new DomainError('PREMIUM_REQUIRED', 'Tato funkce je dostupná v tarifu Premium', {
        requiredPlan: 'PREMIUM',
      });
    }

    return true;
  }
}
