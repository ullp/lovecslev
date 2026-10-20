import type { ElasticClientLike, ElasticHit } from './search.adapters';

/**
 * Minimální HTTP klient pro Elasticsearch (bez oficiální knihovny).
 * Timeout 2 s dle §15.2 — při výpadku ES se použije PostgreSQL fallback.
 */
export class HttpElasticClient implements ElasticClientLike {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = 2000,
  ) {}

  async search(params: {
    index: string;
    size: number;
    query: Record<string, unknown>;
  }): Promise<{ hits: { hits: readonly ElasticHit[] } }> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/${params.index}/_search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ size: params.size, query: params.query }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Elasticsearch odpověděl ${response.status}`);
    }

    return (await response.json()) as { hits: { hits: readonly ElasticHit[] } };
  }
}
