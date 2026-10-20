# Slevaři kolem mě — AI-READY SPECIFIKACE

| Metadata | Hodnota |
|---|---|
| Verze | 2.1 (AI-ready; mezery i Q1–Q7 vyřešeny) |
| Datum | 2026-10-20 |
| Poslední změna | Doplněna rozhodnutí D16–D22 (odpovědi na Q1–Q7), §14.5 scraping pipeline, §9.12 retence historie |
| Stav | Schváleno jako vstup pro implementaci MVP |
| Nahrazuje | `dev/requirement-base-doc.v1-original.md` (původní zadání, zachováno jako archiv) |
| Produkt | Agregátor letáků a akcí CZ řetězců + optimalizace nákupu |
| Jazyk aplikace | `cs-CZ` (Kč, metrické jednotky); kód a identifikátory v angličtině |
| Klient | React Native (Expo) + web |
| Backend | NestJS + PostgreSQL + Redis + Elasticsearch |

---

## 0. Pokyny pro AI agenta (čti jako první)

**0.1 Jediný zdroj pravdy.** Tento dokument je závazný. Původní zadání (`*.v1-original.md`) slouží jen jako historický kontext — v případě rozporu platí tento dokument.

**0.2 Normativní klíčová slova.**
- **MUSÍ** = povinné, implementace bez toho je chybná.
- **MĚL BY** = doporučené, odchylku je nutné zapsat do §17.
- **NESMÍ** = zakázané.
- **MIMO ROZSAH** = neimplementovat v MVP (ani „aby to bylo hezké“).

**0.3 Rozsah.** Implementuj pouze to, co je v §4 „V rozsahu“. Cokoli navíc MUSÍ být popsáno jako rozšíření v §17, ne přímo v kódu.

**0.4 Ilustrativní čísla.** Hodnoty `865 Kč / 742 Kč / úspora 123 Kč` z původního zadání jsou **ilustrativní**. Závazná referenční data a očekávané výsledky jsou v §19 (fixture). Testy MUSÍ vycházet z §19, ne z původních ilustrací.

**0.5 Peníze a čísla.** Všechny peněžní hodnoty jsou **celá čísla v haléřích** (`priceMinor`), nikdy `float`. `1990` = 19,90 Kč. Formátování na Kč je pouze v UI vrstvě.

**0.6 Čas.** V DB `timestamptz` v UTC; business data (validita letáků) jako `date` v `Europe/Prague`. Den „dnes“ se pro validitu počítá v `Europe/Prague`.

**0.7 Nejistota.** Pokud něco není v tomto dokumentu určeno, podívej se do §18 (otevřené otázky). Pokud to tam není ani jako neblokující, **zastav se a zeptej se** — nevymýšlej doménová pravidla.

**0.8 Determinismus před AI.** Cokoli lze spočítat deterministicky (ceny, jednotky, shoda názvů), MUSÍ se počítat deterministicky. LLM je až poslední fallback (§12) a NESMÍ být na kritické cestě.

---

## 1. Vize produktu

**Slevaři kolem mě** je mobilní a webová aplikace pro české zákazníky, která agreguje slevové letáky a akční nabídky obchodních řetězců a pomáhá najít **nejlevnější realizovatelnou variantu nákupu** podle nákupního seznamu uživatele.

**Hodnota:** uživatel nemusí procházet 5–9 letáků a počítat ceny ručně. Zadá seznam (nebo ho nechá vygenerovat) a dostane (a) cenu v jednom obchodě, (b) nejlevnější kombinaci obchodů včetně úspory.

**Dlouhodobá vize:** „Heuréka pro potraviny“ — kontinuální monitoring cen, hlídání slev, automatické plánování nákupů, expanze SK/PL/DE. Tato expanze je MIMO ROZSAH MVP, ale datový model MUSÍ být na multi-country připraven (`chains.country_code`).

---

## 2. Problém a uživatelé

### 2.1 Problém
- Běžná CZ domácnost nakupuje ve více řetězcích (Lidl, Kaufland, Albert, Billa, Penny, Tesco, Globus, Coop, Norma).
- Uživatel neví, kde je produkt **právě teď** nejlevnější.
- Musí procházet mnoho letáků (PDF/obrázky/tisk).
- Neumí spočítat nejlepší **kombinaci** obchodů (a nevidí, kolik mu kombinace reálně ušetří).

### 2.2 Persony

| ID | Persona | Potřeba | Klíčová funkce |
|---|---|---|---|
| U1 | Rodič 30–45, 4členná domácnost, týdenní nákup | Ušetřit 500–1500 Kč/měsíc bez ztráty času | F3 + F4 + P1 |
| U2 | Student/rozpočtový nakupující 20–30 | Najít absolutně nejnižší cenu konkrétní položky | F2 + P2 (hlídač) |
| U3 | Senior 60+ | Jednoduché, čitelné, velké UI, málo kroků | F1 + F2 |
| U4 | „Plánovač“ domácnosti | Sdílený seznam s partnerem | F3 + P4 |

### 2.3 Jobs to be done
1. „Zjisti, kde je kuřecí prsa nejlevnější.“
2. „Spočítej mi, kde nakoupím tenhle seznam nejlevněji.“
3. „Ukaž mi, co je v akci v okolí.“
4. „Dej mi vědět, až Nutella spadne pod 119 Kč.“

---

## 3. Glosář (závazné pojmy)

| Pojem | Definice |
|---|---|
| **Chain** (řetězec) | Značka obchodu (Lidl, Kaufland…). Ceny platí pro celý řetězec. |
| **Store** (prodejna) | Konkrétní pobočka řetězce se souřadnicemi. Používá se pro mapu a docházkovou vzdálenost. |
| **Leaflet** (leták) | Časově ohraničený soubor akcí řetězce (`validFrom`–`validTo`). Nese platnost. |
| **Promotion** (akce) | Cena konkrétního produktu v letáku. Zdroj pravdy o ceně. |
| **Package size** | Balení produktu: `packageAmount` + `packageUnit` (např. 1 l = `1000 ML`). |
| **Base unit** | Normalizovaná jednotka pro porovnání: `G`, `ML`, `PCS`. |
| **Pricing mode** | `PACKAGE` = prodává se po baleních (kupuje se celé balení), `WEIGHT` = vážené zboží (cena za kg/l, kupuje se proporcionálně). |
| **Unit price** | Cena přepočtená na 1 kg / 1 l / 1 ks (`unitPriceMinor`). Jediné bezpečné měřítko porovnání. |
| **Variant A** | Nákup celého seznamu v **jednom** řetězci. |
| **Variant B** | Nákup seznamu v **kombinaci** řetězců (≤ `maxStores`). |
| **Coverage** | Schopnost řetězce pokrýt **všechny** položky seznamu. Bez coverage nelze řetězec použít pro Variant A. |

---

## 4. Rozsah MVP

### 4.1 V rozsahu (MUSÍ být hotové)
| ID | Funkce | Priorita |
|---|---|---|
| F1 | Přehled letáků a akcí | P0 |
| F2 | Vyhledávání produktu s řazením dle jednotkové ceny | P0 |
| F3 | Nákupní seznam (CRUD, perzistence) | P0 |
| F4 | Optimalizace nákupu (Varianta A + B + úspora) | P0 |
| F5 | Mapa obchodů v okolí | P1 |
| A0 | Auth (registrace/přihlášení, JWT) | P0 |
| A1 | Import dat z JSON fixture + validace | P0 |
| A2 | Tarif FREE/PREMIUM s vynucením na serveru | P1 |

### 4.2 Řetězce
- `chains` registry obsahuje **všech 9** řetězců: Lidl, Kaufland, Albert, Billa, Penny, Tesco, Globus, Coop, Norma (`is_mvp = false` pro ty, které nejsou v MVP importu).
- **MVP importuje ceny pro 4 řetězce:** Lidl, Kaufland, Albert, Billa (`is_mvp = true`).
- **Mapa (F5) zobrazuje prodejny 5 řetězců:** Lidl, Billa, Penny, Albert, Kaufland. Penny je v mapě, ale bez letáků v MVP → vyhledávání a optimalizace Penny nepoužívají (v UI MUSÍ být poznámka „ceny nejsou k dispozici“).

### 4.3 MIMO ROZSAH MVP (NESMÍ se implementovat)
- **Scraping** je součástí plánu (rozhodnutí D16), ale **NENÍ součástí MVP**: MVP jede na JSON fixture (§19), scraping se implementuje až po právním review (§14.5, milník M7).
- Multi-buy akce („2. kus zdarma“, „3 za 100“), klubové ceny, kupóny, věrnostní slevy.
- Přepočet mezi hmotností a objemem (g ↔ ml) bez známé hustoty.
- Dopravní náklady, doba jízdy, MHD, otevírací doba (pouze `tripPenaltyMinor` jako konstanta, viz §11).
- Recepty, nutriční data, košík u třetích stran, objednávka/platba za zboží.
- Chat s LLM, hlasové zadávání.
- SK/PL/DE lokalizace (jen příprava v modelu).

### 4.4 Role a oprávnění
- `USER` — vlastní seznamy, vlastní alerty, sdílené domácnosti.
- `PREMIUM_USER` — odvozeno z `subscriptions.plan`, ne z role.
- `ADMIN` — import letáků, správa chainů/produktů (MVP: přes CLI/seed, ne UI).

---

## 5. Funkční specifikace

### F1 — Přehled letáků

**Cíl:** uživatel vidí aktuální letáky řetězců a jejich akce.

**Pravidla**
1. „Aktuální leták“ = `valid_from <= today <= valid_to` (today v `Europe/Prague`).
2. Seznam MUSÍ být seskupen po řetězcích, v rámci řetězce seřazen dle `valid_to` vzestupně.
3. Karta letáku MUSÍ zobrazit: chain, `validFrom`–`validTo`, počet akcí, počet produktů, top 3 největší slevy (`discountPercent`), pokud je `regular_price_minor` znám.
4. Detail letáku MUSÍ umět filtrovat dle `category` a stránkovat (max 50 položek/stránku).
5. Produkt bez `category` MUSÍ být zařazen do `Ostatní`.

**Datový kontrakt letáku (import, viz §14)**
```json
{
  "chain": "LIDL",
  "validFrom": "2026-10-14",
  "validTo": "2026-10-20",
  "products": [
    {
      "name": "Mléko polotučné",
      "brand": "Madeta",
      "price": 19.90,
      "regularPrice": 24.90,
      "packageAmount": 1,
      "packageUnit": "l",
      "category": "Mléčné výrobky"
    }
  ]
}
```

**Akceptační kritéria**
- [ ] `GET /v1/leaflets?activeOn=2026-10-20` vrátí právě 4 letáky (Lidl, Kaufland, Albert, Billa) z fixture.
- [ ] Leták s `valid_to = 2026-10-19` se 20. 10. 2026 ve výsledku **neobjeví**.
- [ ] Detail letáku vrátí všechny produkty včetně `unitPriceMinor` a `unitLabel` (`Kč/kg`, `Kč/l`, `Kč/ks`).

### F2 — Vyhledávání produktu

**Cíl:** uživatel zadá text a dostane nabídky seřazené od nejlevnější.

**Pravidla**
1. Vyhledává se nad **kanonickými produkty** (`products.canonical_name`) + aliasy (§12). Výsledek = seskupení po produktech.
2. U každého produktu se vrací všechny **aktuálně platné** akce; primární řazení je dle `unitPriceMinor` vzestupně.
3. Řadí se pouze nabídky se **shodnou base unit**; pokud produkt existuje v `G` i `PCS`, MUSÍ se vrátit jako oddělené skupiny s labelem jednotky (nikdy nesrovnávat Kč/kg s Kč/ks).
4. „Nejlevnější“ MUSÍ být určeno z `unitPriceMinor`, ne z absolutní ceny balení. Absolutní cena (`priceMinor`) je v odpovědi také, ale jen jako doplňková informace.
5. Prázdný/1znakový dotaz MUSÍ vrátit `400 VALIDATION_ERROR` a nesmí zatížit ES.
6. Pokud dotaz nic nenajde: `200` s `data: []` a `meta.suggestions` (max 3 kandidáti nad prahem 0,20; když žádný práh nepřekročí, je pole prázdné).

