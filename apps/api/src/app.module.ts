import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { OptimizerModule } from './optimizer/optimizer.module';

@Module({
  imports: [OptimizerModule],
  controllers: [HealthController],
})
export class AppModule {}
