import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';
import {
  HOUSEHOLD_ACCESS,
  HOUSEHOLD_REPOSITORY,
  type HouseholdAccess,
  type HouseholdRepository,
} from './households.types';
import { PrismaHouseholdRepository } from './prisma-household.repository';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule, AlertsModule],
  controllers: [HouseholdsController],
  providers: [
    HouseholdsService,
    { provide: HOUSEHOLD_REPOSITORY, useClass: PrismaHouseholdRepository },
    {
      provide: HOUSEHOLD_ACCESS,
      useFactory: (repository: HouseholdRepository): HouseholdAccess => ({
        isMember: (userId: string, householdId: string) => repository.isMember(userId, householdId),
      }),
      inject: [HOUSEHOLD_REPOSITORY],
    },
  ],
  exports: [HouseholdsService, HOUSEHOLD_ACCESS],
})
export class HouseholdsModule {}