**Příklad odpovědi** (fixture §19, dotaz „kuřecí prsa“)
```json
{
  "data": [
    {
      "productId": "prd_kureci_prsa",
      "name": "Kuřecí prsa",
      "baseUnit": "G",
      "offers": [
        { "chain": "LIDL",     "priceMinor": 12900, "unitPriceMinor": 12900, "unitLabel": "Kč/kg" },
        { "chain": "KAUFLAND", "priceMinor": 13500, "unitPriceMinor": 13500, "unitLabel": "Kč/kg" },
        { "chain": "ALBERT",   "priceMinor": 13900, "unitPriceMinor": 13900, "unitLabel": "Kč/kg" },
        { "chain": "BILLA",    "priceMinor": 14900, "unitPriceMinor": 14900, "unitLabel": "Kč/kg" }
      ]
    }
  ],
  "meta": { "query": "kuřecí prsa", "normalizedQuery": "kureci prsa" }
}
```

**Akceptační kritéria**
- [ ] Dotaz `kuřecí prsa` vrátí pořadí Lidl 129 / Kaufland 135 / Albert 139 / Billa 149 Kč/kg.
- [ ] Dotaz `Mliko` (bez diakritiky, překlep) nalezne `Mléko polotučné`.
- [ ] Dotaz `toaleťák` nalezne `Toaletní papír 8 rolí` (přes alias, §12).
- [ ] Dotaz `Coca cola` nalezne `Coca-Cola Original 1.5 l`.
- [ ] Produkt, jehož balení 1,5 l je levnější na kus, ale dražší na litr, MUSÍ být seřazen dle ceny za litr.

### F3 — Nákupní seznam

**Cíl:** uživatel spravuje seznam položek, který se ukládá do profilu a je vstupem pro F4.

**Pravidla**
1. Seznam MUSÍ mít `name` (default „Můj nákup“) a MUSÍ být perzistentní mezi zařízeními (server, ne pouze lokálně).
2. Položka MUSÍ obsahovat: `rawText` (co uživatel napsal), `quantityBase` (množství v base unit), `productId` (nullable) a `matchStatus`.
3. `matchStatus` ∈ `RESOLVED_AUTO` (dle §12.1: exact/alias 1.00, edit-distance 0.90, `word_similarity ≥ 0.60`), `RESOLVED_CONFIRMED` (potvrdil uživatel), `SUGGESTED` (`word_similarity 0.40–0.60`, čeká na potvrzení), `UNRESOLVED` (pod 0.40 — nic nenalezeno).
4. Volný text MUSÍ být okamžitě uložen i bez shody — uživatel nikdy nesmí být blokován.
5. Výchozí `quantityBase` při vložení textu = 1 balení produktu; pro `WEIGHT` produkty = 1000 g (1 kg). Uživatel MŮŽE množství změnit (g/ml/ks).
6. FREE limit: **1 seznam**, max **30 položek**. PREMIUM: neomezeno. Překročení MUSÍ vrátit `403 PLAN_LIMIT_REACHED` (vynuceno na serveru).
7. Položky `SUGGESTED`/`UNRESOLVED` MUSÍ být vizuálně odlišeny a MUSÍ být uvedeny ve `warnings` odpovědi optimalizace.
8. Smazání seznamu MUSÍ být soft-delete (`deleted_at`); do API se nezobrazuje.

**Akceptační kritéria**
- [ ] Přidání textu `Mliko` vytvoří položku s `matchStatus = RESOLVED_AUTO` a `productId` mléka.
- [ ] Přidání textu `xyz123` vytvoří položku `UNRESOLVED` (nezablokuje uložení) a vrátí 0 nabídek.
- [ ] FREE uživatel nemůže vytvořit 2. seznam (`403`).
- [ ] Seznam přežije restart serveru i odhlášení/přihlášení.

### F4 — Nejlevnější nákup (optimalizace)

**Cíl:** ze seznamu spočítat nejlevnější realizovatelný nákup.

**Pravidla (shrnutí; formální definice v §11)**
1. Server MUSÍ vrátit **dvě varianty**: A = jeden řetězec, B = kombinace řetězců (≤ 3 řetězce, viz §11).
2. Každá varianta MUSÍ obsahovat: celkovou cenu (`totalMinor`), rozpad po řetězcích, rozpad po položkách (množství, cena, unit price) a seznam nepokrytých položek.
3. `savingsMinor = variantA.totalMinor - variantB.totalMinor`. Pokud `savingsMinor <= 0`, MUSÍ se doporučit Varianta A a `savingsMinor = 0` (`recommendedVariant = "A"`).
4. Pokud žádný řetězec nepokrývá celý seznam, MUSÍ být `variantA = null` s `reason: "NO_SINGLE_STORE"`. Varianta B MUSÍ být vrácena vždy, pokud je pokryta alespoň 1 položka.
5. Položky `UNRESOLVED` MUSÍ být z výpočtu vyloučeny a vráceny ve `warnings` (`code: "ITEM_NOT_MATCHED"`).
6. Položky, které nemá žádný řetězec, MUSÍ být vyloučeny s `code: "ITEM_UNAVAILABLE"`; výpočet NESMÍ selhat.
7. Cena MUSÍ vycházet z platných akcí k datu `today` (nebo `?date=`), nikdy z neplatného letáku.
8. Výsledek NESMÍ být cachován déle než 15 minut nebo přes import nových dat (invalidace).
9. `tripPenaltyMinor` je v MVP fixně `0` (D17); UI MUSÍ u Varianty B zobrazit „cena nezahrnuje cestu“.
10. FREE uživatel dostane **jen Variantu A** (D18): odpověď obsahuje `variantA`, `variantB: null`, `savingsMinor: 0`, `recommendedVariant: "A"` a `meta.lockedFeatures: ["VARIANT_B"]`. Premium pravidla 1–9 platí beze změny.

**Akceptační kritéria (fixture §19)**
- [ ] Varianta A vrátí `LIDL` s `totalMinor = 64690`.
- [ ] Varianta B vrátí `LIDL` (Mléko, Kuřecí prsa, Banány) + `KAUFLAND` (Máslo, Toaletní papír) s `totalMinor = 59690`.
- [ ] `savingsMinor = 5000`, `recommendedVariant = "B"`.
- [ ] `BILLA` se ve Variantě A nevyskytuje (chybí Toaletní papír → nemá coverage).
- [ ] Výpočet 30 položek × 4 řetězce trvá < 500 ms (p95).

### F5 — Mapa obchodů

**Cíl:** zobrazit prodejny v okolí uživatele.

**Pravidla**
1. Klient MUSÍ poslat `lat`, `lng`, `radiusKm` (default 5, max 25).
2. Server MUSÍ vrátit prodejny se `distanceMeters`, seřazené vzestupně, max 100.
3. Bez souhlasu s polohou MUSÍ aplikace nabídnout ruční zadání PSČ/města; poloha NESMÍ být uložena na serveru.
4. Markery MUSÍ být odlišeny barvou řetězce (`chains.color_hex`) a MUSÍ obsahovat informaci, zda má řetězec aktuální leták.
5. Klik na prodejnu MUSÍ nabídnout „Zobrazit leták“ (F1 pro daný chain) a „Naplánovat nákup“ (F4 s preferencí tohoto řetězce).
6. Prodejny s `is_active = false` se nezobrazují.

**Akceptační kritéria**
- [ ] Dotaz 5 km kolem 50.0755, 14.4378 (Praha) vrátí jen prodejny do 5000 m, max 100, seřazené dle vzdálenosti.
- [ ] Bez `lat/lng` vrátí `400 VALIDATION_ERROR`.
- [ ] Mapa zobrazí i Penny (bez letáku) s příznakem „ceny nejsou k dispozici“.

---

## 6. Premium funkce

### P1 — AI nákupní poradce
**Vstup:** volný text + rozpočet („Chci nakoupit na týden pro čtyřčlennou rodinu do 2500 Kč“).
**Výstup:** (a) navržený seznam položek s množstvím, (b) doporučené produkty (konkrétní `productId` z katalogu), (c) optimalizace dle F4, (d) upozornění, pokud rozpočet nelze splnit (`budgetFeasible: false` + minimální možná cena).
**Pravidla**
- LLM MUSÍ vracet **striktní JSON** dle schématu; volný text je povolen jen v `explanation`.
- LLM NESMÍ vymýšlet produkty ani ceny. Množství a ceny MUSÍ pocházet z DB. Neznámý produkt → položka se stavem `UNRESOLVED`.
- MUSÍ existovat fallback: při nedostupnosti LLM nebo nevalidním JSON se použije deterministická šablona (koš dle kategorií); odpověď MUSÍ obsahovat `meta.source = TEMPLATE` a `meta.fallbackReason`.
- MUSÍ být rate-limit **10 dotazů/den/uživatel** a timeout **20 s**. Čítač se MUSÍ vést podle skutečného dne (`advisor_usage`), NIKDY podle parametru `date` — jinak by šel limit obejít.
- Nepovinný parametr `date` (`YYYY-MM-DD`) určuje, k jakému dni se počítají platné akce (D24); default „dnes“ v Europe/Prague.
- `minimalMinor` = **nejnižší dostupná varianta** (A i B), `null` pokud není dostupná žádná akce (nikdy 0).

### P2 — Hlídač cen
**Vstup:** produkt + prahová cena (`targetUnitPriceMinor`) + volitelně řetězec.
**Pravidla**
- Alert se vyhodnocuje po každém importu (job) nad platnými akcemi; nová cena ≤ práh → notifikace.
- MUSÍ se notifikovat max 1× za 24 h na alert (`last_notified_at`) a jen při **novém** minimu, ne při každém importu.
- Notifikace: Expo Push (`push_tokens`), e-mail (Resend, D20) jako fallback.
- Pokud není registrovaný žádný push token **ani** nakonfigurovaný e-mail, alert se přeskočí se stavem `NOT_CONFIGURED` (není to chyba doručení; job kvůli tomu NESMÍ selhat).
- Job MUSÍ skončit nenulovým exit kódem jen při skutečném selhání doručení (`failed > 0`).
- FREE: 0 alertů (`403 PLAN_LIMIT_REACHED`). PREMIUM: max 20 aktivních.

### P3 — Historie cen
**Vstup:** `productId` + `range` (default 90 dní).
**Pravidla**
- Data z denní materializace `price_history_points` (§9.8); MUSÍ vracet min., max. a průměrnou unit price + datum nejnižší ceny.
- Graf MUSÍ zobrazovat **unit price**, ne cenu balení; při změně balení MUSÍ být v grafu viditelné přerušení (`breaks`).
- Historie je dostupná jen PREMIUM (`403 PREMIUM_REQUIRED`).

### P4 — Rodinné sdílení
**Pravidla**
- Domácnost (`households`) MUSÍ umožnit 2–6 členů, role `OWNER`/`MEMBER`.
- Sdílené MUSÍ být: seznam, oblíbené produkty, alerty. Změny viditelné do 60 s (polling stačí; websocket MIMO ROZSAH).
- Pozvánka e-mailem s jednorázovým tokenem (platnost 7 dní).
- Odebrání člena MUSÍ okamžitě zrušit jeho přístup ke sdíleným entitám.
- **MVP rozhodnutí (D26):** jeden uživatel = jedna domácnost; pozvánky posílá pouze `OWNER`; pozvánku lze přijmout jen s e-mailem, na který byla vystavena; seznam se sdílí vytvořením s `householdId` a členové domácnosti mají plný přístup (čtení i zápis).

