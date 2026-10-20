import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { HouseholdsModule } from '../households/households.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ListsController } from './lists.controller';
import { LISTS_REPOSITORY } from './lists.repository';
import { ListsService } from './lists.service';
import { PrismaListsRepository } from './prisma-lists.repository';

@Module({
  imports: [PrismaModule, AuthModule, CatalogModule, SubscriptionsModule, HouseholdsModule],
  controllers: [ListsController],
  providers: [
    ListsService,
    { provide: LISTS_REPOSITORY, useClass: PrismaListsRepository },
  ],
  exports: [ListsService],
})
export class ListsModule {}
