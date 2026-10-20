'use client';

import { useState } from 'react';
import { api } from '@/lib/api-client';
import { formatCzk } from '@/lib/format';
import type { OptimizationResult } from '@/lib/types';

/** Přiřazení produktu k nerozpoznané položce (spec §5 F3 pravidlo 3). */
export function ConfirmButton({
  onConfirm,
  disabled,
}: {
  onConfirm: (productId: string) => void;
  disabled: boolean;
}): JSX.Element {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<readonly { productId: string; name: string }[]>([]);

  async function search(): Promise<void> {
    if (query.trim().length < 2) return;
    const response = await api.search(query.trim(), { limit: 5 });
    setOptions(response.data.map((product) => ({ productId: product.productId, name: product.name })));
  }

  return (
    <span className="row" style={{ gap: 6 }}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="přiřadit produkt"
        style={{ width: 150 }}
        aria-label="Hledat produkt pro přiřazení"
      />
      <button type="button" className="secondary" onClick={() => void search()} disabled={disabled}>
        Najít
      </button>
      {options.map((option) => (
        <button
          key={option.productId}
          type="button"
          className="secondary"
          onClick={() => onConfirm(option.productId)}
        >
          {option.name}
        </button>
      ))}
    </span>
  );
}

/** Varianty A/B + paywall (spec §5 F4, D18). */
export function OptimizationView({ result }: { result: OptimizationResult }): JSX.Element {
  const variantBLocked = result.variantB === null && result.meta.lockedFeatures.includes('VARIANT_B');

  return (
    <div>
      <section className="card">
        <div className="row spread">
          <strong>Varianta A — jeden obchod</strong>
          {result.recommendedVariant === 'A' && <span className="chip">doporučeno</span>}
        </div>
        {result.variantA === null ? (
          <p className="notice" style={{ marginTop: 8 }}>
            Žádný obchod nepokrývá celý seznam.
          </p>
        ) : (
          <>
            <p className="muted" style={{ margin: '4px 0 8px' }}>
              {result.variantA.chainCode}
            </p>
            <p className="price">{formatCzk(result.variantA.totalMinor)}</p>
          </>
        )}
      </section>

      <section className="card">
        <div className="row spread">
          <strong>Varianta B — kombinace obchodů</strong>
          {result.recommendedVariant === 'B' && <span className="chip">doporučeno</span>}
        </div>

        {variantBLocked && (
          <p className="notice" style={{ marginTop: 8 }}>
            Kombinace obchodů a úspora jsou součástí tarifu Premium (79 Kč/měsíc).
          </p>
        )}

        {result.variantB !== null && (
          <>
            {result.variantB.chains.map((chain) => (
              <div key={chain.chainCode} style={{ marginTop: 8 }}>
                <strong>{chain.chainCode}</strong> — {formatCzk(chain.subtotalMinor)}
                <ul className="muted" style={{ margin: '4px 0 0 18px' }}>
                  {chain.items.map((line) => (
                    <li key={`${chain.chainCode}-${line.productId}`}>
                      {formatCzk(line.lineTotalMinor)} · {line.quantityBase} {line.packages === null ? '(váženo)' : 'bal.'}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="price" style={{ marginTop: 12 }}>
              {formatCzk(result.variantB.totalMinor)}
            </p>
            <p className="muted">Cena nezahrnuje cestu (D17).</p>
          </>
        )}
      </section>

      {result.savingsMinor > 0 && <p className="chip">Úspora: {formatCzk(result.savingsMinor)}</p>}

      {result.warnings.length > 0 && (
        <div className="notice" style={{ marginTop: 12 }}>
          Do výpočtu nejsou zahrnuté položky:{' '}
          {result.warnings.map((warning) => warning.rawText ?? warning.productId ?? '?').join(', ')}
        </div>
      )}
    </div>
  );
}