---

## 7. Tarify a vynucení práv

| Funkce | FREE | PREMIUM (79 Kč/měsíc) |
|---|---|---|
| F1 letáky | ✅ | ✅ |
| F2 vyhledávání | ✅ | ✅ |
| F3 seznamy | 1 seznam / 30 položek | neomezeno |
| F4 optimalizace | ✅ jen **Varianta A** (jeden obchod) | ✅ Varianta A + **B** + úspora + rozpad kombinace |
| F5 mapa | ✅ | ✅ |
| P1 AI poradce | ⛔ | ✅ 10 dotazů/den |
| P2 hlídač cen | ⛔ | ✅ 20 alertů |
| P3 historie cen | ⛔ | ✅ |
| P4 rodinné sdílení | ⛔ | ✅ |

**Pravidla**
1. Vynucení MUSÍ být na serveru (guard `@RequirePlan('PREMIUM')`); klientské skrytí je pouze UX.
2. `subscriptions.status = ACTIVE` a `current_period_end >= now()` = PREMIUM; jinak FREE.
3. Paywall odpověď MUSÍ být `403` s `code: "PREMIUM_REQUIRED"` a `details.requiredPlan = "PREMIUM"`.
4. Zkušební období (`trial_until`) je MIMO ROZSAH MVP.
5. **Varianta B je premium funkce** (D18): pro FREE se `variantB` nevrací a `meta.lockedFeatures` obsahuje `"VARIANT_B"`. Explicitní požadavek na Variantu B (parametr `includeVariantB=true`) od FREE uživatele MUSÍ vrátit `403 PREMIUM_REQUIRED`. Chování MUSÍ být řízeno flagem `freeVariantB` (default `false`) — při `true` se B vrací všem.

---

## 8. Technologický stack a infrastruktura

### 8.1 Stack (závazný)
| Vrstva | Technologie | Poznámka |
|---|---|---|
| Mobil | React Native + TypeScript + Expo (SDK 51+) | Expo Router, React Query, `expo-location`, `react-native-maps` |
| Web | Next.js 14 + TypeScript | stejné API, responzivní; MUSÍ být PWA-ready |
| Backend | Node.js 20 + NestJS 10 + TypeScript (strict) | REST, OpenAPI 3.1 |
| DB | PostgreSQL 16 | `pg_trgm`, `unaccent`; PostGIS MIMO ROZSAH |
| Cache | Redis 7 | cache nabídek, rate-limit, fronta (BullMQ) |
| Search | Elasticsearch 8 | index `products` + `promotions` |
| Auth | JWT (access 15 min, refresh 30 dní) + Argon2id | bez OAuth v MVP |
| Platby (M5) | RevenueCat (iOS/Android IAP) + Stripe (web) | MVP `MANUAL`; stav se synchronizuje webhooky do `subscriptions` (D19) |
| E-mail (M5) | Resend + React Email šablony | `cs-CZ`, SPF/DKIM; fallback notifikací (D20) |
| Testy | Jest (unit), Supertest (e2e) | pokrytí doménové logiky ≥ 80 % |

### 8.2 Struktura repozitáře (monorepo, npm workspaces)
> **Stav (M0–M4):** hotové `packages/shared`, `packages/seed-data`, `apps/api`, `apps/mobile`, `apps/web`, `docker-compose.yml` a CI.
```
slevarikoleme/
├─ apps/
│  ├─ api/                  # NestJS
│  │  ├─ prisma/            # schema.prisma + migrations (spec §9)
│  │  ├─ scripts/           # verify-db.mjs (embedded Postgres bez Dockeru)
│  │  └─ src/
│  │     ├─ modules/{auth,users,chains,stores,leaflets,products,search,lists,optimizer,alerts,subscriptions,advisor}
│  │     └─ common/{guards,interceptors,filters,dto}
│  ├─ mobile/               # Expo
│  └─ web/                  # Next.js
├─ packages/
│  ├─ shared/               # typy, DTO, money/unit utils, error kódy (sdíleno FE+BE)
│  └─ seed-data/            # JSON fixture letáků (§19)
├─ dev/
│  ├─ requirement-base-doc.md
│  ├─ api-contract.md        # generováno z OpenAPI (volitelné)
│  ├─ legal-sources.md       # právní gate scrapingu (§14.5): ToS/robots.txt revize per řetězec
│  └─ requirement-base-doc.v1-original.md
├─ docker-compose.yml        # postgres, redis, elasticsearch
└─ package.json
```

### 8.3 Služby a porty
| Služba | Port |
|---|---|
| API | 3000 (`/v1`) |
| Web | 3001 |
| Expo dev server | 8081 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Elasticsearch | 9200 |

### 8.4 Zásady kódu
1. TypeScript `strict: true`, žádné `any` v doménových typech.
2. Doménová logika (unit price, optimalizace, matching) MUSÍ být v čistých funkcích v `packages/shared` a MUSÍ být testovatelná bez DB.
3. NestJS moduly MUSÍ mít controller → service → repository; controller NESMÍ obsahovat business logiku.
4. Všechny vstupy MUSÍ validovat DTO (`class-validator`), výstupy MUSÍ mít explicitní response DTO.
5. Chyby MUSÍ být normalizovány exception filtrem na formát z §13.5.
6. Migrace MUSÍ být verzované (TypeORM/Prisma migrace), `synchronize: false`.
7. Vyhledávání MUSÍ být za `SearchPort` interfacem: `ElasticSearchAdapter` (primární) a `PostgresTrgmAdapter` (fallback, používá se v CI bez ES) — D21.
8. Externí integrace (scraping adaptéry, LLM, mail, platby) MUSÍ být za interfacem a MUSÍ být nahraditelné fake implementací v testech.

---

## 9. Doménový datový model

### 9.1 ERD (textově)
```
chains 1──n stores
chains 1──n leaflets 1──n promotions n──1 products
products 1──n product_aliases
products 1──n price_history_points
products 1──n price_history_monthly
products 1──n promotions
users 1──n shopping_lists 1──n shopping_list_items n──1 products (nullable)
users 1──n price_alerts n──1 products
households 1──n household_members n──1 users
users 1──1 subscriptions
users 1──n push_tokens
```

**Klíčové rozhodnutí:** cena je vázaná na **řetězec** (`promotions.chain_id`), nikoli na prodejnu — letákové ceny platí pro všechny pobočky. `promotions.store_id` existuje jen pro lokální akce (`scope = 'STORE'`).

### 9.2 `chains`
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| code | varchar(32) | UNIQUE, NOT NULL (`LIDL`, `KAUFLAND`, `ALBERT`, `BILLA`, `PENNY`, `TESCO`, `GLOBUS`, `COOP`, `NORMA`) |
| name | varchar(64) | NOT NULL |
| country_code | char(2) | NOT NULL, default `CZ` |
| color_hex | char(7) | NOT NULL |
| logo_url | text | NULL |
| is_mvp | boolean | NOT NULL, default false — řetězec má import cen v MVP |
| is_active | boolean | NOT NULL, default true |
| legal_approved | boolean | NOT NULL, default false — true = scraping tohoto řetězce povolen právním review (§14.5) |

### 9.3 `stores`
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| chain_id | uuid | FK → chains, NOT NULL, ON DELETE RESTRICT |
| name | varchar(128) | NOT NULL |
| address | varchar(255) | NOT NULL |
| city | varchar(128) | NOT NULL |
| zip | varchar(8) | NULL |
| latitude | numeric(9,6) | NOT NULL, CHECK (-90..90) |
| longitude | numeric(9,6) | NOT NULL, CHECK (-180..180) |
| is_active | boolean | NOT NULL, default true |

Indexy: `(chain_id)`, `(latitude, longitude)`, UNIQUE `(chain_id, address)`.
Vyhledání v okolí: bounding box prefilter (± `radius/111` pro lat, korekce `cos(lat)` pro lng) + haversine v SQL, řazení dle vzdálenosti.

### 9.4 `leaflets`
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| chain_id | uuid | FK → chains, NOT NULL |
| title | varchar(255) | NOT NULL |
| valid_from | date | NOT NULL |
| valid_to | date | NOT NULL, CHECK `valid_to >= valid_from` |
| source | enum | `SEED` / `MANUAL` / `IMPORT` / `SCRAPE`, NOT NULL |
| source_url | text | NULL |
| imported_at | timestamptz | NOT NULL, default now() |
| checksum | char(64) | NOT NULL — SHA-256 obsahu pro idempotenci |

Indexy: UNIQUE `(chain_id, valid_from, valid_to)`; `(valid_from, valid_to)`.
Platnost akce = platnost letáku; `promotions` NEMÁ vlastní `valid_from/valid_to` (odstraňuje duplikaci a rozpor z původního modelu).

### 9.5 `products`
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| canonical_name | varchar(255) | NOT NULL — např. „Mléko polotučné“, „Coca-Cola Original 1.5 l“ |
| brand | varchar(128) | NULL |
| category | varchar(64) | NOT NULL, default `Ostatní` |
| base_unit | enum | `G` / `ML` / `PCS`, NOT NULL |
| package_amount | numeric(10,3) | NOT NULL, CHECK > 0 — v base_unit (1 l = 1000 ML) |
| pricing_mode | enum | `PACKAGE` / `WEIGHT`, NOT NULL |
| search_text | text | GENERATED (unaccent + lower z `canonical_name` + `brand`) |
| is_active | boolean | NOT NULL, default true |

Indexy: UNIQUE `(canonical_name, brand)`; GIN trgm na `search_text`.
`package_unit` na vstupu (`l`, `kg`, `g`, `ml`, `ks`, `role`) se MUSÍ převést na `base_unit` + `package_amount` dle §10.2.

### 9.6 `product_aliases`
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| product_id | uuid | FK → products, NOT NULL, ON DELETE CASCADE |
| alias | varchar(255) | NOT NULL — normalizovaný (lower, bez diakritiky) |
| source | enum | `SEED` / `USER` / `AI` |
| created_at | timestamptz | NOT NULL |

Indexy: UNIQUE `(product_id, alias)`; GIN trgm na `alias`; `(alias)`.

### 9.7 `promotions`
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| leaflet_id | uuid | FK → leaflets, NOT NULL, ON DELETE CASCADE |
| product_id | uuid | FK → products, NOT NULL |
| chain_id | uuid | FK → chains, NOT NULL — denormalizace pro rychlé dotazy |
| store_id | uuid | FK → stores, NULL (jen `scope = STORE`) |
| scope | enum | `CHAIN` / `STORE`, NOT NULL, default `CHAIN` |
| price_minor | integer | NOT NULL, CHECK > 0 — haléře za balení (u `WEIGHT` za 1 kg/l) |
| regular_price_minor | integer | NULL, CHECK > `price_minor` |
| package_amount | numeric(10,3) | NOT NULL, CHECK > 0 — snapshot balení k okamžiku importu |
| package_unit | enum | `G` / `ML` / `PCS`, NOT NULL |
| pricing_mode | enum | `PACKAGE` / `WEIGHT`, NOT NULL |
| unit_price_minor | integer | NOT NULL — dopočteno při importu dle §10.3 |
| note | varchar(255) | NULL (např. „jen do vyprodání zásob“) |

Indexy: UNIQUE `(leaflet_id, product_id, store_id)`; `(product_id, chain_id)`; `(chain_id)`.
`discountPercent` se neukládá, počítá se jako `round((1 - price_minor/regular_price_minor) * 100)`, jen pokud `regular_price_minor` existuje.
Multi-buy NENÍ modelováno (§4.3).

