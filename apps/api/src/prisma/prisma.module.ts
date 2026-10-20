import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Globální přístup k DB pro všechny moduly (jeden PrismaClient na proces). */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
