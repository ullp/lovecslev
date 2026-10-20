import { randomUUID } from 'node:crypto';
import type {
  ActiveRefreshToken,
  CreateUserInput,
  RefreshTokenRepository,
  UserRecord,
  UserRepository,
} from '../../src/auth/auth.types';
import type { PasswordHasher } from '../../src/auth/password.hasher';

export class InMemoryUserRepository implements UserRepository {
  readonly users: UserRecord[] = [];

  constructor(seed: readonly UserRecord[] = []) {
    this.users.push(...seed);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    const user: UserRecord = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      displayName: input.displayName,
    };
    this.users.push(user);
    return user;
  }
}

interface StoredRefreshToken extends ActiveRefreshToken {
  tokenHash: string;
  revoked: boolean;
}

export class InMemoryRefreshTokenRepository implements RefreshTokenRepository {
  readonly tokens: StoredRefreshToken[] = [];

  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    this.tokens.push({
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revoked: false,
    });
  }

  async findActive(tokenHash: string): Promise<ActiveRefreshToken | null> {
    const token = this.tokens.find(
      (entry) => entry.tokenHash === tokenHash && !entry.revoked && entry.expiresAt.getTime() > Date.now(),
    );
    return token === undefined ? null : { id: token.id, userId: token.userId, expiresAt: token.expiresAt };
  }

  async revoke(id: string): Promise<void> {
    const token = this.tokens.find((entry) => entry.id === id);
    if (token !== undefined) token.revoked = true;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const token of this.tokens) {
      if (token.userId === userId) token.revoked = true;
    }
  }

  get activeCount(): number {
    return this.tokens.filter((token) => !token.revoked && token.expiresAt.getTime() > Date.now()).length;
  }
}

/** Levný „hash“ pro testy — Argon2 zbytečně zpomaluje suite (chování rozhraní je stejné). */
export class FakePasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return `fake:${password}`;
  }

  async verify(hash: string, password: string): Promise<boolean> {
    return hash === `fake:${password}`;
  }
}