### 9.8 `price_history_points`
Denní materializace nejnižší pozorované ceny (job po importu).
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| product_id | uuid | FK → products, NOT NULL |
| chain_id | uuid | FK → chains, NOT NULL |
| date | date | NOT NULL |
| price_minor | integer | NOT NULL |
| unit_price_minor | integer | NOT NULL |
| package_amount | numeric(10,3) | NOT NULL — pro detekci změny balení (přerušení grafu) |
| package_unit | enum | NOT NULL |
| source | enum | `PROMO` / `REGULAR` |

Indexy: UNIQUE `(product_id, chain_id, date)`; `(product_id, date)`.

**Retence (D22):** denní body se drží **24 měsíců**. Job 1× denně přesune body starší 24 měsíců do `price_history_monthly` (agregace po měsících) a denní body smaže. Agregace MUSÍ být idempotentní (přepočet celého měsíce, ne inkrement).

### 9.12 `price_history_monthly` (agregace pro dlouhodobý graf)
| Sloupec | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| product_id | uuid | FK → products, NOT NULL |
| chain_id | uuid | FK → chains, NOT NULL |
| month | date | NOT NULL — vždy 1. den měsíce |
| min_unit_price_minor | integer | NOT NULL |
| avg_unit_price_minor | integer | NOT NULL |
| max_unit_price_minor | integer | NOT NULL |
| sample_days | integer | NOT NULL — počet pozorovaných dní (kvalita dat) |

Indexy: UNIQUE `(product_id, chain_id, month)`; `(product_id, month)`.
P3 (historie) MUSÍ číst denní body pro posledních 24 měsíců a měsíční agregáty pro starší období; přechod MUSÍ být v grafu označen jako `aggregated: true`.

### 9.9 Uživatelé, domácnost, tarif
- `users`: `id` PK, `email` UNIQUE NOT NULL, `password_hash` NOT NULL, `display_name`, `locale` default `cs-CZ`, `created_at`, `deleted_at` NULL.
- `households`: `id` PK, `name` NOT NULL, `owner_user_id` FK → users.
- `household_members`: `id` PK, `household_id` FK, `user_id` FK, `role` enum(`OWNER`,`MEMBER`), `joined_at`; UNIQUE `(household_id, user_id)`.
- `household_invitations`: `id`, `household_id`, `email`, `token_hash` UNIQUE, `expires_at`, `used_at` NULL.
- `subscriptions`: `id` PK, `user_id` FK UNIQUE, `plan` enum(`FREE`,`PREMIUM`) default `FREE`, `status` enum(`ACTIVE`,`PAST_DUE`,`CANCELED`), `current_period_end` timestamptz NULL, `provider` enum(`MANUAL`,`STRIPE`,`REVENUECAT`) NOT NULL default `MANUAL`, `provider_subscription_id` varchar(128) NULL (pro mapování webhooků), `updated_at` timestamptz NOT NULL. Index UNIQUE `(provider, provider_subscription_id)`. Zdroj pravdy o tarifu je vždy tento záznam (D19) — klient NIKDY nerozhoduje o plánu.
- `push_tokens`: `id`, `user_id`, `token` UNIQUE, `platform` enum(`IOS`,`ANDROID`), `created_at`.
- `refresh_tokens` (D23): `id` PK, `user_id` FK → users, `token_hash` char(64) UNIQUE (SHA-256, nikdy plaintext), `expires_at`, `created_at`, `revoked_at` NULL; index `(user_id)`. Rotace: při refreshi se starý token revokuje a vydá se nový pár; logout revokuje předaný token.

### 9.10 `shopping_lists` / `shopping_list_items`
| `shopping_lists` | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| owner_user_id | uuid | FK → users, NOT NULL |
| household_id | uuid | FK → households, NULL = nesdílený |
| name | varchar(64) | NOT NULL, default „Můj nákup“ |
| is_shared | boolean | NOT NULL, default false |
| created_at / updated_at | timestamptz | NOT NULL |
| deleted_at | timestamptz | NULL (soft-delete) |

| `shopping_list_items` | Typ | Omezení |
|---|---|---|
| id | uuid | PK |
| list_id | uuid | FK → shopping_lists, NOT NULL, ON DELETE CASCADE |
| raw_text | varchar(255) | NOT NULL — vždy zachováno |
| product_id | uuid | FK → products, NULL |
| quantity_base | numeric(10,3) | NOT NULL, CHECK > 0 |
| base_unit | enum | `G` / `ML` / `PCS`, NOT NULL |
| match_status | enum | `RESOLVED_AUTO` / `RESOLVED_CONFIRMED` / `SUGGESTED` / `UNRESOLVED`, NOT NULL |
| match_method | enum | `EXACT` / `ALIAS` / `TRIGRAM` / `AI` / `USER` / `NONE`, NOT NULL |
| match_confidence | numeric(3,2) | NULL (0.00–1.00) |
| sort_order | integer | NOT NULL, default 0 |
| created_at | timestamptz | NOT NULL |

Indexy: `(list_id, sort_order)`; `(product_id)`.

### 9.11 `price_alerts`
`id` PK, `user_id` FK NOT NULL, `product_id` FK NOT NULL, `chain_id` FK NULL (NULL = kterýkoli), `target_unit_price_minor` integer NOT NULL CHECK > 0, `is_active` boolean default true, `last_notified_at` timestamptz NULL, `created_at`.
UNIQUE `(user_id, product_id, chain_id)`; `(user_id, is_active)`.

---

## 10. Normalizace jednotek a jednotková cena

### 10.1 Base units
`G` (gramy), `ML` (mililitry), `PCS` (kusy). Jiné jednotky se NESMÍ ukládat.

### 10.2 Konverzní tabulka (import)
| Vstup (`packageUnit`) | base_unit | přepočet `packageAmount` |
|---|---|---|
| `kg` | `G` | × 1000 |
| `g` | `G` | × 1 |
| `l` | `ML` | × 1000 |
| `ml` | `ML` | × 1 |
| `ks` | `PCS` | × 1 |
| `role` | `PCS` | × 1 (počet rolí) |
| jiné | — | odmítnout `400 INVALID_UNIT` |

### 10.3 Výpočet `unit_price_minor` (deterministický, sdílená funkce)
```
unitPriceMinor(priceMinor, packageAmount, baseUnit):
  if baseUnit == PCS: return round(priceMinor / packageAmount)
  else:               return round(priceMinor / packageAmount * 1000)   # Kč/kg nebo Kč/l
unitLabel(baseUnit): G → "Kč/kg", ML → "Kč/l", PCS → "Kč/ks"
```
Zaokrouhlování `Math.round` na celé haléře. Peníze NESMÍ být `float` — vstupem i výstupem jsou celá čísla.

### 10.4 Cena řádku seznamu (vstup do optimalizace)
```
if pricingMode == PACKAGE:
    packages = ceil(quantityBase / packageAmount)
    lineCost = packages * priceMinor            # nelze koupit část balení
else: # WEIGHT
    lineCost = round(quantityBase / packageAmount * priceMinor)   # proporcionálně
```
Příklad: máslo 250 g, potřeba 500 g → 2 balení. Kuřecí prsa 2000 g při ceně 12 900/1000 g → 25 800 haléřů.

### 10.5 Srovnatelnost
Dvě ceny MUSÍ být srovnávány pouze při shodném `base_unit` **a** shodném produktu (resp. jeho variantě). Konverze `G ↔ ML` je bez hustoty zakázána.

---

## 11. Algoritmus optimalizace nákupu (F4)

### 11.1 Vstupy
- `items[]` = položky seznamu s `productId`, `quantityBase`, `baseUnit` (jen `RESOLVED_*`; ostatní → `warnings`).
- `chains` = řetězce s `is_mvp = true` a `is_active = true` (MVP: Lidl, Kaufland, Albert, Billa).
- `prices` = pro každou dvojici (produkt, řetězec) **nejnižší platná** akce k datu `date`; akce se `scope = STORE` přebíjí celořetězcovou (`CHAIN`) cenu.
- Konfigurace: `maxStores` default 3 (rozsah 1–5), `tripPenaltyMinor` default 0 (haléře za každý další obchod nad 1).

### 11.2 Definice
```
cost(i, c)  = lineCost(prices[i][c])   dle §10.4;  +∞ pokud řetězec produkt nemá
        = 0 pokud položka není v žádném řetězci (vyloučena s warningem)
covered(c)  = ∀ i : prices[i][c] existuje          # plná pokrývání seznamu
total(S)    = Σ_i min_{c ∈ S, prices[i][c] existuje} cost(i, c)
```

### 11.3 Varianta A — jeden řetězec
```
A = argmin_{c : covered(c)} Σ_i cost(i, c)
```
- Pokud množina kandidátů je prázdná → `variantA = null`, `reason = "NO_SINGLE_STORE"`.
- Nikdy se nepočítá z neúplného pokrytí (jinak by „nejlevnější obchod“ neměl všechny položky).
- Pokud je některá položka seznamu nedostupná ve **všech** řetězcích (`ITEM_UNAVAILABLE`), platí `variantA = null` (`NO_SINGLE_STORE`): jediný obchod nemůže nikdy pokrýt celý seznam. Položka se z totalů vyloučí a vrátí ve `warnings`.
- Nerozpoznaná položka (`productId = null`, `ITEM_NOT_MATCHED`) se do coverage nezahrnuje — o produktu nic nevíme, nelze ho koupit ani vynechat „potichu“; UI ho zobrazí jako nevyřešenou.

### 11.4 Varianta B — kombinace řetězců
```
B = argmin_{S ⊆ chains, 1 ≤ |S| ≤ maxStores} [ total(S) + tripPenaltyMinor * (|S| - 1) ]
```
- Exaktní vyčerpávající hledání přes podmnožiny (|chains| ≤ 12 → ≤ 4096 kombinací × |items|; projde v ms). Heuristiky NESMÍ být použity v MVP.
- Pro každou podmnožinu se každá položka přiřadí nejlevnějšímu řetězci v podmnožině (greedy per item je pro fixní podmnožinu optimální, protože položky jsou nezávislé).
- Položky nepokryté žádným řetězcem jsou vyloučeny a vráceny ve `warnings` (`ITEM_UNAVAILABLE`).

### 11.5 Doporučení a úspora
```
if variantA == null: recommended = "B"; savingsMinor = 0
else:
  savingsMinor = max(0, variantA.totalMinor - variantB.totalMinor)
  recommended  = savingsMinor > 0 ? "B" : "A"
```
- Pokud `tripPenaltyMinor` způsobí, že B je dražší, MUSÍ se doporučit A a `savingsMinor = 0` (nikdy negativní úspora).
- Odpověď MUSÍ obsahovat i `totalWithoutPenaltyMinor` pro transparentnost. Je to **součet vráceného plánu bez penalizace** — pokud penalizace způsobí, že se vyplatí jeden obchod, vrací se plán s jedním obchodem a `totalWithoutPenaltyMinor == totalMinor`.

### 11.6 Determinismus a tie-break
1. Nižší `totalMinor`.
2. Při shodě méně řetězců.
3. Při shodě abecedně dle `chains.code` (ASC).
Výstup MUSÍ být pro stejný vstup a datum **bitově identický** (žádné závislosti na pořadí v DB dotazu).
Pro dosažení toho MUSÍ být výstup kanonicky seřazen: `variantA.items` a `chains[].items` dle `productId` ASC, `variantB.chains` dle `chainCode` ASC, `warnings` dle (`code`, `productId`, `rawText`). Pořadí vstupních `items`/`offers` NESMÍ ovlivnit výsledek.

