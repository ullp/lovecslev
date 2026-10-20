import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';
import { STORES_REPOSITORY } from './stores.types';
import { PrismaStoresRepository } from './prisma-stores.repository';

@Module({
  imports: [PrismaModule],
  controllers: [StoresController],
  providers: [StoresService, { provide: STORES_REPOSITORY, useClass: PrismaStoresRepository }],
  exports: [StoresService],
})
export class StoresModule {}
