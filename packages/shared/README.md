# @lovecslev/shared

Doménové jádro aplikace **Lovec Slev** — čisté deterministické funkce bez závislosti na DB či frameworku.
Zdroj pravdy: [`dev/requirement-base-doc.md`](../../dev/requirement-base-doc.md) (§10 jednotky, §11 optimalizace, §19 fixture).

## Co tu je

| Modul | Odpovídá | Funkce |
|---|---|---|
| `money.ts` | §0.5, D8, §15.5 | `Minor`, `assertMinor`, `sumMinor`, `toMinor`, `formatCzk` |
| `units.ts` | §10.1–§10.3, §10.5 | `normalizePackageSize`, `unitPriceMinor`, `unitLabel`, `isComparable` |
| `pricing.ts` | §10.4 | `packagesRequired`, `lineCost` (PACKAGE = ceil, WEIGHT = proporcionálně) |
| `optimizer.ts` | §11 | `optimizePurchase` — Varianta A + B, úspora, warningy, deterministické tie-breaky |
| `errors.ts` | §13.4 | `DomainError` s kódem (`INVALID_UNIT`, `INVALID_PRICE`, …) |

## Použití

```ts
import { formatCzk, optimizePurchase } from '@lovecslev/shared';

const result = optimizePurchase({
  items: [{ productId: 'prd_mleko', quantityBase: 6000 }],
  offers: [
    { productId: 'prd_mleko', chainCode: 'LIDL', priceMinor: 1990,
      packageAmount: 1000, baseUnit: 'ML', pricingMode: 'PACKAGE' },
  ],
});

result.variantA;              // { chainCode: 'LIDL', totalMinor: 11940, items: [...] }
result.variantB.totalMinor;   // 11940
formatCzk(result.savingsMinor); // "0,00 Kč"
```

## Pravidla, která se nesmí obejít

1. **Peníze jsou celé haléře** (`1990` = 19,90 Kč). Nikdy `float`.
2. **Porovnávat lze jen shodné `baseUnit`** (`G`/`ML`/`PCS`); `g ↔ ml` bez hustoty není povoleno.
3. **`unitPriceMinor` je primární měřítko** „nejlevnější“, ne cena balení.
4. **FREE uživatel dostane jen Variantu A** — řeší volající (API), optimalizátor vrací obě (D18).
5. **Výstup je deterministický** — pořadí vstupu nesmí změnit výsledek.

## Testy

```bash
npm install                     # v rootu repozitáře
npm test --workspace=@lovecslev/shared
npx jest --config packages/shared/jest.config.js --rootDir packages/shared --coverage
```

Golden fixture (spec §19) je v `src/fixtures/mvpFixture.ts` a je exportovaná z balíčku
(`PRODUCTS`, `PRICE_TABLE`, `OFFERS`, `SHOPPING_LIST`, `EXPECTED`), takže ji používají testy i API:
Varianta A = **64 690** haléřů (LIDL), Varianta B = **59 690** (LIDL + KAUFLAND), úspora **5 000**.
