/**
 * CLI seed (spec §14.1, §19):
 *   1) upsertne číselník řetězců (9 řetězců, 4 s `isMvp`),
 *   2) importuje referenční letáky z @slevari/seed-data (idempotentně),
 *   3) vypíše report dle §14.4 a skončí nenulovým exit kódem při jakékoli chybě.
 *
 * Spuštění: npm run seed --workspace=@slevari/api   (vyžaduje DATABASE_URL + migrace)
 */
import 'reflect-metadata';
import { PRODUCT_ALIASES, PRODUCTS, STORE_SEED } from '@slevari/shared';
import { leaflets } from '@slevari/seed-data';
import { CHAIN_SEED } from '../import/chain-seed';
import { LeafletImportService } from '../import/leaflet-import.service';
import { PrismaLeafletRepository } from '../import/prisma-leaflet.repository';
import { PrismaService } from '../prisma/prisma.service';

/** Aliasy ze spec §19.2 — nutné pro deterministické hovorové shody (toaleťák → toaletní papír). */
async function seedAliases(prisma: PrismaService): Promise<number> {
  let upserted = 0;

  for (const [productId, aliases] of Object.entries(PRODUCT_ALIASES)) {
    const meta = PRODUCTS[productId];
    if (meta === undefined) continue;

    const product = await prisma.product.findFirst({
      where: { canonicalName: meta.canonicalName, brand: meta.brand },
      select: { id: true },
    });
    if (product === null) continue;

    for (const alias of aliases) {
      await prisma.productAlias.upsert({
        where: { productId_alias: { productId: product.id, alias } },
        create: { productId: product.id, alias, source: 'SEED' },
        update: {},
      });
      upserted += 1;
    }
  }

  return upserted;
}

/** Prodejny pro F5 (mapa) — zdroj: `STORE_SEED` (spec §19 doplněk). */
async function seedStores(prisma: PrismaService): Promise<number> {
  let upserted = 0;

  for (const store of STORE_SEED) {
    const chain = await prisma.chain.findUnique({ where: { code: store.chainCode }, select: { id: true } });
    if (chain === null) continue;

    await prisma.store.upsert({
      where: { chainId_address: { chainId: chain.id, address: store.address } },
      create: {
        chainId: chain.id,
        name: store.name,
        address: store.address,
        city: store.city,
        zip: store.zip,
        latitude: store.latitude,
        longitude: store.longitude,
      },
      update: { name: store.name, city: store.city, zip: store.zip, latitude: store.latitude, longitude: store.longitude },
    });
    upserted += 1;
  }

  return upserted;
}

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
    const aliasesSeeded = await seedAliases(prisma);
    const storesSeeded = await seedStores(prisma);

    console.log(JSON.stringify({ ...report, aliasesSeeded, storesSeeded }, null, 2));

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
