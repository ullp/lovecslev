import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { HealthController } from './health/health.controller';
import { ListsModule } from './lists/lists.module';
import { OptimizerModule } from './optimizer/optimizer.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule, OptimizerModule, CatalogModule, ListsModule],
  controllers: [HealthController],
})
export class AppModule {}
