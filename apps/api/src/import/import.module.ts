import { Module } from '@nestjs/common';
import { LeafletImportService } from './leaflet-import.service';
import { LEAFLET_REPOSITORY } from './leaflet.repository';
import { PrismaLeafletRepository } from './prisma-leaflet.repository';
import { PrismaService } from './prisma.service';

/**
 * Importní modul (spec §14). Není součástí AppModule, protože vyžaduje DATABASE_URL
 * a spouští se z CLI (`npm run seed`), ne z HTTP requestu.
 */
@Module({
  providers: [
    PrismaService,
    { provide: LEAFLET_REPOSITORY, useClass: PrismaLeafletRepository },
    LeafletImportService,
  ],
  exports: [LeafletImportService, PrismaService],
})
export class ImportModule {}
