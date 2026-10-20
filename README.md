# Slevaři kolem mě

Agregátor letákových akcí českých řetězců a optimalizace nákupu podle nákupního seznamu.
**Stav: M0 scaffold** (doménové jádro + API + mobilní shell + infrastruktura + CI).

> Zdroj pravdy je [`dev/requirement-base-doc.md`](dev/requirement-base-doc.md) (AI-ready spec v2.1).
> Při rozporu mezi kódem a specifikací platí specifikace; odchylky se zapisují do §17.

## Rychlý start

```bash
npm install                                  # Node ≥ 20, npm workspaces
docker compose up -d                         # Postgres 16, Redis 7, Elasticsearch 8
npm run build --workspace=@slevari/shared    # API i mobil importují dist/
npm run db:migrate --workspace=@slevari/api  # aplikuje prisma/migrations
npm run seed --workspace=@slevari/api        # 9 řetězců + 4 letáky + 22 akcí (idempotentní)
npm run dev --workspace=@slevari/api         # http://localhost:3000/health
npm run dev --workspace=@slevari/web         # http://localhost:3001 (web)
npm run dev --workspace=@slevari/mobile      # Expo

curl -s localhost:3000/health
```

Bez Dockeru lze DB ověřit embedded Postgresem (stáhne si binárku, nic neinstaluje globálně):

```bash
npm run db:verify --workspace=@slevari/api   # migrace + 2× seed + kontrola unaccent/trgm
npm run alerts:evaluate --workspace=@slevari/api -- --date=2026-10-20   # P2 job (volitelně datum)
```

Testy (217 testů, bez DB):

```bash
npm test
npm run typecheck --workspaces --if-present
```

## Web (Next.js, M4)

| Routa | Obrazovka |
|---|---|
| `/` | F1 přehled letáků s filtrem řetězce |
| `/leaflets/[id]` | F1 detail: kategorie, stránkování, jednotkové ceny, slevy |
| `/search` | F2 hledání s `meta.match` a návrhy |
| `/login` | registrace/přihlášení (JWT + refresh) |
| `/lists` · `/lists/[id]` | F3 seznamy a položky, potvrzení shody, F4 optimalizace s paywallem |
| `/history/[productId]` | P3 graf historie jednotkových cen + přerušení při změně balení |
| `/alerts` | P2 hlídač cen (vytvoření, seznam, smazání) |
| `/households` | P4 domácnost, pozvánky, přijetí tokenem, správa členů |
| `/stores` | F5 mapa (OpenStreetMap) + prodejny v okolí s vzdálenostmi |

Spuštění: `npm run dev --workspace=@slevari/web` (očekává API na `http://localhost:3000`, jde změnit přes `NEXT_PUBLIC_API_URL`).

## API (M2 + M3)

| Endpoint | Popis |
|---|---|
| `GET /health` | liveness |
| `POST /v1/auth/register` · `/login` · `/refresh` · `/logout` | Argon2id + JWT, rotace refresh tokenů |
| `GET /v1/chains?activeOn=` | F1: řetězce + `hasActiveLeaflet` |
| `GET /v1/leaflets?activeOn=&chainCode=` | F1: aktivní letáky (counts, top 3 slevy) |
| `GET /v1/leaflets/:id/products?category=&page=&pageSize=` | F1: detail se stránkováním (max 50) |
| `GET /v1/products/search?q=&limit=` | F2: matching (§12) + nabídky dle Kč/kg, Kč/l, Kč/ks |
| `GET/POST /v1/lists`, `GET/PATCH/DELETE /v1/lists/:id` | F3: seznamy s limity tarifu |
| `POST/PATCH/DELETE /v1/lists/:id/items[/:itemId]` | F3: položky + matching, potvrzení shody |
| `POST /v1/lists/:id/optimize` | F4: FREE = Varianta A, PREMIUM = A+B+úspora (`date`, `maxStores`, `tripPenaltyMinor`) |
| `GET /v1/products/:id/history?range=90d` | P3 historie cen (PREMIUM) |
| `GET /v1/stores/nearby?lat=&lng=&radiusKm=` | F5 prodejny v okolí (haversine, `hasActiveLeaflet`) |
| `GET/POST/DELETE /v1/alerts`, `/v1/alerts/:id` | P2 hlídač cen (PREMIUM, max 20) |
| `POST /v1/devices/push-token` | registrace Expo push tokenu |
| `POST/GET /v1/households`, `POST /v1/households/:id/invitations`, `POST /v1/households/invitations/accept`, `DELETE /v1/households/:id/members/:userId` | P4 domácnosti a sdílené seznamy (PREMIUM) |
| `POST /v1/optimizer/preview` | dev preview bez DB (`X-Plan` hlavička) |

## Struktura

```
apps/
  api/       NestJS 10 — health, POST /v1/optimizer/preview, Prisma schéma + migrace, import CLI
             prisma/schema.prisma (16 modelů dle §9), prisma/migrations/0001_init
  mobile/    Expo 51 — F1 letáky, F2 hledání, F5 prodejny (EXPO_PUBLIC_API_URL)
packages/
  shared/    doménové jádro: money, units, pricing, optimizer, import (validace/mapper) + fixture §19
  seed-data/ referenční letáky (§19) generované z fixture, `npm run build` je přegeneruje
dev/
  requirement-base-doc.md   AI-ready specifikace (§0–§20), decision log D1–D22
  requirement-base-doc.v1-original.md  původní zadání (archiv)
docker-compose.yml           postgres, redis, elasticsearch
.github/workflows/ci.yml     install → build shared → typecheck → test → build api
```

## Klíčová pravidla (zkráceně)

1. Peníze = celé **haléře** (`priceMinor`), nikdy float.
2. Porovnávat ceny lze jen ve stejné **base unit** (`G`/`ML`/`PCS`); `g ↔ ml` bez hustoty je zakázáno.
3. „Nejlevnější“ = `unitPriceMinor` (Kč/kg, Kč/l, Kč/ks), ne cena balení.
4. FREE tarif dostane jen **Variantu A**; Varianta B + úspora je PREMIUM (D18).
5. Scraping letáků je za **právním gate** a je default vypnutý (D16, §14.5).

## Reference

- Golden fixture: Varianta A = **64 690** haléřů (LIDL), Varianta B = **59 690** (LIDL + KAUFLAND), úspora **5 000**.
- Roadmapa a stav: spec §20, §20.1.
