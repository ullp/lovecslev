import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PremiumGuard } from './premium.guard';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [PrismaModule],
  providers: [SubscriptionsService, PremiumGuard],
  exports: [SubscriptionsService, PremiumGuard],
})
export class SubscriptionsModule {}