### 11.7 Příklad (fixture §19)
| | Řetězec | Položky | Celkem |
|---|---|---|---|
| A | Lidl | Mléko, Máslo, Kuřecí prsa, Banány, Toaletní papír | **646,90 Kč** |
| B | Lidl + Kaufland | Lidl: Mléko, Kuřecí prsa, Banány; Kaufland: Máslo, Toaletní papír | **596,90 Kč** |
| | | Úspora | **50,00 Kč** |

Billa není kandidátem varianty A (chybí Toaletní papír).

---

## 12. AI / matching vrstva

### 12.1 Pipeline (v tomto pořadí, deterministické kroky první)
1. **Normalizace dotazu:** trim, lower, odstranění diakritiky (`unaccent`), sjednocení mezer, odstranění interpunkce, sjednocení zápisu jednotek (`1,5l` → `1.5 l`).
2. **Exact match** na `products.canonical_name` → `confidence = 1.00`, `method = EXACT`.
3. **Alias match** na `product_aliases.alias` → `1.00`, `method = ALIAS` (např. `toaletak` → `Toaletní papír 8 rolí`, `coca cola` → `Coca-Cola Original 1.5 l`).
4. **Trigram fuzzy** — kandidáty hledá DB přes `word_similarity(normalizedQuery, search_text)` (pg_trgm); rozhodnutí o shodě dělá čistá funkce v `@slevari/shared`.
   - Prahy: `word_similarity ≥ 0.60` → `RESOLVED_AUTO`, `0.40–0.60` → `SUGGESTED`, `< 0.40` → `UNRESOLVED`.
   - **Změřené hodnoty (Postgres 16, pg_trgm) — závazné pro testy:**

     | query | text | `similarity` | `word_similarity` |
     |---|---|---|---|
     | `mliko` | `mleko` | 0.333 | 0.333 |
     | `mliko` | `mleko polotucne madeta` | 0.120 | 0.333 |
     | `toaletak` | `toaletni papir 8 roli` | 0.240 | **0.667** |
     | `coca cola` | `coca-cola original 1.5 l` | 0.348 | **1.000** |
     | `maslo` | `maslo madeta` | 0.545 | **1.000** |

   - **Pravidlo pro krátké tokeny:** pro slova délky 4–6 znaků se navíc počítá Damerau-Levenshteinova vzdálenost; `distance = 1` → `RESOLVED_AUTO` s `confidence = 0.90`, `method = TRIGRAM`. Tím je pokryt překlep `mliko` → `mleko` (word_similarity 0,333 by sám nestačil).
   - `similarity` (celořetězcová) NESMÍ být použita pro rozhodování o shodě — u delších názvů padá pod 0,25.
5. **LLM fallback** (jen PREMIUM, jen pokud kroky 2–4 selhaly a jen pro matching, ne pro ceny):
   - Vstup: dotaz + top 5 kandidátů z DB. Výstup: striktní JSON `{ "productId": string | null, "confidence": number, "reason": string }`.
   - Aplikuje se pouze při `confidence ≥ 0.85` a pouze na existující `productId`. Nikdy se nevytváří produkt.
   - Timeout 5 s; při chybě se použije výsledek z kroku 4. LLM NESMÍ blokovat uložení položky (asynchronní dořešení je povoleno).

### 12.2 Cache
- Výsledek matchingu pro `(normalizedQuery)` MUSÍ být cachován v Redis 24 h (klíč `match:{normalizedQuery}`), invalidace při importu nových produktů.
- LLM volání MUSÍ být cachováno 7 dní (stejný dotaz = stejná odpověď).

### 12.3 Hranice
- AI NESMÍ měnit ceny, jednotky ani množství.
- AI MUSÍ mít `feature_flag.ai_matching` (default `false` v testech, `true` v produkci pro PREMIUM).
- Každé AI rozhodnutí MUSÍ být logováno (`requestId`, `input`, `output`, `confidence`, `latencyMs`, `model`) pro audit.

---

## 13. API kontrakt

### 13.1 Konvence
- Base URL: `/v1`, obsah `application/json; charset=utf-8`, verze v cestě.
- Auth: `Authorization: Bearer <accessToken>`; refresh přes `POST /v1/auth/refresh`.
- Peníze: `*Minor` = celé haléře. Data: `YYYY-MM-DD`. Časy: ISO-8601 UTC.
- Odpověď (úspěch): `{ "data": <T>, "meta": { ... } }`; seznamy: `meta: { page, pageSize, total }`.
- Idempotence zápisů: hlavička `Idempotency-Key` u `POST` (volitelné, MUSÍ být podporováno u `POST /v1/lists/:id/items`).
- Rate-limit: 120 req/min/user, hlavičky `X-RateLimit-Limit/Remaining/Reset`; překročení → `429 RATE_LIMITED`.

### 13.2 Endpointy
| Metoda | Cesta | Plan | Popis |
|---|---|---|---|
| POST | `/v1/auth/register` | — | Registrace (e-mail, heslo min. 8 znaků) |
| POST | `/v1/auth/login` | — | Přihlášení → access + refresh token |
| POST | `/v1/auth/refresh` | — | Obnovení access tokenu |
| POST | `/v1/auth/logout` | USER | Revokace refresh tokenu |
| GET | `/v1/me` | USER | Profil + `plan`, `limits` |
| GET | `/v1/chains` | — | Seznam řetězců (`isMvp`, `color`, `hasActiveLeaflet`) |
| GET | `/v1/leaflets?activeOn=&chainCode=` | — | F1 seznam aktuálních letáků |
| GET | `/v1/leaflets/:id/products?category=&page=&pageSize=` | — | F1 detail, max 50/stránku |
| GET | `/v1/products/search?q=&limit=20` | — | F2 vyhledávání, seskupeno po produktech |
| GET | `/v1/products/:id/history?range=90d` | PREMIUM | P3 historie cen |
| GET | `/v1/stores/nearby?lat=&lng=&radiusKm=5` | — | F5 prodejny v okolí |
| GET | `/v1/lists` | USER | Seznamy uživatele (včetně sdílených) |
| POST | `/v1/lists` | USER | Vytvoření seznamu (FREE limit 1) |
| GET | `/v1/lists/:id` | USER | Detail seznamu s položkami |
| PATCH | `/v1/lists/:id` | USER | Přejmenování / sdílení |
| DELETE | `/v1/lists/:id` | USER | Soft-delete |
| POST | `/v1/lists/:id/items` | USER | Přidání položky (volný text → matching) |
| PATCH | `/v1/lists/:id/items/:itemId` | USER | Změna množství / potvrzení shody |
| DELETE | `/v1/lists/:id/items/:itemId` | USER | Odebrání položky |
| POST | `/v1/lists/:id/optimize` | USER | F4: FREE = Varianta A; PREMIUM = A + B + úspora (volitelně `date`, `maxStores`, `tripPenaltyMinor`) |
| POST | `/v1/optimizer/preview` | USER | **M0 dev endpoint** bez DB/auth: validuje DTO a volá `optimizePurchase`; tarif z hlavičky `X-Plan` (`FREE` default). V M3 ho nahradí `/v1/lists/:id/optimize` |
| POST | `/v1/advisor/plan` | PREMIUM | P1 AI poradce (10/den, `date`, fallback šablona) |
| GET/POST/DELETE | `/v1/alerts`, `/v1/alerts/:id` | PREMIUM | P2 hlídač cen (limit 20) |
| POST | `/v1/households` · GET `/v1/households` | PREMIUM | P4 vytvoření a detail domácnosti s členy |
| POST | `/v1/households/:id/invitations` | PREMIUM | P4 pozvánka e-mailem (jen OWNER, platnost 7 dní) |
| POST | `/v1/households/invitations/accept` | USER | P4 přijetí pozvánky (e-mail musí odpovídat) |
| DELETE | `/v1/households/:id/members/:userId` | PREMIUM | P4 odebrání člena (vlastníka nelze) |
| POST | `/v1/devices/push-token` | USER | Registrace Expo push tokenu |
| POST | `/v1/webhooks/stripe` | — | M5: Stripe webhook (ověření `Stripe-Signature`, idempotence dle `event.id`) |
| POST | `/v1/webhooks/revenuecat` | — | M5: RevenueCat webhook (ověření `Authorization` tokenu, idempotence dle `event.id`) |

### 13.3 Příklad `POST /v1/lists/:id/optimize`
```json
{
  "data": {
    "date": "2026-10-20",
    "variantA": {
      "chain": "LIDL",
      "totalMinor": 64690,
      "items": [
        { "productId": "prd_mleko", "name": "Mléko polotučné", "quantityBase": 6000,
          "baseUnit": "ML", "packages": 6, "lineTotalMinor": 11940, "unitPriceMinor": 1990 }
      ]
    },
    "variantB": {
      "totalMinor": 59690,
      "totalWithoutPenaltyMinor": 59690,
      "stores": [
        { "chain": "KAUFLAND", "subtotalMinor": 15970,
          "items": [ { "productId": "prd_maslo", "lineTotalMinor": 8980, "unitPriceMinor": 17960 } ] },
        { "chain": "LIDL", "subtotalMinor": 43720, "items": [] }
      ]
    },
    "savingsMinor": 5000,
    "recommendedVariant": "B",
    "warnings": []
  },
  "meta": { "maxStores": 3, "tripPenaltyMinor": 0, "chainsEvaluated": 4 }
}
```

### 13.4 Chybové stavy (doménové)
| HTTP | `code` | Kdy |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Neplatný vstup (chybí `lat/lng`, prázdný dotaz, `validTo < validFrom`) |
| 400 | `INVALID_UNIT` | Nepodporovaná jednotka v importu |
| 401 | `UNAUTHORIZED` | Chybějící/expirovaný token |
| 403 | `PREMIUM_REQUIRED` | Funkce jen pro PREMIUM |
| 403 | `PLAN_LIMIT_REACHED` | Překročen limit tarifu (seznamy, alerty, položky) |
| 404 | `NOT_FOUND` | Neexistující entita nebo cizí entita (nesmí prozradit existenci) |
| 409 | `CONFLICT` | Duplicitní e-mail, duplicitní leták (`chain + validFrom + validTo`) |
| 429 | `RATE_LIMITED` | Překročen rate-limit |
| 503 | `DEPENDENCY_UNAVAILABLE` | Výpadek ES/LLM s fallbackem níže |

**Normalizace:** všechny chyby Nestu (validace DTO, 404 z routingu) MUSÍ projít `HttpExceptionFilter`, aby odpověď měla tvar §13.5 a `code` (`VALIDATION_ERROR`, `NOT_FOUND`, …).

**Fallbacky:** při výpadku Elasticsearch MUSÍ vyhledávání přejít na PostgreSQL trigram (pomalejší, ale funkční) a vrátit hlavičku `X-Search-Fallback: postgres`. Při výpadku LLM MUSÍ být AI funkce nedostupná s `503 DEPENDENCY_UNAVAILABLE`, ale F1–F5 MUSÍ fungovat dál.

### 13.5 Formát chyby
```json
{
  "error": {
    "code": "PREMIUM_REQUIRED",
    "message": "Optimalizace nákupu je dostupná v tarifu Premium.",
    "details": { "requiredPlan": "PREMIUM" },
    "requestId": "req_01HXYZ"
  }
}
```

---

## 14. Import dat (ETL)

### 14.1 Zdroj v MVP a v produkci
- **MVP (vývoj, testy, demo):** statické JSON fixture v `packages/seed-data/leaflets/*.json` (§19). Zdroj `SEED`.
- **Produkce (rozhodnutí D16, §14.5):** scraping webů/PDF řetězců přes adaptéry, zdroj `SCRAPE`; ruční kurátorování (`MANUAL`) jako fallback při selhání parseru.
- Import se spouští CLI příkazem `npm run seed --workspace=apps/api` (idempotentní) a cronem `0 5 * * *` (Europe/Prague).

