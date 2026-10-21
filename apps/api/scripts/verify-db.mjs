/**
 * Lokální ověření DB bez Dockeru: spustí embedded Postgres, aplikuje migrace,
 * spustí seed a vypíše počty řádků. Slouží pro vývoj/CI sanity check.
 *
 * Spuštění: node scripts/verify-db.mjs   (v apps/api)
 */
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const PORT = 55432;
const DB_URL = `postgresql://lovecslev:lovecslev@localhost:${PORT}/lovecslev`;

const pg = new EmbeddedPostgres({
  databaseDir: '.tmp/pgdata',
  user: 'lovecslev',
  password: 'lovecslev',
  port: PORT,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase('lovecslev');

const env = { ...process.env, DATABASE_URL: DB_URL };
const run = (command, args) =>
  execFileSync(command, args, { env, stdio: 'inherit' });

try {
  run('npx', ['prisma', 'migrate', 'deploy', '--schema', 'prisma/schema.prisma']);

  console.log('\n--- seed #1 ---');
  run('npx', ['ts-node', 'src/cli/seed.ts']);

  console.log('\n--- seed #2 (idempotence) ---');
  run('npx', ['ts-node', 'src/cli/seed.ts']);

  const prisma = new PrismaClient({ datasources: { db: { url: DB_URL } } });
  const [chains, leaflets, promotions, products, history, aliases, stores] = await Promise.all([
    prisma.chain.count(),
    prisma.leaflet.count(),
    prisma.promotion.count(),
    prisma.product.count(),
    prisma.priceHistoryPoint.count(),
    prisma.productAlias.count(),
    prisma.store.count(),
  ]);

  // search_text je GENERATED + unaccent: bez diakritiky musí najít „Mléko polotučné“.
  const withoutDiacritics = await prisma.$queryRaw`
    SELECT "canonical_name" FROM "products" WHERE "search_text" LIKE '%mleko%'
  `;

  // pg_trgm musí být nainstalovaný a index použitelný.
  const trigram = await prisma.$queryRaw`SELECT similarity('mliko', 'mleko') AS score`;

  // Reálný SQL adaptér (word_similarity + unaccent) — ověření, že dotazy nic netipují.
  const { PostgresSearchAdapter } = await import('../dist/catalog/search.adapters.js');
  const search = new PostgresSearchAdapter(prisma);
  const typo = await search.findCandidates('mliko', 5);
  const slang = await search.findCandidates('toaletak', 5);
  const exactWord = await search.findCandidates('kureci', 5);

  // F5: haversine + bounding box v SQL (5 km kolem Václavského náměstí).
  const { PrismaStoresRepository } = await import('../dist/stores/prisma-stores.repository.js');
  const nearby = await new PrismaStoresRepository(prisma).findNearby({
    lat: 50.081,
    lng: 14.427,
    radiusKm: 5,
    activeOn: '2026-10-20',
  });

  await prisma.$disconnect();

  const found = (rows) => rows.map((row) => row.canonicalName);

  const result = {
    chains,
    leaflets,
    promotions,
    products,
    stores,
    priceHistory: history,
    aliases,
    unaccentHits: withoutDiacritics.length,
    trigramScore: Number(trigram[0]?.score ?? 0).toFixed(2),
    search: {
      mliko: found(typo),
      toaletak: found(slang),
      kureci: found(exactWord),
    },
    nearby: {
      count: nearby.length,
      first: nearby[0]?.name,
      maxDistance: nearby.length === 0 ? null : Math.max(...nearby.map((store) => store.distanceMeters)),
      sorted: nearby.every((store, index) => index === 0 || nearby[index - 1].distanceMeters <= store.distanceMeters),
      penny: nearby.find((store) => store.chainCode === 'PENNY') ?? null,
    },
  };
  console.log('\n--- stav DB ---');
  console.log(JSON.stringify(result, null, 2));

  const expected = { chains: 9, leaflets: 4, promotions: 22, products: 6, priceHistory: 154, aliases: 12, stores: 9 };
  const mismatches = Object.entries(expected).filter(([key, value]) => result[key] !== value);
  const searchProblems = [
    result.search.mliko.includes('Mléko polotučné') ? null : 'mliko nenalezeno',
    result.search.toaletak.includes('Toaletní papír 8 rolí') ? null : 'toaletak nenalezeno',
    result.search.kureci.includes('Kuřecí prsa') ? null : 'kureci nenalezeno',
    result.nearby.count >= 5 ? null : 'málo prodejen v okolí',
    result.nearby.sorted ? null : 'prodejny nejsou seřazené dle vzdálenosti',
    result.nearby.maxDistance !== null && result.nearby.maxDistance <= 5000 ? null : 'prodejna mimo radius',
    result.nearby.penny !== null && result.nearby.penny.hasActiveLeaflet === false ? null : 'PENNY bez letáku',
  ].filter(Boolean);

  if (mismatches.length > 0 || result.unaccentHits === 0 || searchProblems.length > 0) {
    throw new Error(`Ověření selhalo: ${JSON.stringify({ mismatches, searchProblems, result })}`);
  }
  console.log('\nDB VERIFY: OK (migrace + 2× idempotentní seed + unaccent + pg_trgm + SQL search)');
} finally {
  await pg.stop();
}
