'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { ChainView, LeafletSummary } from '@/lib/types';

export default function LeafletsPage(): JSX.Element {
  const [leaflets, setLeaflets] = useState<readonly LeafletSummary[]>([]);
  const [chains, setChains] = useState<readonly ChainView[]>([]);
  const [chainFilter, setChainFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const [leafletResponse, chainData] = await Promise.all([api.leaflets(), api.chains()]);
        if (cancelled) return;
        setLeaflets(leafletResponse.data);
        setChains(chainData);
      } catch (cause) {
        if (!cancelled) setError(describeError(cause));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () => (chainFilter === '' ? leaflets : leaflets.filter((leaflet) => leaflet.chainCode === chainFilter)),
    [chainFilter, leaflets],
  );

  return (
    <div>
      <h1>Aktuální letáky</h1>
      <p className="subtitle">Akce českých řetězců platné k dnešnímu dni.</p>

      {error !== null && <p className="error">{error}</p>}
      {loading && <p className="muted">Načítám letáky…</p>}

      <div className="row" style={{ marginBottom: 16 }}>
        <button className={chainFilter === '' ? '' : 'secondary'} onClick={() => setChainFilter('')}>
          Vše ({leaflets.length})
        </button>
        {chains
          .filter((chain) => chain.hasActiveLeaflet)
          .map((chain) => (
            <button
              key={chain.code}
              className={chainFilter === chain.code ? '' : 'secondary'}
              onClick={() => setChainFilter(chain.code)}
            >
              {chain.name}
            </button>
          ))}
      </div>

      {!loading && visible.length === 0 && (
        <p className="notice">Pro zvolený filtr nejsou aktivní žádné letáky.</p>
      )}

      <div className="grid">
        {visible.map((leaflet) => (
          <article key={leaflet.id} className="card">
            <div className="row spread">
              <strong>{leaflet.chainName}</strong>
              <span className="dot" style={{ background: leaflet.colorHex }} />
            </div>
            <p className="muted" style={{ margin: '4px 0 12px' }}>
              {formatDate(leaflet.validFrom)} – {formatDate(leaflet.validTo)} · {leaflet.promotionCount} akcí ·{' '}
              {leaflet.productCount} produktů
            </p>
            <div className="row" style={{ marginBottom: 12 }}>
              {leaflet.topDiscounts.map((discount) => (
                <span key={discount} className="chip">
                  −{discount} %
                </span>
              ))}
            </div>
            <Link href={`/leaflets/${leaflet.id}`} className="nav-link">
              Zobrazit leták →
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
