import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';
import { ADVISOR_USAGE_REPOSITORY, LLM_CLIENT } from './advisor.types';
import { OpenAiCompatibleClient } from './llm.client';
import { PrismaAdvisorUsageRepository } from './prisma-advisor-usage.repository';

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule, CatalogModule],
  controllers: [AdvisorController],
  providers: [
    AdvisorService,
    { provide: ADVISOR_USAGE_REPOSITORY, useClass: PrismaAdvisorUsageRepository },
    { provide: LLM_CLIENT, useFactory: () => new OpenAiCompatibleClient() },
  ],
  exports: [AdvisorService],
})
export class AdvisorModule {}
