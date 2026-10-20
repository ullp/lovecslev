/**
 * Trigramová podobnost kompatibilní s PostgreSQL `pg_trgm` (`similarity`).
 * pg_trgm bere každé slovo, obalí ho dvěma mezerami zleva a jednou zprava
 * a počítá |A∩B| / |A∪B|. Díky tomu vychází stejná čísla jako v DB
 * (ověřeno: `similarity('mliko','mleko') = 0.333`, spec §12.1).
 */
export function trigramSimilarity(a: string, b: string): number {
  const left = trigramsOf(a);
  const right = trigramsOf(b);
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const trigram of left) {
    if (right.has(trigram)) intersection += 1;
  }

  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Rozhodovací metrika pro matching: nejlepší podobnost dotazu vůči některému
 * slovu textu. Odpovídá chování `word_similarity(query, text)` v pg_trgm
 * (dotaz se porovnává s částí textu, ne s celým názvem).
 */
export function bestWordSimilarity(query: string, text: string): number {
  const textWords = words(text);
  let best = 0;

  for (const queryWord of words(query)) {
    for (const textWord of textWords) {
      best = Math.max(best, trigramSimilarity(queryWord, textWord));
    }
  }

  return best;
}

/** Damerau-Levenshteinova vzdálenost (transpozice = 1 operace). */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i += 1) rows.push(new Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) rows[i]![0] = i;
  for (let j = 0; j <= b.length; j += 1) rows[0]![j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const row = rows[i]!;
      row[j] = Math.min(
        rows[i - 1]![j]! + 1,
        row[j - 1]! + 1,
        rows[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j]!, rows[i - 2]![j - 2]! + 1);
      }
    }
  }

  return rows[a.length]![b.length]!;
}

function trigramsOf(input: string): Set<string> {
  const result = new Set<string>();
  for (const word of words(input)) {
    const padded = `  ${word} `;
    for (let index = 0; index + 3 <= padded.length; index += 1) {
      result.add(padded.slice(index, index + 3));
    }
  }
  return result;
}

function words(input: string): string[] {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);
}
