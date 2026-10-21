'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { readAuth } from '@/lib/auth';
import type { PublicUser } from '@/lib/types';

/** Navigace + stav přihlášení (auth je v localStorage, proto client komponenta). */
export function Nav(): JSX.Element {
  const [user, setUser] = useState<PublicUser | null>(null);

  useEffect(() => {
    setUser(readAuth()?.user ?? null);
  }, []);

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          Lovec Slev
        </Link>
        <Link href="/" className="nav-link">
          Letáky
        </Link>
        <Link href="/search" className="nav-link">
          Hledat
        </Link>
        <Link href="/lists" className="nav-link">
          Seznamy
        </Link>
        <Link href="/advisor" className="nav-link">
          Poradce
        </Link>
        <Link href="/stores" className="nav-link">
          Mapa
        </Link>
        <Link href="/alerts" className="nav-link">
          Hlídač cen
        </Link>
        <Link href="/households" className="nav-link">
          Domácnost
        </Link>
        {user === null ? (
          <Link href="/login" className="nav-link">
            Přihlásit
          </Link>
        ) : (
          <span className="chip chip-muted">{user.email}</span>
        )}
      </div>
    </nav>
  );
}
