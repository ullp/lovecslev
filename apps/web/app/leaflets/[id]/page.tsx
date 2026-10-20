'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { describeError } from '@/lib/errors';
import { formatCzk, formatDate, formatUnitPriceMinor } from '@/lib/format';
import type { LeafletDetail } from '@/lib/types';

const PAGE_SIZE = 20;

export default function LeafletDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const leafletId = params.id;
  const [detail, setDetail] = useState<LeafletDetail | null>(null);
  const [category, setCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        const data = await api.leaflet(leafletId, {
          ...(category === '' ? {} : { category }),
          page,
          pageSize: PAGE_SIZE,
        });
        if (!cancelled) {
          setDetail(data);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) setError(describeError(cause));
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [leafletId, category, page]);

  if (error !== null) return <p className="error">{error}</p>;
  if (detail === null) return <p className="muted">Načítám leták…</p>;

  const totalPages = Math.max(1, Math.ceil(detail.total / detail.pageSize));

  return (
    <div>
      <Link href="/" className="nav-link">
        ← Zpět na letáky
      </Link>
      <h1 style={{ marginTop: 12 }}>{detail.chainName}</h1>
      <p className="subtitle">
        {formatDate(detail.validFrom)} – {formatDate(detail.validTo)} · {detail.total} produktů
      </p>

      <div className="row" style={{ marginBottom: 16 }}>
        <button className={category === '' ? '' : 'secondary'} onClick={() => { setCategory(''); setPage(1); }}>
          Vše
        </button>
        {detail.categories.map((item) => (
          <button
            key={item}
            className={category === item ? '' : 'secondary'}
            onClick={() => { setCategory(item); setPage(1); }}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Produkt</th>
              <th>Cena</th>
              <th>Jednotková cena</th>
              <th>Sleva</th>
            </tr>
          </thead>
          <tbody>
            {detail.products.map((product) => (
              <tr key={product.productId}>
                <td>
                  <strong>{product.name}</strong>
                  {product.brand !== null && <div className="muted">{product.brand}</div>}
                </td>
                <td>
                  <span className="price">{formatCzk(product.priceMinor)}</span>
                  {product.regularPriceMinor !== null && (
                    <div className="strike">{formatCzk(product.regularPriceMinor)}</div>
                  )}
                </td>
                <td>{formatUnitPriceMinor(product.unitPriceMinor, product.unitLabel)}</td>
                <td>
                  {product.discountPercent === null ? (
                    <span className="muted">—</span>
                  ) : (
                    <span className="chip">−{product.discountPercent} %</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail.total > detail.pageSize && (
        <div className="row spread" style={{ marginTop: 16 }}>
          <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Předchozí
          </button>
          <span className="muted">
            Stránka {detail.page} z {totalPages}
          </span>
          <button className="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Další
          </button>
        </div>
      )}
    </div>
  );
}
