import { createHash } from 'node:crypto';

/**
 * Kanonický JSON: klíče rekurzivně seřazené, bez mezer → stabilní SHA-256.
 * Slouží k idempotenci importu (spec §14.3 bod 2): stejný obsah = stejný checksum
 * bez ohledu na pořadí klíčů ve vstupním souboru.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([key, nested]) => [key, sortValue(nested)]));
  }
  return value;
}

export function sha256(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Checksum letáku pro idempotentní import (spec §14.3). */
export function leafletChecksum(dto: unknown): string {
  return sha256(canonicalJson(dto));
}
