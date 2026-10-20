import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AlertEvaluationService } from './alert-evaluation.service';
import { AlertsController } from './alerts.controller';
import { AlertsService, PushTokensService } from './alerts.service';
import { ALERT_REPOSITORY, PUSH_TOKEN_REPOSITORY } from './alerts.types';
import { NOTIFICATION_SENDER } from './notification.sender';
import { ExpoPushSender } from './notification.sender';
import { PrismaAlertRepository, PrismaPushTokenRepository } from './prisma-alerts.repository';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule, CatalogModule],
  controllers: [AlertsController],
  providers: [
    AlertsService,
    PushTokensService,
    AlertEvaluationService,
    { provide: ALERT_REPOSITORY, useClass: PrismaAlertRepository },
    { provide: PUSH_TOKEN_REPOSITORY, useClass: PrismaPushTokenRepository },
    // ExpoPushSender má konstruktor s defaulty — Nest by se je pokusil injektovat, proto factory.
    { provide: NOTIFICATION_SENDER, useFactory: () => new ExpoPushSender() },
  ],
  exports: [AlertsService, PushTokensService, AlertEvaluationService, NOTIFICATION_SENDER],
})
export class AlertsModule {}
