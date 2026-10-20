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
const DB_URL = `postgresql://slevari:slevari@localhost:${PORT}/slevari`;

const pg = new EmbeddedPostgres({
  databaseDir: '.tmp/pgdata',
  user: 'slevari',
  password: 'slevari',
  port: PORT,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase('slevari');

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
  const [chains, leaflets, promotions, products, history, aliases] = await Promise.all([
    prisma.chain.count(),
    prisma.leaflet.count(),
    prisma.promotion.count(),
    prisma.product.count(),
    prisma.priceHistoryPoint.count(),
    prisma.productAlias.count(),
  ]);

  // search_text je GENERATED + unaccent: bez diakritiky musí najít „Mléko polotučné“.
  const withoutDiacritics = await prisma.$queryRaw`
    SELECT "canonical_name" FROM "products" WHERE "search_text" LIKE '%mleko%'
  `;

  // pg_trgm musí být nainstalovaný a index použitelný.
  const trigram = await prisma.$queryRaw`SELECT similarity('mliko', 'mleko') AS score`;

  await prisma.$disconnect();

  const result = {
    chains,
    leaflets,
    promotions,
    products,
    priceHistory: history,
    aliases,
    unaccentHits: withoutDiacritics.length,
    trigramScore: Number(trigram[0]?.score ?? 0).toFixed(2),
  };
  console.log('\n--- stav DB ---');
  console.log(JSON.stringify(result, null, 2));

  const expected = { chains: 9, leaflets: 4, promotions: 22, products: 6, priceHistory: 154 };
  const mismatches = Object.entries(expected).filter(([key, value]) => result[key] !== value);
  if (mismatches.length > 0 || result.unaccentHits === 0) {
    throw new Error(`Ověření selhalo: ${JSON.stringify({ mismatches, result })}`);
  }
  console.log('\nDB VERIFY: OK (migrace + 2× idempotentní seed + unaccent + pg_trgm)');
} finally {
  await pg.stop();
}
