/**
 * Generátor referenčních letáků (spec §19) z doménové fixture.
 * Jediný zdroj pravdy jsou PRICE_TABLE / REGULAR_PRICE_TABLE / PRODUCTS v @lovecslev/shared,
 * takže seed nemůže „utéct“ od golden testů.
 *
 * Spuštění: npm run build --workspace=@lovecslev/seed-data
 * (vyžaduje předchozí build @lovecslev/shared)
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  PRODUCTS,
  PRICE_TABLE,
  REGULAR_PRICE_TABLE,
  CHAINS,
  LEAFLET_PERIOD,
} = require('@lovecslev/shared');

const outDir = path.join(import.meta.dirname, '..', 'leaflets');
fs.mkdirSync(outDir, { recursive: true });

function toKc(minor) {
  return Math.round(minor) / 100;
}

let written = 0;

for (const chain of CHAINS) {
  const products = [];

  for (const [productId, byChain] of Object.entries(PRICE_TABLE)) {
    const priceMinor = byChain[chain];
    if (priceMinor === undefined) continue;

    const meta = PRODUCTS[productId];
    if (meta === undefined) throw new Error(`Neznámý produkt ${productId}`);

    const regularMinor = REGULAR_PRICE_TABLE[productId]?.[chain];
    const product = {
      name: meta.canonicalName,
      price: toKc(priceMinor),
      packageAmount: meta.packageSize.amount,
      packageUnit: meta.packageSize.unit,
      category: meta.category,
    };

    if (meta.brand !== null) product.brand = meta.brand;
    if (regularMinor !== undefined && regularMinor > priceMinor) product.regularPrice = toKc(regularMinor);
    if (meta.pricingMode === 'WEIGHT') product.pricing = 'WEIGHT';

    products.push(product);
  }

  const leaflet = {
    chain,
    title: `Leták ${chain} ${LEAFLET_PERIOD.validFrom} – ${LEAFLET_PERIOD.validTo}`,
    validFrom: LEAFLET_PERIOD.validFrom,
    validTo: LEAFLET_PERIOD.validTo,
    products,
  };

  const file = path.join(outDir, `leaflet-${chain.toLowerCase()}-${LEAFLET_PERIOD.validFrom}.json`);
  fs.writeFileSync(file, `${JSON.stringify(leaflet, null, 2)}\n`, 'utf8');
  written += 1;
}

console.log(`seed-data: zapsáno ${written} letáků do ${outDir}`);
