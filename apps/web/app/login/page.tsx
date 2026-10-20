'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api-client';
import { saveAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result =
        mode === 'login'
          ? await api.login({ email, password })
          : await api.register({ email, password });
      saveAuth({ tokens: result.tokens, user: result.user });
      router.push('/lists');
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>{mode === 'login' ? 'Přihlášení' : 'Registrace'}</h1>
      <p className="subtitle">
        {mode === 'login' ? 'Přihlaste se ke svým nákupním seznamům.' : 'Vytvořte si účet (e-mail a heslo min. 8 znaků).'}
      </p>

      {error !== null && <p className="error">{error}</p>}

      <form className="card" onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <label>
          <span className="muted">E-mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
            style={{ width: '100%' }}
          />
        </label>
        <label>
          <span className="muted">Heslo</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={mode === 'register' ? 8 : 1}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            style={{ width: '100%' }}
          />
        </label>
        <button type="submit" disabled={busy}>
          {busy ? 'Pracuji…' : mode === 'login' ? 'Přihlásit se' : 'Vytvořit účet'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Nemám účet — registrovat' : 'Mám účet — přihlásit'}
        </button>
      </form>
    </div>
  );
}
