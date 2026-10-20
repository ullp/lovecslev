'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { readAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatCzk, formatDate } from '@/lib/format';
import type { PriceAlert, ProductSearchResult } from '@/lib/types';

export default function AlertsPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<readonly PriceAlert[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly ProductSearchResult[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const auth = readAuth();
    if (auth === null) {
      router.replace('/login');
      return;
    }
    setToken(auth.tokens.accessToken);
  }, [router]);

  useEffect(() => {
    if (token === null) return;
    let cancelled = false;

    api
      .alerts(token)
      .then((data) => {
        if (!cancelled) setAlerts(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function search(): Promise<void> {
    if (query.trim().length < 2) return;
    try {
      const response = await api.search(query.trim(), { limit: 5 });
      setResults(response.data);
      setSelected(response.data[0]?.productId ?? null);
    } catch (cause) {
      setError(describeError(cause));
    }
  }

  async function create(): Promise<void> {
    if (token === null || selected === null) return;
    const koruna = Number(threshold.replace(',', '.'));
    if (!Number.isFinite(koruna) || koruna <= 0) {
      setError('Zadejte platnou prahovou cenu v Kč.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await api.createAlert(token, {
        productId: selected,
        targetUnitPriceMinor: Math.round(koruna * 100),
      });
      setAlerts(await api.alerts(token));
      setThreshold('');
      setResults([]);
      setQuery('');
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function remove(alertId: string): Promise<void> {
    if (token === null) return;
    setBusy(true);
    try {
      await api.deleteAlert(token, alertId);
      setAlerts(await api.alerts(token));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Hlídač cen</h1>
      <p className="subtitle">
        Premium funkce: upozorníme vás, když cena klesne pod váš práh (max 1× za 24 h).
      </p>

      {error !== null && <p className="error">{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat produkt…"
            aria-label="Produkt pro alert"
            style={{ flex: 1, minWidth: 180 }}
          />
          <button className="secondary" onClick={() => void search()} disabled={busy}>
            Najít
          </button>
        </div>

        {results.length > 0 && (
          <div className="row" style={{ marginTop: 10 }}>
            {results.map((product) => (
              <button
                key={product.productId}
                className={selected === product.productId ? '' : 'secondary'}
                onClick={() => setSelected(product.productId)}
              >
                {product.name}
              </button>
            ))}
          </div>
        )}

        <div className="row" style={{ marginTop: 10 }}>
          <input
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
            placeholder="Prahová cena (Kč)"
            inputMode="decimal"
            aria-label="Prahová cena"
            style={{ width: 170 }}
          />
          <button onClick={() => void create()} disabled={busy || selected === null}>
            Vytvořit alert
          </button>
        </div>
      </div>

      <ul className="list">
        {alerts.map((alert) => (
          <li key={alert.id} className="list-item">
            <span>
              <strong>{alert.productName}</strong>
              <span className="muted">
                {' '}
                · pod {formatCzk(alert.targetUnitPriceMinor)}
                {alert.chainCode === null ? '' : ` · ${alert.chainCode}`}
                {alert.lastNotifiedAt === null
                  ? ''
                  : ` · naposledy ${formatDate(alert.lastNotifiedAt.slice(0, 10))}`}
              </span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <Link href={`/history/${alert.productId}`} className="nav-link">
                Historie
              </Link>
              <button className="danger" onClick={() => void remove(alert.id)} disabled={busy}>
                Smazat
              </button>
            </span>
          </li>
        ))}
      </ul>

      {alerts.length === 0 && <p className="muted">Zatím žádné alerty.</p>}
    </div>
  );
}