### 14.2 Validační pravidla (MUSÍ platit všechna)
| # | Pravidlo | Chyba |
|---|---|---|
| 1 | `chain` existuje a `is_active = true` | `INVALID_CHAIN` |
| 2 | `validTo >= validFrom`; rozsah max 31 dní | `INVALID_VALIDITY` |
| 3 | `price > 0` a `price <= 100 000 Kč` | `INVALID_PRICE` |
| 4 | `regularPrice > price`, pokud je uveden | `INVALID_REGULAR_PRICE` |
| 5 | `packageAmount > 0`; jednotka z §10.2 | `INVALID_UNIT` |
| 6 | `name` neprázdný, max 255 znaků | `INVALID_PRODUCT_NAME` |
| 7 | každý produkt v letáku max 1× (unikátní `name + packageAmount + packageUnit`) | `DUPLICATE_PRODUCT` |
| 8 | `category` z číselníku, jinak `Ostatní` | — (normalizace) |

### 14.3 Idempotence a verzování
1. Klíč letáku = `(chain, validFrom, validTo)`.
2. `checksum` = SHA-256 kanonického JSON (klíče seřazené, čísla bez mezer).
3. Stejný `checksum` → import je **no-op** (`skipped: 1`).
4. Jiný `checksum` u existujícího letáku → **replace**: smazat staré `promotions` a vložit nové v jedné transakci (nikdy částečný stav).
5. Produkty se párují primárně dle `name` + `packageAmount` + `packageUnit`; pokud neexistují, MUSÍ se vytvořit nový `products` záznam (`base_unit` a `pricing_mode` dle jednotky, `WEIGHT` pouze pokud je jednotka `kg`/`l` a jde o nebalené zboží označené v datech).
6. Po úspěšném importu MUSÍ job: přepočítat `price_history_points` pro dotčené produkty, invalidovat Redis cache (`leaflet:*`, `search:*`, `optimize:*`) a přeindexovat ES.

### 14.4 Výstup importu (report)
```json
{ "leafletsImported": 4, "leafletsSkipped": 0, "promotionsUpserted": 20,
  "productsCreated": 5, "errors": [] }
```
Import MUSÍ skončit nenulovým exit kódem, pokud `errors` obsahuje jakoukoli položku (aby selhal CI).

### 14.5 Scraping pipeline a právní gate (rozhodnutí D16)

Produkční ingest letáků probíhá scrapingem. Scraping MUSÍ být izolován za adaptérovou vrstvou a MUSÍ být **vypnutelný per řetězec** bez nasazení nového kódu.

**Architektura (jedna cesta pro všechny zdroje):**
```
fetch → raw snapshot (SHA-256) → parse → normalize → JSON kontrakt (§5 F1)
      → validace (§14.2) → idempotentní upsert (§14.3) → cache invalidace + ES reindex
```
| Vrstva | Pravidlo |
|---|---|
| `LeafletSourceAdapter` | Interface `fetch(chain): RawSnapshot` + `parse(raw): LeafletDto`. Implementace per řetězec (`lidl.adapter.ts`, …). |
| Raw snapshot | MUSÍ se ukládat (`storage/raw/{chain}/{validFrom}/{sha256}.html` nebo `.pdf`) — umožňuje re-parse bez opakovaného fetchování a slouží jako důkaz obsahu k datu. |
| PDF | Primárně textová vrstva; OCR (Tesseract) jen jako fallback pro stránky bez textu. OCR MUSÍ být feature-flagované (nákladné). |
| Harmonogram | 2× týdně (po a čt 05:00 `Europe/Prague`, letáky se obvykle střídají k pondělí/čtvrtku) + ruční trigger přes CLI. |
| Retry | Max 3 pokusy s exponenciálním backoffem (1 min, 5 min, 15 min); po 3. selhání stav `FAILED` + notifikace adminovi. |
| Circuit breaker | 2 po sobě jdoucí selhání řetězce → adaptér pozastaven do manuálního zásahu. |
| Quarantine | Pokud počet parsovaných produktů klesne o **> 40 %** proti předchozímu letáku téhož řetězce, import se **NEZAPÍŠE** (`QUARANTINED`) — ochrana proti rozbitému parseru, který by „snížil“ ceny. |

**Právní gate (MUSÍ být splněn PŘED zapnutím řetězce):**
1. Záznam o kontrole ToS a `robots.txt` (datum, verze dokumentu, kdo zkontroloval) v `dev/legal-sources.md`.
2. Respektovat `robots.txt` a `Crawl-delay`; max **1 request / 2 s / doména**; vlastní `User-Agent` s kontaktem.
3. NESMÍ se obcházet CAPTCHA, paywall ani přihlašovací zeď.
4. Ukládat pouze **ceny, názvy a balení**; **obrázky letáků se neukládají** (autorská práva) — jen URL zdroje.
5. Takedown proces: na žádost řetězce do 48 h vypnout `legalApproved` a smazat raw snapshoty.
6. Bez záznamu MUSÍ být `chains.legal_approved = false` → adaptér vrací `SKIPPED_LEGAL` a řetězec se v aplikaci chová jako „ceny nejsou k dispozici“.

**Testování parserů:** každý adaptér MUSÍ mít archivovaný reálný snapshot (HTML/PDF) a contract test, který z něj vrátí přesně očekávaný JSON. Testy NESMÍ nikdy sahat na síť (CI offline).

**Rizika a mitigace:**
| Riziko | Mitigace |
|---|---|
| Změna HTML/PDF struktury | Contract testy nad snapshoty + quarantine + alert adminovi |
| PDF bez textové vrstvy | OCR fallback, jinak ruční kurátorování (`MANUAL`) |
| Anti-bot ochrana / IP blokace | Zpomalení, jednání o partnerství, fallback na feed nebo ruční zadání |
| Právní spor (ToS, databázová práva) | Právní gate, žádné obrázky, takedown proces, možnost okamžitého vypnutí |
| Nekonzistentní názvy a balení napříč řetězci | Normalizace (§10) + aliasy (§12) + `SUGGESTED` stav pro nejisté shody |

---

## 15. Ne-funkční požadavky

### 15.1 Výkon (SLO, produkční objemy)
| Operace | Objem | Cíl (p95) |
|---|---|---|
| `GET /products/search` | 100 000 promotions, 20 000 produktů | ≤ 300 ms |
| `POST /lists/:id/optimize` | 30 položek × 10 řetězců | ≤ 500 ms |
| `GET /stores/nearby` | 5 000 prodejen | ≤ 200 ms |
| `GET /leaflets` | 50 aktivních letáků | ≤ 250 ms |

### 15.2 Dostupnost a odolnost
- API MUSÍ být bezstavové (škálování horizontálně), session jen v JWT.
- Externí závislosti (ES, LLM, push) MUSÍ mít timeout (ES 2 s, LLM 20 s, push 10 s) a fallback dle §13.4.
- Retry s exponenciálním backoffem max 3× jen u idempotentních operací.

### 15.3 Bezpečnost
- Hesla Argon2id (min. `memoryCost 19456`, `timeCost 2`), NIKDY plaintext ani MD5.
- Rate-limit dle §13.1; login max 5 pokusů/15 min/IP.
- Všechny dotazy MUSÍ jít přes parametrizované ORM (žádné string SQL s uživatelským vstupem).
- Přístup ke sdíleným entitám MUSÍ být ověřen členstvím v domácnosti (IDOR ochrana) — test MUSÍ existovat.
- Logy NESMÍ obsahovat hesla, tokeny ani celé e-maily (maskovat).
- Webhooky (Stripe/RevenueCat) MUSÍ ověřovat podpis/token a MUSÍ být idempotentní dle `event.id`; bez ověření MUSÍ vrátit `401 UNAUTHORIZED`.

### 15.4 GDPR a soukromí
- Poloha se NESMÍ ukládat na server; `lat/lng` se používají pouze pro výpočet odpovědi.
- Uživatel MUSÍ mít `GET /v1/me/export` (JSON export) a `DELETE /v1/me` (anonymizace do 30 dnů).
- Push tokeny se mažou při odhlášení zařízení.
- Data o nákupech NESMÍ být použita pro reklamu třetích stran.

### 15.5 UX / i18n / a11y
- Veškeré texty v `cs-CZ`, formát měny `1 234,50 Kč` (`Intl.NumberFormat('cs-CZ')`).
- Minimální dotyková plocha 44×44 pt, kontrast ≥ 4.5:1, podpora systémového zvětšení písma (persona U3).
- Offline: poslední načtené letáky a seznam MUSÍ být dostupné z lokální cache; offline zápis do seznamu se syncuje při obnovení spojení.
- Prázdné stavy MUSÍ mít vysvětlení a CTA („Přidej položku“, „Zobrazit letáky“).

### 15.6 Observability
- Strukturované JSON logy s `requestId`; metriky (latence endpointů, cache hit ratio, počet importů, chyby matchingu); healthcheck `GET /health` (DB, Redis, ES).

---

## 16. Testovací strategie

1. **Unit (Jest, `packages/shared`):** `unitPriceMinor`, `lineCost` (ceil vs proporcionálně), konverze jednotek, matching confidence thresholds, optimalizátor (golden testy na fixture).
2. **E2E (Supertest + testcontainers):** registrace → přihlášení → seznam → optimalizace; FREE paywall; cizí seznam → `404`.
3. **Kontraktní testy importu:** každé validační pravidlo §14.2 MUSÍ mít negativní test.
4. **Golden test optimalizace:** fixture §19 MUSÍ dát přesně `64690` / `59690` / `5000`.
5. **Determinismus:** 100 náhodných permutací vstupu MUSÍ dát identický výstup (§11.6).
6. **Výkon:** benchmark test optimalizace 30×10 pod 500 ms.
7. Minimální pokrytí doménové logiky 80 %; CI MUSÍ blokovat merge při červených testech.

---

## 17. Rozhodnutí a opravy mezer (decision log)

Tato sekce dokumentuje **všechna** místa, kde původní zadání nestačilo k implementaci, a jak jsou vyřešena. Změna kteréhokoli rozhodnutí MUSÍ být nejdřív zapsána zde.

