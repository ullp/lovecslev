'use client';

import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { formatCzk, formatDate, formatUnitPriceMinor } from '@/lib/format';
import type { ProductSearchResult, SearchMeta } from '@/lib/types';

export default function SearchPage(): JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly ProductSearchResult[]>([]);
  const [meta, setMeta] = useState<SearchMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (query.trim().length < 2) {
      setError('Zadejte alespoň 2 znaky.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await api.search(query.trim(), { limit: 20 });
      setResults(response.data);
      setMeta(response.meta);
    } catch (cause) {
      setError(describeError(cause));
      setResults([]);
      setMeta(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Hledání produktu</h1>
      <p className="subtitle">Ceny se řadí podle jednotkové ceny (Kč/kg, Kč/l, Kč/ks) — ne podle ceny balení.</p>

      <form className="row" onSubmit={submit} style={{ marginBottom: 16 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Např. kuřecí prsa, mléko, toaleťák…"
          style={{ flex: 1, minWidth: 220 }}
          aria-label="Hledaný produkt"
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Hledám…' : 'Hledat'}
        </button>
      </form>

      {error !== null && <p className="error">{error}</p>}

      {meta !== null && meta.match.status === 'UNRESOLVED' && (
        <div className="notice" style={{ marginBottom: 16 }}>
          Produkt jsme nerozpoznali.
          {meta.suggestions.length > 0 && (
            <span>
              {' '}
              Mysleli jste:{' '}
              {meta.suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.productId}
                  className="secondary"
                  style={{ marginLeft: index === 0 ? 0 : 6, padding: '2px 8px' }}
                  onClick={() => setQuery(suggestion.name)}
                >
                  {suggestion.name}
                </button>
              ))}
            </span>
          )}
        </div>
      )}

      {results.map((product) => (
        <section key={product.productId} className="card" style={{ marginBottom: 12 }}>
          <div className="row spread">
            <strong style={{ fontSize: 18 }}>{product.name}</strong>
            <span className="chip chip-muted">{product.category}</span>
          </div>

          {product.offers.length === 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Produkt existuje, ale teď na něj není žádná akce.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Obchod</th>
                  <th>Cena</th>
                  <th>Jednotková cena</th>
                  <th>Platnost</th>
                </tr>
              </thead>
              <tbody>
                {product.offers.map((offer) => (
                  <tr key={`${product.productId}-${offer.chainCode}`}>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <span className="dot" style={{ background: offer.colorHex }} />
                        {offer.chainName}
                      </span>
                    </td>
                    <td>
                      <span className="price">{formatCzk(offer.priceMinor)}</span>
                      {offer.discountPercent !== null && (
                        <span className="chip" style={{ marginLeft: 8 }}>
                          −{offer.discountPercent} %
                        </span>
                      )}
                    </td>
                    <td>{formatUnitPriceMinor(offer.unitPriceMinor, offer.unitLabel)}</td>
                    <td className="muted">do {formatDate(offer.validTo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}

      {results.length === 0 && meta !== null && meta.match.status !== 'UNRESOLVED' && (
        <p className="muted">Nic jsme nenašli.</p>
      )}

      {meta !== null && meta.match.status !== 'UNRESOLVED' && (
        <p className="muted">
          Shoda: {meta.match.method} ({Math.round(meta.match.confidence * 100)} %), zdroj:{' '}
          {meta.driver === 'elasticsearch' ? 'Elasticsearch' : 'PostgreSQL fallback'} ·{' '}
          <Link href="/lists" className="nav-link">
            přidat do seznamu
          </Link>
        </p>
      )}
    </div>
  );
}
