'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { clearAuth, readAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import type { ListSummary } from '@/lib/types';

export default function ListsPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [lists, setLists] = useState<readonly ListSummary[]>([]);
  const [name, setName] = useState('Týdenní nákup');
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
      .lists(token)
      .then((data) => {
        if (!cancelled) setLists(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function refreshLists(currentToken: string): Promise<void> {
    setLists(await api.lists(currentToken));
  }

  async function createList(): Promise<void> {
    if (token === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.createList(token, name.trim() === '' ? 'Můj nákup' : name.trim());
      await refreshLists(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeList(listId: string): Promise<void> {
    if (token === null) return;
    setBusy(true);
    try {
      await api.deleteList(token, listId);
      await refreshLists(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  function logout(): void {
    const auth = readAuth();
    clearAuth();
    if (auth !== null) {
      void api.logout(auth.tokens.accessToken, auth.tokens.refreshToken).catch(() => undefined);
    }
    router.push('/');
  }

  return (
    <div>
      <div className="row spread">
        <h1>Moje seznamy</h1>
        <button className="secondary" onClick={logout}>
          Odhlásit
        </button>
      </div>
      <p className="subtitle">Tarif FREE umožňuje 1 seznam s 30 položkami, Premium bez limitu.</p>

      {error !== null && <p className="error">{error}</p>}

      <div className="row" style={{ marginBottom: 16 }}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Název seznamu"
          aria-label="Název nového seznamu"
        />
        <button onClick={createList} disabled={busy || token === null}>
          Vytvořit seznam
        </button>
      </div>

      <ul className="list">
        {lists.map((list) => (
          <li key={list.id} className="list-item">
            <span>
              <strong>{list.name}</strong>
              <span className="muted"> · {list.itemCount} položek</span>
            </span>
            <span className="row" style={{ gap: 8 }}>
              <Link href={`/lists/${list.id}`} className="nav-link">
                Otevřít →
              </Link>
              <button className="danger" onClick={() => removeList(list.id)} disabled={busy}>
                Smazat
              </button>
            </span>
          </li>
        ))}
      </ul>

      {lists.length === 0 && token !== null && (
        <p className="muted">Zatím nemáte žádný seznam. Vytvořte první výše.</p>
      )}
    </div>
  );
}
