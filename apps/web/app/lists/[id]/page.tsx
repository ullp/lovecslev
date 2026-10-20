'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { readAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatQuantity } from '@/lib/format';
import type { ListDetail, ListItem, OptimizationResult } from '@/lib/types';
import { ConfirmButton, OptimizationView } from '@/components/list-detail-parts';

const STATUS_LABEL: Record<ListItem['matchStatus'], string> = {
  RESOLVED_AUTO: 'rozpoznáno',
  RESOLVED_CONFIRMED: 'potvrzeno',
  SUGGESTED: 'návrh',
  UNRESOLVED: 'nerozpoznáno',
};

export default function ListDetailPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listId = params.id;

  const [token, setToken] = useState<string | null>(null);
  const [list, setList] = useState<ListDetail | null>(null);
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null);
  const [rawText, setRawText] = useState('');
  const [date, setDate] = useState('');
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
      .list(token, listId)
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [token, listId]);

  async function reload(currentToken: string): Promise<void> {
    setList(await api.list(currentToken, listId));
  }

  async function addItem(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (token === null || rawText.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await api.addItem(token, listId, { rawText: rawText.trim() });
      setRawText('');
      await reload(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(itemId: string): Promise<void> {
    if (token === null) return;
    setBusy(true);
    try {
      await api.deleteItem(token, listId, itemId);
      await reload(token);
      setOptimization(null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function confirmItem(itemId: string, productId: string): Promise<void> {
    if (token === null) return;
    setBusy(true);
    try {
      await api.updateItem(token, listId, itemId, { productId });
      await reload(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function optimize(): Promise<void> {
    if (token === null) return;
    setBusy(true);
    setError(null);
    try {
      setOptimization(await api.optimize(token, listId, date === '' ? {} : { date }));
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && list === null) return <p className="error">{error}</p>;
  if (list === null) return <p className="muted">Načítám seznam…</p>;

  return (
    <div>
      <Link href="/lists" className="nav-link">
        ← Zpět na seznamy
      </Link>
      <h1 style={{ marginTop: 12 }}>{list.name}</h1>
      <p className="subtitle">{list.items.length} položek</p>

      {error !== null && <p className="error">{error}</p>}

      <form className="row" onSubmit={addItem} style={{ marginBottom: 16 }}>
        <input
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder="Např. mléko, máslo, toaleťák…"
          style={{ flex: 1, minWidth: 200 }}
          aria-label="Nová položka"
        />
        <button type="submit" disabled={busy}>
          Přidat
        </button>
      </form>

      <ul className="list">
        {list.items.map((item) => (
          <li key={item.id} className="list-item">
            <span>
              <strong>{item.rawText}</strong>
              <span className="muted"> · {formatQuantity(item.quantityBase, item.baseUnit)}</span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <span
                className={`chip ${
                  item.matchStatus === 'RESOLVED_AUTO' || item.matchStatus === 'RESOLVED_CONFIRMED'
                    ? ''
                    : 'chip-warn'
                }`}
              >
                {STATUS_LABEL[item.matchStatus]}
              </span>
              {item.productId !== null && (
                <Link href={`/history/${item.productId}`} className="nav-link">
                  Historie ceny
                </Link>
              )}
              {item.productId === null && (
                <ConfirmButton
                  disabled={busy}
                  onConfirm={(productId: string) => void confirmItem(item.id, productId)}
                />
              )}
              <button className="danger" onClick={() => void removeItem(item.id)} disabled={busy}>
                Odebrat
              </button>
            </span>
          </li>
        ))}
      </ul>

      {list.items.length === 0 && <p className="muted">Seznam je prázdný.</p>}

      <h2>Nejlevnější nákup</h2>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="muted">
          Datum platnosti akcí{' '}
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <button onClick={optimize} disabled={busy || list.items.length === 0}>
          Spočítat
        </button>
      </div>

      {optimization !== null && <OptimizationView result={optimization} />}
    </div>
  );
}
