import type {
  ChainView,
  Envelope,
  LeafletDetail,
  LeafletSummary,
  ListDetail,
  ListItem,
  ListSummary,
  OptimizationResult,
  ProductSearchResult,
  PublicUser,
  SearchMeta,
  TokenPair,
} from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/** Doménová chyba z API (spec §13.5) — kód se používá pro UI hlášky. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(code: string, message: string, status: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  readonly token?: string | null;
  readonly query?: Record<string, string | number | undefined>;
}

export function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined>,
  base: string = API_URL,
): string {
  const root = base.replace(/\/+$/, '');
  if (query === undefined) return `${root}${path}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix === '' ? `${root}${path}` : `${root}${path}?${suffix}`;
}

/** Jediné místo, kde web mluví s API (fetch + envelope + chybový kontrakt). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const payload = await apiRequestWithMeta<T>(path, options);
  // 204 (logout, delete) nemá tělo — nesmíme přistupovat k `.data`.
  return payload === null ? (null as unknown as T) : payload.data;
}

/** Varianta pro endpointy, které vrací i `meta` (search, leaflets). */
export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Envelope<T>> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token !== undefined && options.token !== null) {
    headers.authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    cache: 'no-store',
  });

  const text = await response.text();
  const payload: unknown = text === '' ? null : JSON.parse(text);

  if (!response.ok) {
    const error = (
      payload as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null
    )?.error;
    throw new ApiError(
      error?.code ?? 'UNKNOWN',
      error?.message ?? `API odpovědělo ${response.status}`,
      response.status,
      error?.details ?? {},
    );
  }

  return payload as Envelope<T>;
}
