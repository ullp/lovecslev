'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OptimizationView } from '@/components/list-detail-parts';
import { api } from '@/lib/api-client';
import { readAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatCzk, formatQuantity } from '@/lib/format';
import type { AdvisorPlan } from '@/lib/types';

const EXAMPLE = 'Chci nakoupit na týden pro čtyřčlennou rodinu do 2500 Kč.';

export default function AdvisorPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [freeText, setFreeText] = useState(EXAMPLE);
  const [budget, setBudget] = useState('2500');
  const [plan, setPlan] = useState<AdvisorPlan | null>(null);
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

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (token === null) return;

    const koruna = Number(budget.replace(',', '.'));
    setBusy(true);
    setError(null);

    try {
      setPlan(
        await api.advisorPlan(token, {
          freeText,
          ...(Number.isFinite(koruna) && koruna > 0 ? { budgetMinor: Math.round(koruna * 100) } : {}),
        }),
      );
    } catch (cause) {
      setError(describeError(cause));
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>AI nákupní poradce</h1>
      <p className="subtitle">
        Popište, co potřebujete nakoupit. AI vybere jen z našeho katalogu a ceny spočítá server — nikdy
        nevymýšlí produkty ani ceny.
      </p>

      {error !== null && <p className="error">{error}</p>}

      <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>
          <span className="muted">Co chcete nakoupit?</span>
          <textarea
            value={freeText}
            onChange={(event) => setFreeText(event.target.value)}
            rows={3}
            maxLength={500}
            style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid var(--border)' }}
          />
        </label>
        <div className="row">
          <label className="muted">
            Rozpočet (Kč){' '}
            <input
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
              inputMode="decimal"
              style={{ width: 120 }}
            />
          </label>
          <button type="submit" disabled={busy || freeText.trim().length < 10}>
            {busy ? 'Počítám…' : 'Navrhnout nákup'}
          </button>
        </div>
      </form>

      {plan !== null && (
        <>
          <div className={`notice`} style={{ marginTop: 16 }}>
            {plan.budget.budgetMinor === null ? (
              'Rozpočet nebyl zadán.'
            ) : plan.budget.feasible ? (
              <>
                Vejde se do rozpočtu {formatCzk(plan.budget.budgetMinor)} — nejlevnější varianta{' '}
                {plan.budget.minimalMinor === null ? '—' : formatCzk(plan.budget.minimalMinor)}.
              </>
            ) : (
              <>
                Do rozpočtu se to nevejde o {formatCzk(plan.budget.overByMinor)}. Nejlevnější varianta:{' '}
                {plan.budget.minimalMinor === null ? '—' : formatCzk(plan.budget.minimalMinor)}.
              </>
            )}
          </div>

          <section className="card" style={{ marginTop: 12 }}>
            <div className="row spread">
              <strong>Navržený seznam</strong>
              <span className={`chip ${plan.meta.llmAvailable ? '' : 'chip-warn'}`}>
                {plan.meta.source === 'LLM' ? `AI (${plan.meta.llmModel})` : 'šablona (AI nedostupná)'}
              </span>
            </div>
            {plan.explanation !== '' && <p className="muted">{plan.explanation}</p>}
            <ul className="list" style={{ marginTop: 8 }}>
              {plan.items.map((item) => (
                <li key={`${item.productId ?? item.name}`} className="list-item">
                  <span>{item.name}</span>
                  <span className="muted">{formatQuantity(item.quantityBase, item.baseUnit)}</span>
                </li>
              ))}
            </ul>
            <p className="muted">
              Dnes využito {plan.meta.usedToday} z {plan.meta.dailyLimit} dotazů.
            </p>
          </section>

          <h2>Nejlevnější nákup</h2>
          <OptimizationView result={plan.optimization} />

          <p className="muted">
            Chcete seznam uložit? <Link href="/lists" className="nav-link">Přejít na seznamy</Link> a přidejte
            položky ručně nebo je potvrďte z návrhu.
          </p>
        </>
      )}
    </div>
  );
}
