import { JwtService } from '@nestjs/jwt';
import {
  FakePasswordHasher,
  InMemoryRefreshTokenRepository,
  InMemoryUserRepository,
} from '../../test/support/in-memory-auth.repositories';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const SECRET = 'test-secret-1234567890';

function setup() {
  const users = new InMemoryUserRepository();
  const refreshTokens = new InMemoryRefreshTokenRepository();
  const jwt = new JwtService({ secret: SECRET, signOptions: { expiresIn: 900 } });
  const tokenService = new TokenService(jwt, refreshTokens);
  const auth = new AuthService(users, new FakePasswordHasher(), tokenService);
  return { auth, users, refreshTokens, jwt };
}

describe('AuthService (spec §13.2, §15.3, D23)', () => {
  it('registrace vytvoří uživatele a vydá access + refresh token', async () => {
    const { auth, users, refreshTokens } = setup();

    const result = await auth.register({
      email: '  Test@Example.COM ',
      password: 'heslo1234',
      displayName: 'Test',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toHaveLength(64);
    expect(result.tokens.expiresIn).toBe(900);
    expect(users.users[0]?.passwordHash).toBe('fake:heslo1234');
    expect(refreshTokens.activeCount).toBe(1);
  });

  it('duplicitní e-mail (i jiná velikost písmen) = CONFLICT', async () => {
    const { auth } = setup();
    await auth.register({ email: 'a@b.cz', password: 'heslo1234' });

    await expect(auth.register({ email: 'A@B.CZ', password: 'heslo1234' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('přihlášení: správné heslo projde, špatné i neznámý e-mail mají stejnou chybu', async () => {
    const { auth } = setup();
    await auth.register({ email: 'a@b.cz', password: 'heslo1234' });

    const ok = await auth.login('a@b.cz', 'heslo1234');
    expect(ok.user.email).toBe('a@b.cz');

    await expect(auth.login('a@b.cz', 'spatne')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(auth.login('nikdo@b.cz', 'heslo1234')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('access token nese userId a e-mail a je ověřitelný', async () => {
    const { auth, jwt } = setup();
    const { tokens, user } = await auth.register({ email: 'a@b.cz', password: 'heslo1234' });

    const payload = jwt.verify<{ sub: string; email: string }>(tokens.accessToken);
    expect(payload.sub).toBe(user.id);
    expect(payload.email).toBe('a@b.cz');
  });

  it('refresh rotuje token: starý přestane platit, nový funguje', async () => {
    const { auth, refreshTokens } = setup();
    const { tokens } = await auth.register({ email: 'a@b.cz', password: 'heslo1234' });

    const rotated = await auth.refresh(tokens.refreshToken);
    expect(rotated.tokens.refreshToken).not.toBe(tokens.refreshToken);
    expect(refreshTokens.activeCount).toBe(1);

    await expect(auth.refresh(tokens.refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(auth.refresh(rotated.tokens.refreshToken)).resolves.toBeDefined();
  });

  it('logout revokuje refresh token (a je idempotentní)', async () => {
    const { auth, refreshTokens } = setup();
    const { tokens } = await auth.register({ email: 'a@b.cz', password: 'heslo1234' });

    await auth.logout(tokens.refreshToken);
    expect(refreshTokens.activeCount).toBe(0);

    await expect(auth.refresh(tokens.refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(auth.logout(tokens.refreshToken)).resolves.toBeUndefined();
  });

  it('neplatný refresh token = UNAUTHORIZED', async () => {
    const { auth } = setup();
    await expect(auth.refresh('deadbeef'.repeat(8))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
