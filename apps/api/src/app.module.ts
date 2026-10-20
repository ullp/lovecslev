import { Module } from '@nestjs/common';
import { AdvisorModule } from './advisor/advisor.module';
import { AlertsModule } from './alerts/alerts.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { HouseholdsModule } from './households/households.module';
import { ListsModule } from './lists/lists.module';
import { OptimizerModule } from './optimizer/optimizer.module';
import { PrismaModule } from './prisma/prisma.module';
import { StoresModule } from './stores/stores.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OptimizerModule,
    CatalogModule,
    ListsModule,
    AlertsModule,
    HouseholdsModule,
    StoresModule,
    AdvisorModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
