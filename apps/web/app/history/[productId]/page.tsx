'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { readAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatCzk, formatDate } from '@/lib/format';
import type { PriceHistory } from '@/lib/types';

export default function PriceHistoryPage(): JSX.Element {
  const router = useRouter();
  const params = useParams<{ productId: string }>();
  const productId = params.productId;

  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState('90d');

  useEffect(() => {
    const auth = readAuth();
    if (auth === null) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    api
      .history(auth.tokens.accessToken, productId, range)
      .then((data) => {
        if (!cancelled) {
          setHistory(data);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [productId, range, router]);

  if (error !== null) {
    return (
      <div>
        <h1>Historie ceny</h1>
        <p className="notice">{error}</p>
        <Link href="/lists" className="nav-link">
          ← Zpět na seznamy
        </Link>
      </div>
    );
  }

  if (history === null) return <p className="muted">Načítám historii…</p>;

  const unit = history.unitLabel.replace(/^Kč\//, '');
  const allPoints = history.series.flatMap((serie) => serie.points);
  const max = Math.max(...allPoints.map((point) => point.unitPriceMinor), 1);

  return (
    <div>
      <Link href="/lists" className="nav-link">
        ← Zpět na seznamy
      </Link>
      <h1 style={{ marginTop: 12 }}>{history.productName}</h1>
      <p className="subtitle">
        {formatDate(history.from)} – {formatDate(history.to)} · {history.stats.sampleCount} záznamů
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        {['30d', '90d', '365d'].map((option) => (
          <button
            key={option}
            className={range === option ? '' : 'secondary'}
            onClick={() => setRange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {history.stats.minUnitPriceMinor === null ? (
        <p className="notice">Pro tento produkt zatím nemáme historii cen.</p>
      ) : (
        <>
          <div className="grid">
            <div className="card">
              <p className="muted">Nejnižší cena</p>
              <p className="price">{formatCzk(history.stats.minUnitPriceMinor)} / {unit}</p>
              <p className="muted">
                {history.stats.lowestChainCode} · {history.stats.lowestDate === null ? '—' : formatDate(history.stats.lowestDate)}
              </p>
            </div>
            <div className="card">
              <p className="muted">Průměr</p>
              <p className="price">{formatCzk(history.stats.avgUnitPriceMinor ?? 0)} / {unit}</p>
            </div>
            <div className="card">
              <p className="muted">Nejvyšší cena</p>
              <p className="price">{formatCzk(history.stats.maxUnitPriceMinor ?? 0)} / {unit}</p>
            </div>
          </div>

          {history.series.map((serie) => (
            <section key={serie.chainCode} className="card" style={{ marginTop: 12 }}>
              <div className="row spread">
                <strong>{serie.chainName}</strong>
                <span className="muted">{serie.points.length} bodů</span>
              </div>
              <div className="row" style={{ alignItems: 'flex-end', gap: 3, height: 90, marginTop: 8 }}>
                {serie.points.map((point) => {
                  const height = Math.max(4, Math.round((point.unitPriceMinor / max) * 80));
                  const broken = serie.breaks.includes(point.date);
                  return (
                    <span
                      key={`${serie.chainCode}-${point.date}`}
                      title={`${formatDate(point.date)}: ${formatCzk(point.unitPriceMinor)} / ${unit}${
                        broken ? ' (změna balení)' : ''
                      }`}
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height,
                        borderRadius: 3,
                        background: broken ? 'var(--warn)' : 'var(--accent)',
                        opacity: point.granularity === 'monthly' ? 0.55 : 1,
                      }}
                    />
                  );
                })}
              </div>
              {serie.breaks.length > 0 && (
                <p className="muted">Přerušení: změna balení ke dni {serie.breaks.map(formatDate).join(', ')}</p>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