| ID | Mezera v původním zadání | Rozhodnutí | Odůvodnění |
|---|---|---|---|
| D1 | 9 řetězců v úvodu vs. 4 v MVP vs. 5 na mapě | Registry všech 9 (`is_mvp` flag), import cen pro 4, mapa pro 5 (Penny bez cen) | Jeden číselník, rozšiřitelné bez migrace; mapa může zobrazit i řetězec bez letáku |
| D2 | `Store` byl zároveň řetězec i pobočka; `Promotion.storeId` | Nová entita `chains`; `promotions.chain_id` + volitelný `store_id` (`scope`) | Letákové ceny platí pro celý řetězec; jinak by uživatel dostal cenu z jediné pobočky |
| D3 | Chybělo balení/jednotka u `Product`/`Promotion`; srovnání „Kč/kg“ nebylo možné spočítat | `base_unit` (`G`/`ML`/`PCS`), `package_amount`, `pricing_mode` (`PACKAGE`/`WEIGHT`), `unit_price_minor` | Bez normalizace nelze porovnat 1 l vs 1,5 l; §10 definuje výpočet |
| D4 | `ShoppingListItem` nebyl definován | `raw_text` + `product_id` (nullable) + `match_status`/`match_method`/`match_confidence` | Uživatel nikdy nesmí být blokován nerozpoznanou položkou |
| D5 | „AI optimalizační algoritmus“ bez definice | Dvě varianty (A/B), coverage, `maxStores = 3`, `tripPenaltyMinor`, úspora nikdy negativní, exaktní vyhledávání, deterministické tie-breaky | Musí být testovatelné a reprodukovatelné; §11 je formální spec |
| D6 | Leták nebyl entita; `Promotion` měl vlastní platnost; chyběla běžná cena | Nová entita `leaflets` (nese platnost), `promotions.regular_price_minor`, `discountPercent` dopočítávané | Odstraňuje duplicity a rozpor v platnostech; umožňuje „top slevy“ |
| D7 | Chyběl uživatel, auth a předplatné, přitom monetizace je součástí zadání | `users`, `households`, `subscriptions`, `push_tokens`; server-side guard | Paywall musí být vynucen serverem, ne skrytím v UI |
| D8 | Ceny jako desetinná čísla (`19.90`) | Vše v celých haléřích (`priceMinor`) | Vyhýbá se chybám plovoucí desetinné čárky v součtech |
| D9 | „Historie cen“ bez datového zdroje | `price_history_points` (denní materializace po importu) | Promo data mizí s koncem letáku; historii je nutné ukládat průběžně |
| D10 | Překlepy/synonyma zmíněny, ale bez modelu | `product_aliases` + normalizace + trigram, LLM jen jako fallback | Determinismus a testovatelnost; AI nesmí být na kritické cestě |
| D11 | Import dat nebyl specifikován | JSON kontrakt (§5 F1, §14), validace, checksum, idempotentní replace; zdroj dat řeší D16 | Reprodukovatelné prostředí a možnost měnit zdroj dat bez zásahu do importní logiky |
| D12 | Chyběl API kontrakt, error model, verzování | §13 (REST `/v1`, envelope, doménové chyby, fallbacky) | Bez kontraktu nelze paralelně vyvíjet FE a BE |
| D13 | Hlídač cen bez modelu doručení a throttlingu | `push_tokens`, `last_notified_at`, max 1 notifikace/24 h, jen nové minimum | Zamezení spamování uživatele |
| D14 | Rodinné sdílení bez modelu | `households`, `household_members`, `household_invitations` | Sdílení vyžaduje členství a ověření přístupu (IDOR) |
| D15 | Ilustrativní čísla 865/742/123 Kč nebyla konzistentní s žádnými cenami | Nahrazeno referenční fixture §19: A = 646,90 Kč, B = 596,90 Kč, úspora 50,00 Kč | Čísla v testech musí být odvoditelná z dat |
| D16 | Zdroj letákových dat nebyl určen (Q1) | **Scraping webů/PDF řetězců** jako produkční ingest s **paralelním právním review**; ruční kurátorování jako fallback. Striktní právní gate, per-chain `legal_approved`, adaptérová vrstva, snapshoty a quarantine (§14.5). NENÍ součástí MVP (milník M7) | Nejrychlejší pokrytí a nezávislost na dodavateli; rizika (ToS, změny HTML) jsou adresována gate + contract testy + okamžitelným vypnutím |
| D17 | Není jasné, zda má doporučení zohlednit cestu do dalšího obchodu (Q2) | **`tripPenaltyMinor = 0` fixně v MVP**; parametr zůstává v API i v optimalizátoru (rozsah 0–10 000) pro budoucí A/B test. Uživatelské nastavení MIMO ROZSAH do M4. UI MUSÍ u Varianty B uvést „cena nezahrnuje cestu“ | Nechceme uživateli podsouvat fiktivní náklady ani blokovat vývoj závislostí na poloze; parametr umožní změnu bez migrace |
| D18 | Nebylo určeno, co z F4 dostane FREE uživatel (Q3) | **FREE = Varianta A** (nejlevnější jeden obchod). **PREMIUM = Varianta B + úspora + rozpad kombinace.** Řízeno flagem `freeVariantB` (default `false`). FREE odpověď vrací `variantB: null` a `meta.lockedFeatures: ["VARIANT_B"]` | Uživatel zažije hodnotu („kde nakoupit“), ale skutečná přidaná hodnota kombinace zůstává placená; lepší konverze než nulová ochutnávka i plný paywall |
| D19 | Nebyl určen platební provider (Q4) | **MVP: `provider = MANUAL`** (aktivace adminem/CLI). **M5: RevenueCat** pro iOS/Android (povinné IAP) + **Stripe** pro web, stav se synchronizuje webhooky do `subscriptions` | Odklad integrace neblokuje vývoj; IAP je vyžadován pravidly App Store/Play u digitálního předplatného, RevenueCat sjednocuje obě platformy |
| D20 | Nebyl určen poskytovatel e-mailů (Q5) | **Resend** (transakční e-maily: reset hesla, pozvánky do domácnosti, fallback notifikací), šablony `cs-CZ`; AWS SES jen při >50 tis. e-mailů/měsíc | Nejrychlejší integrace, dobrá doručitelnost, pro MVP nulové náklady; doménu lze snadno ověřit (SPF/DKIM) |
| D21 | Nebylo potvrzeno, zda ES patří do MVP (Q6) | **Elasticsearch primárně** (dle zadání) za `SearchPort` interfacem, **`PostgresTrgmAdapter` jako fallback** (i pro CI bez ES) | Zachovává zadání, ale odolnost vůči výpadku a testovatelnost bez ES; výměna enginu nevyžaduje změnu doménové vrstvy |
| D22 | Nebyla určena retence historie cen (Q7) | **24 měsíců** denních bodů v `price_history_points`; starší data agregovat do `price_history_monthly` (min/avg/max unit price) a denní body mazat | Drží 2 roky srovnatelného grafu (meziroční sezóna), omezuje růst DB a odpovídá GDPR minimalizaci |
| D23 | Spec neměla uložení refresh tokenů, ale vyžaduje refresh (30 dní) a logout | Nová tabulka `refresh_tokens` s **SHA-256 hashem** (nikdy plaintext), rotace při každém refreshi, revokace při logoutu; access token 15 min bez stavu | Umožňuje odhlášení a revokaci bez držení session na serveru; hash chrání DB při úniku |
| D27 | AI poradce potřebuje deterministické chování a limit, který nejde obejít | `date` jen pro ceny; **rate-limit vždy podle skutečného dne** v tabulce `advisor_usage`; `minimalMinor` = min(A, B) nebo `null` | Bez toho by změna `date` obcházela limit a prázdná varianta by hlásila nákup za 0 Kč |
| D25 | Nebylo určeno, co dělat, když není nakonfigurovaný žádný doručovací kanál | Stav `NOT_CONFIGURED` = skip (ne failure), job vrací exit 0; `failed` jen při skutečném selhání doručení | Lokální/CI běh bez Resend klíče a push tokenů nesmí shazovat job |
| D26 | P4 nespecifikovala počet domácností a kdo smí zvát | **1 domácnost na uživatele**, pozvánky jen `OWNER`, max 6 členů, seznam sdílený přes `householdId` s plným přístupem členů | Zjednodušuje model i UI; rozšíření na víc domácností je změna pouze v doméně |
| D24 | `POST /v1/lists/:id/optimize` potřebuje deterministické datum (jinak se testy a demo rozcházejí s platností letáků) | Nepovinný param `date` (`YYYY-MM-DD`), default `todayInPrague()` | Akceptační kritéria i demo nad fixture (§19.3 platí 14.–20. 10.) musí být reprodukovatelná |

---

## 18. Otevřené otázky

**Žádná otevřená otázka nezbývá** — všech 7 otázek z původního zadání je rozhodnuto (odůvodnění v §17).

| Otázka | Téma | Rozhodnutí |
|---|---|---|
| Q1 | Zdroj letákových dat | **D16** — scraping + právní gate (§14.5) |
| Q2 | Penalizace cesty do dalšího obchodu | **D17** — fixně 0, parametr zůstává v API |
| Q3 | Co z F4 dostane FREE uživatel | **D18** — jen Varianta A |
| Q4 | Platby za PREMIUM | **D19** — MANUAL → RevenueCat + Stripe |
| Q5 | Transakční e-maily | **D20** — Resend |
| Q6 | Elasticsearch vs. PostgreSQL | **D21** — ES + PG fallback za `SearchPort` |
| Q7 | Retence historie cen | **D22** — 24 měsíců + měsíční agregace |

**Pravidlo pro nové otázky:** každá nová otázka MUSÍ být zapsána sem s označením `BLOKUJÍCÍ` / `NEBLOKUJÍCÍ` **dřív**, než se podle ní začne psát kód.

---

## 19. Referenční datová sada (fixture) — závazná pro testy

Zdroj: `packages/seed-data/`. Všechny testy (unit, e2e, golden) MUSÍ vycházet z těchto dat, aby byly deterministické.

### 19.1 Produkty
| ID | `canonical_name` | `brand` | `category` | `base_unit` | `package_amount` | `pricing_mode` |
|---|---|---|---|---|---|---|
| `prd_mleko` | Mléko polotučné | Madeta | Mléčné výrobky | `ML` | 1000 | `PACKAGE` |
| `prd_maslo` | Máslo | Madeta | Mléčné výrobky | `G` | 250 | `PACKAGE` |
| `prd_kureci_prsa` | Kuřecí prsa | — | Maso a ryby | `G` | 1000 | `WEIGHT` |
| `prd_banany` | Banány | — | Ovoce a zelenina | `G` | 1000 | `WEIGHT` |
| `prd_toaletni_papir` | Toaletní papír 8 rolí | Zewa | Drogerie | `PCS` | 8 | `PACKAGE` |
| `prd_coca_cola` | Coca-Cola Original 1.5 l | Coca-Cola | Nápoje | `ML` | 1500 | `PACKAGE` |

### 19.2 Aliasy
| Alias (normalizovaný) | Produkt | Účel |
|---|---|---|
| `mliko`, `mleko` | `prd_mleko` | překlep / bez diakritiky |
| `toaletak`, `toaletni papir`, `papir` | `prd_toaletni_papir` | hovorový výraz |
| `kureci prsa`, `kureci prsicka` | `prd_kureci_prsa` | synonymum |
| `coca cola`, `cocacola` | `prd_coca_cola` | rozpoznání značky |

### 19.3 Letáky (všechny `2026-10-14` – `2026-10-20`, `source = SEED`)
LIDL, KAUFLAND, ALBERT, BILLA (4 letáky).

### 19.4 Ceny akcí (`price_minor`, haléře za balení; u `WEIGHT` za 1000 g)
| Produkt | LIDL | ALBERT | KAUFLAND | BILLA |
|---|---|---|---|---|
| Mléko polotučné 1 l | 1990 | 2490 | 2790 | 2690 |
| Máslo 250 g | 5490 | 5290 | **4490** | 5690 |
| Kuřecí prsa (1 kg) | **12900** | 13900 | 13500 | 14900 |
| Banány (1 kg) | **2990** | 3490 | 3990 | 3690 |
| Toaletní papír 8 rolí | 9990 | 9490 | **6990** | — (nemá) |
| Coca-Cola 1.5 l | — | 3290 | 3490 | 3390 |

### 19.5 Seznam „Týdenní nákup“
| Položka | `quantity_base` | `base_unit` | balení nutných k nákupu |
|---|---|---|---|
| Mléko polotučné | 6000 | `ML` | 6 |
| Máslo | 500 | `G` | 2 |
| Kuřecí prsa | 2000 | `G` | 2 kg (proporcionálně) |
| Banány | 2000 | `G` | 2 kg (proporcionálně) |
| Toaletní papír 8 rolí | 8 | `PCS` | 1 |

