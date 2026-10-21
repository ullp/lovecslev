import type { LeafletImportDto } from '@lovecslev/shared';

/** Surový snapshot stránky/PDF — ukládá se jako důkaz obsahu (spec §14.5). */
export interface RawSnapshot {
  readonly chainCode: string;
  readonly contentType: 'text/html' | 'application/pdf' | 'application/json';
  readonly body: string;
  readonly sourceUrl: string;
  readonly fetchedAt: Date;
}

/** Adaptér per řetězec (spec §14.5). MUSÍ být nahraditelný fake implementací v testech. */
export interface LeafletSourceAdapter {
  readonly chainCode: string;
  fetch(period: { validFrom: string; validTo: string }): Promise<RawSnapshot>;
  parse(snapshot: RawSnapshot): LeafletImportDto;
}

export interface SnapshotStore {
  /** Uloží snapshot a vrátí relativní cestu + SHA-256 (spec §14.5: `storage/raw/{chain}/{validFrom}/{sha}`). */
  save(snapshot: RawSnapshot, validFrom: string): Promise<{ path: string; sha256: string }>;
}

export const SNAPSHOT_STORE = Symbol('SNAPSHOT_STORE');

export const ADAPTER_REGISTRY = Symbol('ADAPTER_REGISTRY');

export interface ChainScrapeTarget {
  readonly id: string;
  readonly code: string;
  readonly legalApproved: boolean;
  readonly failures: number;
  readonly pausedUntil: Date | null;
}

/** Port pro stav scrapingu (legal gate + circuit breaker). */
export interface ScrapeChainRepository {
  listTargets(): Promise<readonly ChainScrapeTarget[]>;
  recordFailure(chainId: string, pauseUntil: Date, failures: number): Promise<void>;
  resetFailures(chainId: string): Promise<void>;
}

export const SCRAPE_CHAIN_REPOSITORY = Symbol('SCRAPE_CHAIN_REPOSITORY');

export type ScrapeStatus =
  | 'IMPORTED'
  | 'UNCHANGED'
  | 'QUARANTINED'
  | 'SKIPPED_LEGAL'
  | 'SKIPPED_PAUSED'
  | 'FAILED'
  | 'SKIPPED_NO_ADAPTER';

export interface ScrapeChainResult {
  readonly chainCode: string;
  readonly status: ScrapeStatus;
  readonly reason?: string;
  readonly snapshotPath?: string;
  readonly promotions?: number;
  readonly quarantined?: boolean;
}

export interface ScrapeReport {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly chains: readonly ScrapeChainResult[];
  readonly imported: number;
  readonly failed: number;
  readonly skipped: number;
}

/** Po 2 po sobě jdoucích selhání se řetězec pozastaví na 6 h (spec §14.5). */
export const CIRCUIT_BREAKER_THRESHOLD = 2;
export const CIRCUIT_BREAKER_PAUSE_HOURS = 6;
/** Zdvořilé tempo: max 1 request / 2 s / doména (spec §14.5). */
export const MIN_REQUEST_INTERVAL_MS = 2000;
