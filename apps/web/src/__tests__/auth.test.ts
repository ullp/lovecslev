import { clearAuth, readAuth, readToken, saveAuth } from '../lib/auth';
import { installMemoryStorage, uninstallStorage } from './support/memory-storage';

const AUTH = {
  tokens: { accessToken: 'access-1', refreshToken: 'refresh-1', expiresIn: 900 },
  user: { id: 'user-1', email: 'a@b.cz', displayName: 'Test' },
};

describe('auth store (localStorage)', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  afterEach(() => {
    uninstallStorage();
  });

  it('bez uložených dat vrací null', () => {
    expect(readAuth()).toBeNull();
    expect(readToken()).toBeNull();
  });

  it('uloží a přečte tokeny i uživatele', () => {
    saveAuth(AUTH);
    expect(readAuth()).toEqual(AUTH);
    expect(readToken()).toBe('access-1');
  });

  it('clearAuth odstraní obojí', () => {
    saveAuth(AUTH);
    clearAuth();
    expect(readAuth()).toBeNull();
  });

  it('poškozený JSON nespadne, jen vrátí null', () => {
    localStorage.setItem('lovecslev.tokens', '{nevalidní');
    localStorage.setItem('lovecslev.user', JSON.stringify(AUTH.user));
    expect(readAuth()).toBeNull();
  });

  it('v SSR (bez window) bezpečně vrací null', () => {
    uninstallStorage();
    expect(readAuth()).toBeNull();
    expect(() => saveAuth(AUTH)).not.toThrow();
  });
});
