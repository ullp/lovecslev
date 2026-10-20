/**
 * CLI seed (spec §14.1, §19):
 *   1) upsertne číselník řetězců (9 řetězců, 4 s `isMvp`),
 *   2) importuje referenční letáky z @slevari/seed-data (idempotentně),
 *   3) vypíše report dle §14.4 a skončí nenulovým exit kódem při jakékoli chybě.
 *
 * Spuštění: npm run seed --workspace=@slevari/api   (vyžaduje DATABASE_URL + migrace)
 */
import 'reflect-metadata';
import { leaflets } from '@slevari/seed-data';
import { CHAIN_SEED } from '../import/chain-seed';
import { LeafletImportService } from '../import/leaflet-import.service';
import { PrismaLeafletRepository } from '../import/prisma-leaflet.repository';
import { PrismaService } from '../import/prisma.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    for (const chain of CHAIN_SEED) {
      await prisma.chain.upsert({
        where: { code: chain.code },
        create: { ...chain },
        update: {
          name: chain.name,
          colorHex: chain.colorHex,
          isMvp: chain.isMvp,
          isActive: chain.isActive,
        },
      });
    }

    const service = new LeafletImportService(new PrismaLeafletRepository(prisma));
    const report = await service.importLeaflets(leaflets, { source: 'SEED' });

    console.log(JSON.stringify(report, null, 2));

    if (report.errors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