### 19.6 Očekávané výsledky (MUSÍ být v testech natvrdo)
| Výstup | Hodnota |
|---|---|
| Ceny řádků — Lidl | 11940 / 10980 / 25800 / 5980 / 9990 |
| Ceny řádků — Albert | 14940 / 10580 / 27800 / 6980 / 9490 |
| Ceny řádků — Kaufland | 16740 / 8980 / 27000 / 7980 / 6990 |
| Celkem 1 obchod — LIDL | **64690** (646,90 Kč) |
| Celkem 1 obchod — KAUFLAND | 67690 |
| Celkem 1 obchod — ALBERT | 69790 |
| Celkem 1 obchod — BILLA | neplatné (chybí Toaletní papír; bez něj 64700) |
| Varianta A | `LIDL` = **64690** |
| Varianta B | `LIDL` (43720) + `KAUFLAND` (15970) = **59690** |
| Úspora | **5000** (50,00 Kč) |
| Doporučení | `B` |
| Search „kuřecí prsa“ | Lidl 12900 → Kaufland 13500 → Albert 13900 → Billa 14900 |
| Search „mliko“ | `prd_mleko`, `match_method = TRIGRAM` |
| Search „toaleťák“ | `prd_toaletni_papir`, `match_method = ALIAS` |

Kontrolní přepočet unit price: Kaufland máslo `4490 / 250 × 1000 = 17960` → 179,60 Kč/kg.

### 19.7 Prodejny (F5)
`STORE_SEED` v `@slevari/shared` obsahuje **9 prodejen** v Praze: LIDL ×2, BILLA ×2, PENNY ×1, ALBERT ×2, KAUFLAND ×2 (souřadnice jsou přibližné, produkční data = Q1).
Očekávané výsledky `GET /v1/stores/nearby?lat=50.081&lng=14.427&radiusKm=5&activeOn=2026-10-20`: **9 prodejen**, seřazené dle vzdálenosti, max **3 971 m**, PENNY má `hasActiveLeaflet = false` (bez letáku), dotaz z Brna vrací 0.

---

## 20. Roadmapa implementace (milníky)

| Milník | Obsah | Definition of Done |
|---|---|---|
| **M0** Scaffold | Monorepo, `docker-compose`, NestJS skeleton, Expo app, `packages/shared`, CI (lint + test + build) | `docker compose up` + `npm test` projde na čistém klonu |
| **M1** Data & import | Migrace (§9), seed fixture (§19), import CLI s validacemi (§14), ES index | Import 4 letáků / 20 akcí, re-run je no-op, negativní testy validací |
| **M2** F1 + F2 | Endpointy letáků a vyhledávání, matching pipeline (bez LLM), cache | Akceptační kritéria F1 a F2 splněna |
| **M3** F3 + F4 + auth | Auth, seznamy, optimalizátor v `packages/shared` s golden testy, plán FREE/PREMIUM | Golden testy 64690/59690/5000; determinismus 100 permutací |
| **M4** F5 + klienti | Mapa, mobilní a webové obrazovky F1–F5, offline cache | Demo scénář na zařízení i webu |
| **M5** Premium | P2 (push), P3 (historie), P4 (domácnosti), paywall UX | Premium funkce dostupné jen s aktivním `subscriptions` záznamem |
| **M6** P1 AI poradce | LLM integrace, JSON schéma, fallback šablona, rate-limit, audit log | AI nedostupné → aplikace funguje dál; žádná AI cena se nedostane do DB |
| **M7** Scraping ingest (§14.5) | Adaptéry per řetězec, snapshoty, PDF/OCR fallback, quarantine, monitoring, contract testy nad archivovanými snapshoty | Pro každý řetězec: `legal_approved = true` + záznam v `dev/legal-sources.md`; parser projde contract testem; quarantine zablokuje pokles > 40 %; adaptér lze vypnout flagem bez nasazení |

**Doporučené pořadí:** M0 → M1 → M3 (doménová logika + testy) → M2 → M4 → M5 → M6 → M7. Optimalizátor (M3) je jádro produktu a MUSÍ být hotový a otestovaný dřív než UI.
**Produkční gate:** nasazení do produkce je povoleno až po M7 pro alespoň 1 řetězec **nebo** po rozhodnutí provozovat pilot na ručním kurátorování (`MANUAL`) — v obou případech platí právní gate (§14.5).

### 20.1 Stav implementace (k 2026-10-20)

| Co | Stav | Kde |
|---|---|---|
| Doménové jádro (část M3, bez DB) — peníze, jednotky, jednotková cena, optimalizátor | ✅ hotovo | `packages/shared/src/{errors,money,units,pricing,optimizer}.ts` |
| Fixture §19 jako spustitelný a exportovaný kód | ✅ hotovo | `packages/shared/src/fixtures/mvpFixture.ts` (`import { OFFERS, SHOPPING_LIST } from '@slevari/shared'`) |
| Testy jádra (unit + golden + determinismus + výkon) | ✅ 56 testů, coverage 95 % stmts / 91 % branches | `packages/shared/src/__tests__/*.test.ts` |
| **M0** scaffold: git, `apps/api` (NestJS), `apps/mobile` (Expo), `docker-compose`, CI | ✅ hotovo | `apps/*`, `docker-compose.yml`, `.github/workflows/ci.yml` |
| API testy (unit + e2e přes Supertest, včetně paywallu D18 a mapování doménových chyb) | ✅ 25 testů | `apps/api/src/**/*.spec.ts`, `apps/api/test/*.e2e-spec.ts` |
| **M1** Postgres schéma (§9) + migrace `0001_init` (CHECKy, `search_text` GENERATED, GIN trgm, partial unique) | ✅ hotovo, aplikováno na Postgres 16 | `apps/api/prisma/` |
| **M1** Validace importu §14.2 + mapper + checksum + idempotence + quarantine | ✅ hotovo | `packages/shared/src/import/*`, `apps/api/src/import/*` |
| **M1** Seed data (`@slevari/seed-data`) + CLI `npm run seed` | ✅ hotovo: 9 řetězců, 4 letáky, 22 akcí, 6 produktů, 154 bodů historie, 12 aliasů | `packages/seed-data/`, `apps/api/src/cli/seed.ts` |
| Ověření DB bez Dockeru (`embedded-postgres`, 2× seed = idempotence) | ✅ `npm run db:verify --workspace=@slevari/api` | `apps/api/scripts/verify-db.mjs` |
| **M2** Matching pipeline §12 (normalizace, aliasy, pg_trgm kompatibilní trigramy, Damerau-Levenshtein) | ✅ 94 testů v `@slevari/shared` | `packages/shared/src/matching/*` |
| **M2** `SearchPort` + `PostgresSearchAdapter` (word_similarity) + `ElasticSearchAdapter` + fallback (D21) | ✅ SQL ověřen na Postgresu, ES adaptér testovaný s fake klientem | `apps/api/src/catalog/*` |
| **M2** Endpointy F1/F2: `/v1/chains`, `/v1/leaflets`, `/v1/leaflets/:id/products`, `/v1/products/search` | ✅ 43 testů API (e2e přes Supertest) | `apps/api/src/catalog/` |
| **M3** Auth: registrace/login/refresh/logout, Argon2id, JWT access 15 min, rotace refresh tokenů (D23) | ✅ 7 unit + e2e, live ověřeno | `apps/api/src/auth/`, migrace `0002_refresh_tokens` |
| **M3** Seznamy v DB: CRUD, limity FREE (1 seznam/30 položek), matching položek, potvrzení shody, IDOR ochrana | ✅ unit + e2e | `apps/api/src/lists/` |
| **M3** `POST /v1/lists/:id/optimize` nad DB: ceny z akcí, tarif ze `subscriptions`, `date` (D24), `includeVariantB` → 403 pro FREE | ✅ live: FREE A=32 710 (KAUFLAND), PREMIUM B=27 910, úspora 4 800 | `apps/api/src/lists/lists.service.ts` |
| **M3** `subscriptions.user_id` UNIQUE (spec §9.9) | ✅ migrace `0003_subscription_user_unique` | `prisma/migrations/` |
| **M4** `apps/web` (Next.js 14, App Router): F1 letáky + detail, F2 hledání, F3 seznamy, F4 optimalizace s paywallem, auth | ✅ `next build` prošel (6 rout), 17 testů lib vrstvy, 4 routy vrací 200 | `apps/web/` |
| **M4** sjednocení Reactu na 18.2 kvůli duplicitním kopiím (Expo vs. Next) | ✅ `overrides` v root `package.json` | `package.json` |
| **M5** P2 hlídač cen: CRUD, Expo push + Resend fallback, evaluační job (throttle 24 h, nové minimum, `NOT_CONFIGURED`) | ✅ 17 testů, migrace `0004`, `npm run alerts:evaluate` | `apps/api/src/alerts/`, `src/cli/evaluate-alerts.ts` |
| **M5** P3 historie cen: denní body + měsíční agregace, přerušení při změně balení, statistiky, PREMIUM gate | ✅ 8 testů, live: 4 řetězce × 7 dní, min 1990 / max 2790 | `apps/api/src/catalog/price-history.ts`, `GET /v1/products/:id/history` |
| **M5** P4 domácnosti: pozvánky s hashovaným tokenem (7 dní), přijetí, odebírání členů, sdílené seznamy s IDOR ochranou | ✅ 12 testů, live: pozvánka → přijetí → sdílený seznam 200 → odebrání → 404 | `apps/api/src/households/` |
| **M5** Web UI pro premium: `/history/[productId]`, `/alerts`, `/households` | ✅ `next build` 10 rout | `apps/web/app/` |
| **F5** `GET /v1/stores/nearby` (bounding box + haversine v SQL, `hasActiveLeaflet`, max 100/25 km) + seed 9 prodejen | ✅ 3 testy, live: 9 prodejen / 5 řetězců / max 3 971 m / Brno 0 | `apps/api/src/stores/`, `packages/shared/src/fixtures/stores.ts` |
| **F5** Web `/stores` (OpenStreetMap embed, geolokace s fallbackem, radius 1–25 km, seznam s vzdálenostmi) | ✅ `next build` 11 rout | `apps/web/app/stores/page.tsx` |
| **F5** Mobil napojený na API (F1 letáky, F2 hledání, F5 prodejny) | ✅ typecheck; API URL přes `EXPO_PUBLIC_API_URL` | `apps/mobile/App.tsx`, `apps/mobile/src/api.ts` |
| Normalizace HTTP chyb na kontrakt §13.5 (`VALIDATION_ERROR`, `NOT_FOUND`, …) | ✅ `HttpExceptionFilter` | `apps/api/src/common/http-exception.filter.ts` |
| **M6** P1 AI poradce: striktní JSON parser, prompt s katalogem, šablona jako fallback, rate-limit 10/den, budget check, migrace `0005_advisor_usage` | ✅ 8 testů API + 4 shared; live: FREE 403, TEMPLATE fallback, A 60 710 / B 55 710 / úspora 5 000, 11. dotaz 429 | `apps/api/src/advisor/`, `packages/shared/src/advisor/` |
| **M6** Web `/advisor` (text + rozpočet, zdroj odpovědi, navržený seznam, optimalizace, budget banner) | ✅ `next build` 12 rout | `apps/web/app/advisor/page.tsx` |
| `apps/web` (Next.js) | ⛔ M4 | — |

**Ověřeno na Postgresu 16 (`db:verify`):** `mliko → Mléko polotučné`, `toaletak → Toaletní papír 8 rolí`, `kureci → Kuřecí prsa`; `similarity('mliko','mleko') = 0,33` (proto §12.1 prahy 0,60/0,40 + edit-distance pravidlo).

**Zjištění z M1 (zapsáno do §12.1):** reálné pg_trgm `similarity('mliko','mleko') = 0,33` — původní předpoklad „≈0,8“ byl chybný, proto jsou prahy nastavené na 0,60/0,35 a pro krátké tokeny platí pravidlo edit-distance ≤ 1.

Ověření (bez DB): `npm install && npm run build --workspace=@slevari/shared && npm test` (Node ≥ 20).
Live kontrola: `npm run dev --workspace=@slevari/api` → `GET /health`, `POST /v1/optimizer/preview`.
