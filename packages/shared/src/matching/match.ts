import { normalizeQuery, tokenize } from './normalize';
import { bestWordSimilarity, damerauLevenshtein } from './similarity';

/** Prahy dle spec §12.1 (kalibrováno na naměřené hodnoty pg_trgm). */
export const MATCH_AUTO_THRESHOLD = 0.6;
export const MATCH_SUGGEST_THRESHOLD = 0.4;
export const EDIT_DISTANCE_CONFIDENCE = 0.9;
export const EDIT_DISTANCE_MIN_TOKEN_LENGTH = 4;
export const EDIT_DISTANCE_MAX_TOKEN_LENGTH = 6;

export type MatchMethod = 'EXACT' | 'ALIAS' | 'TRIGRAM' | 'NONE';
export type MatchStatus = 'RESOLVED_AUTO' | 'SUGGESTED' | 'UNRESOLVED';

export interface MatchCandidate {
  readonly productId: string;
  readonly canonicalName: string;
  readonly brand?: string | null;
  /** Normalizované i nenormalizované aliasy (funkce si je znormalizuje). */
  readonly aliases?: readonly string[];
}

export interface ProductMatch {
  readonly productId: string | null;
  readonly method: MatchMethod;
  readonly confidence: number;
  readonly status: MatchStatus;
  /** Na čem se shoda našla (název/alias) — pro UI a audit (spec §12.3). */
  readonly matchedOn: string | null;
}

/**
 * Rozhodnutí o shodě dotazu na produkt (spec §12.1, kroky 2–4).
 * Deterministické: stejný vstup = stejný výstup, nezávisle na pořadí kandidátů.
 */
export function matchProduct(query: string, candidates: readonly MatchCandidate[]): ProductMatch {
  const normalized = normalizeQuery(query);
  if (normalized === '') return unmatched();

  let best: { candidate: MatchCandidate; confidence: number; method: MatchMethod; matchedOn: string } | null =
    null;

  for (const candidate of candidates) {
    const scored = scoreCandidate(normalized, candidate);
    if (scored === null) continue;

    if (
      best === null ||
      scored.confidence > best.confidence ||
      (scored.confidence === best.confidence && candidate.productId < best.candidate.productId)
    ) {
      best = { candidate, ...scored };
    }
  }

  if (best === null) return unmatched();

  if (best.confidence >= MATCH_AUTO_THRESHOLD) {
    return {
      productId: best.candidate.productId,
      method: best.method,
      confidence: round2(best.confidence),
      status: 'RESOLVED_AUTO',
      matchedOn: best.matchedOn,
    };
  }

  if (best.confidence >= MATCH_SUGGEST_THRESHOLD) {
    return {
      productId: best.candidate.productId,
      method: best.method,
      confidence: round2(best.confidence),
      status: 'SUGGESTED',
      matchedOn: best.matchedOn,
    };
  }

  return unmatched();
}

function scoreCandidate(
  normalizedQuery: string,
  candidate: MatchCandidate,
): { confidence: number; method: MatchMethod; matchedOn: string } | null {
  const name = normalizeQuery(candidate.canonicalName);
  if (name === normalizedQuery) {
    return { confidence: 1, method: 'EXACT', matchedOn: candidate.canonicalName };
  }

  for (const alias of candidate.aliases ?? []) {
    if (normalizeQuery(alias) === normalizedQuery) {
      return { confidence: 1, method: 'ALIAS', matchedOn: alias };
    }
  }

  const aliasText = (candidate.aliases ?? []).join(' ');
  const haystack = `${candidate.canonicalName} ${candidate.brand ?? ''} ${aliasText}`.trim();
  const similarity = bestWordSimilarity(normalizedQuery, haystack);

  if (hasEditDistanceOne(normalizedQuery, haystack)) {
    return {
      confidence: Math.max(EDIT_DISTANCE_CONFIDENCE, similarity),
      method: 'TRIGRAM',
      matchedOn: candidate.canonicalName,
    };
  }

  if (similarity <= 0) return null;
  return { confidence: similarity, method: 'TRIGRAM', matchedOn: candidate.canonicalName };
}

/** Krátké tokeny: `distance = 1` je silný signál na překlep (spec §12.1). */
function hasEditDistanceOne(normalizedQuery: string, haystack: string): boolean {
  const queryTokens = tokenize(normalizedQuery).filter(
    (token) => token.length >= EDIT_DISTANCE_MIN_TOKEN_LENGTH && token.length <= EDIT_DISTANCE_MAX_TOKEN_LENGTH,
  );
  if (queryTokens.length === 0) return false;

  const haystackTokens = tokenize(haystack).filter(
    (token) => token.length >= EDIT_DISTANCE_MIN_TOKEN_LENGTH && token.length <= EDIT_DISTANCE_MAX_TOKEN_LENGTH,
  );
  if (haystackTokens.length === 0) return false;

  return queryTokens.some((queryToken) =>
    haystackTokens.some((haystackToken) => damerauLevenshtein(queryToken, haystackToken) === 1),
  );
}

function unmatched(): ProductMatch {
  return { productId: null, method: 'NONE', confidence: 0, status: 'UNRESOLVED', matchedOn: null };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
