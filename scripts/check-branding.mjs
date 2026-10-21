#!/usr/bin/env node
/**
 * Guard proti návratu původního názvu projektu.
 *
 * Projekt se jmenuje "Lovec Slev" (npm scope @lovecslev). Původní označení
 * repozitáře, npm scope ani produktu se už nesmí objevit v žádném verzovaném
 * souboru — viz `npm run branding:check`.
 *
 * Kontrolují se jen soubory z `git ls-files`, takže lokální build artefakty
 * (.next, dist, coverage) do výsledku nevstupují.
 *
 * Pozor: tento soubor se také skenuje, proto se hledané řetězce skládají
 * z částí — kdyby tu byly jako literály, guard by našel sám sebe.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Poskládá hledaný výraz z částí, aby v tomto souboru nebyl nikdy souvisle. */
const skladat = (casti) => new RegExp(casti.join(''), 'i');

/** Původní označení: varianta s "i" (repo, npm scope) a s "ř" (produkt). */
const LEGACY = [skladat(['sle', 'va', 'ri']), skladat(['sle', 'va', 'ři'])];


/** Co naopak v repu být MUSÍ — jinak přejmenování nedrží pohromadě. */
const REQUIRED = [
  { file: 'README.md', pattern: /^# Lovec Slev$/m, popis: 'README nadpis "# Lovec Slev"' },
  { file: 'package.json', pattern: /"name":\s*"lovecslev"/, popis: 'root balíček "lovecslev"' },
  { file: 'apps/mobile/app.json', pattern: /"name":\s*"Lovec Slev"/, popis: 'Expo name "Lovec Slev"' },
  { file: 'apps/mobile/app.json', pattern: /"slug":\s*"lovec-slev"/, popis: 'Expo slug "lovec-slev"' },
  { file: 'apps/web/app/layout.tsx', pattern: /title:\s*'Lovec Slev'/, popis: 'web title "Lovec Slev"' },
  { file: '.env.example', pattern: /postgresql:\/\/lovecslev:/, popis: 'DB credentials "lovecslev"' },
];

const isBinary = (buffer) => buffer.subarray(0, 8000).includes(0);

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'buffer' })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);

const findings = [];
for (const file of tracked) {
  const buffer = readFileSync(file);
  if (isBinary(buffer)) continue;

  const lines = buffer.toString('utf8').split('\n');
  lines.forEach((line, index) => {
    for (const pattern of LEGACY) {
      if (pattern.test(line)) {
        findings.push(`${file}:${index + 1}: ${line.trim().slice(0, 120)}`);
      }
    }
  });
}

const missing = [];
for (const { file, pattern, popis } of REQUIRED) {
  let content = '';
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    missing.push(`${file}: soubor nenalezen (očekáváno ${popis})`);
    continue;
  }
  if (!pattern.test(content)) missing.push(`${file}: chybí ${popis}`);
}

const label = (icon, text) => console.log(`${icon} ${text}`);

if (findings.length > 0) {
  label('✗', `Nalezen původní název v ${findings.length} místě/ech:`);
  for (const finding of findings) console.log(`   ${finding}`);
}
if (missing.length > 0) {
  label('✗', `Chybí nové označení v ${missing.length} místě/ech:`);
  for (const entry of missing) console.log(`   ${entry}`);
}

if (findings.length === 0 && missing.length === 0) {
  label('✓', `Branding OK — ${tracked.length} verzovaných souborů bez původního názvu, nové označení na místě.`);
  process.exit(0);
}

console.error('\nBranding check selhal. Oprav nálezy výše (brand: Lovec Slev, npm scope @lovecslev).');
process.exit(1);
