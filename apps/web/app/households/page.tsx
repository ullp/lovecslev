'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api-client';
import { readAuth } from '@/lib/auth';
import { describeError } from '@/lib/errors';
import { formatDate } from '@/lib/format';
import type { Household } from '@/lib/types';

export default function HouseholdsPage(): JSX.Element {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [households, setHouseholds] = useState<readonly Household[]>([]);
  const [name, setName] = useState('Moje domácnost');
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitationToken, setInvitationToken] = useState('');
  const [invitationOutput, setInvitationOutput] = useState<string | null>(null);
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
      .households(token)
      .then((data) => {
        if (!cancelled) setHouseholds(data);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(describeError(cause));
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const household = households[0] ?? null;

  async function reload(currentToken: string): Promise<void> {
    setHouseholds(await api.households(currentToken));
  }

  async function create(): Promise<void> {
    if (token === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.createHousehold(token, name.trim() || 'Moje domácnost');
      await reload(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function invite(): Promise<void> {
    if (token === null || household === null) return;
    setBusy(true);
    setError(null);
    setInvitationOutput(null);
    try {
      const invitation = await api.inviteToHousehold(token, household.id, inviteEmail.trim());
      setInvitationOutput(
        `Pozvánka pro ${invitation.email} (platí do ${formatDate(invitation.expiresAt.slice(0, 10))}). Token: ${invitation.token}`,
      );
      setInviteEmail('');
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function accept(): Promise<void> {
    if (token === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.acceptInvitation(token, invitationToken.trim());
      setInvitationToken('');
      await reload(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string): Promise<void> {
    if (token === null || household === null) return;
    setBusy(true);
    try {
      await api.removeHouseholdMember(token, household.id, userId);
      await reload(token);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Domácnost</h1>
      <p className="subtitle">
        Premium funkce: sdílejte seznam, oblíbené produkty a alerty s rodinou (max 6 členů).
      </p>

      {error !== null && <p className="error">{error}</p>}

      {household === null ? (
        <div className="row">
          <input value={name} onChange={(event) => setName(event.target.value)} aria-label="Název domácnosti" />
          <button onClick={() => void create()} disabled={busy || token === null}>
            Vytvořit domácnost
          </button>
        </div>
      ) : (
        <>
          <div className="card">
            <strong>{household.name}</strong>
            <ul className="list" style={{ marginTop: 10 }}>
              {household.members.map((member) => (
                <li key={member.userId} className="list-item">
                  <span>
                    {member.email} <span className="chip chip-muted">{member.role}</span>
                    <span className="muted"> · od {formatDate(member.joinedAt.slice(0, 10))}</span>
                  </span>
                  {member.role !== 'OWNER' && (
                    <button className="danger" onClick={() => void removeMember(member.userId)} disabled={busy}>
                      Odebrat
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <h2>Pozvat člena</h2>
          <div className="row">
            <input
              type="email"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder="e-mail"
              aria-label="E-mail pozvaného"
              style={{ minWidth: 220 }}
            />
            <button onClick={() => void invite()} disabled={busy || inviteEmail.trim() === ''}>
              Poslat pozvánku
            </button>
          </div>
          {invitationOutput !== null && <p className="notice">{invitationOutput}</p>}
        </>
      )}

      <h2>Přijmout pozvánku</h2>
      <div className="row">
        <input
          value={invitationToken}
          onChange={(event) => setInvitationToken(event.target.value)}
          placeholder="token z e-mailu"
          aria-label="Token pozvánky"
          style={{ minWidth: 260 }}
        />
        <button className="secondary" onClick={() => void accept()} disabled={busy || invitationToken.trim() === ''}>
          Přijmout
        </button>
      </div>
      <p className="muted">
        Pozvánku lze přijmout jen s e-mailem, na který byla vystavena (platnost 7 dní).
      </p>
    </div>
  );
}
