import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { OptimizerModule } from './optimizer/optimizer.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, OptimizerModule, CatalogModule],
  controllers: [HealthController],
})
export class AppModule {}
