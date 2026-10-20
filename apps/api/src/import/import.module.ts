import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LeafletImportService } from './leaflet-import.service';
import { LEAFLET_REPOSITORY } from './leaflet.repository';
import { PrismaLeafletRepository } from './prisma-leaflet.repository';

/**
 * Importní modul (spec §14). Není součástí AppModule, protože vyžaduje DATABASE_URL
 * a spouští se z CLI (`npm run seed`), ne z HTTP requestu.
 */
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: LEAFLET_REPOSITORY, useClass: PrismaLeafletRepository },
    LeafletImportService,
  ],
  exports: [LeafletImportService],
})
export class ImportModule {}
