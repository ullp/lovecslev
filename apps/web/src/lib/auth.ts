import type { PublicUser, TokenPair } from './types';

const TOKENS_KEY = 'slevari.tokens';
const USER_KEY = 'slevari.user';

export interface StoredAuth {
  readonly tokens: TokenPair;
  readonly user: PublicUser;
}

function storage(): Storage | null {
  // SSR: localStorage neexistuje, auth se čte až v klientských komponentách.
  return typeof window === 'undefined' ? null : window.localStorage;
}

export function saveAuth(auth: StoredAuth): void {
  const store = storage();
  if (store === null) return;
  store.setItem(TOKENS_KEY, JSON.stringify(auth.tokens));
  store.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function readAuth(): StoredAuth | null {
  const store = storage();
  if (store === null) return null;

  const tokensRaw = store.getItem(TOKENS_KEY);
  const userRaw = store.getItem(USER_KEY);
  if (tokensRaw === null || userRaw === null) return null;

  try {
    return { tokens: JSON.parse(tokensRaw) as TokenPair, user: JSON.parse(userRaw) as PublicUser };
  } catch {
    return null;
  }
}

export function readToken(): string | null {
  return readAuth()?.tokens.accessToken ?? null;
}

export function clearAuth(): void {
  const store = storage();
  if (store === null) return;
  store.removeItem(TOKENS_KEY);
  store.removeItem(USER_KEY);
}
