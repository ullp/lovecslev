import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@lovecslev/shared';
import {
  USER_REPOSITORY,
  type TokenPair,
  type UserRecord,
  type UserRepository,
} from './auth.types';
import { PASSWORD_HASHER, type PasswordHasher } from './password.hasher';
import { TokenService } from './token.service';

export interface RegisterInput {
  readonly email: string;
  readonly password: string;
  readonly displayName?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(input: RegisterInput): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing !== null) {
      throw new DomainError('CONFLICT', 'Uživatel s tímto e-mailem už existuje', { email });
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({
      email,
      passwordHash,
      displayName: input.displayName?.trim() || null,
    });

    return { user: toPublicUser(user), tokens: await this.tokens.issue(user) };
  }

  async login(email: string, password: string): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    // Stejná chyba pro neznámý e-mail i špatné heslo — žádné vyzrazování účtů.
    const invalid = new DomainError('UNAUTHORIZED', 'Neplatné přihlašovací údaje');
    if (user === null) throw invalid;

    const matches = await this.hasher.verify(user.passwordHash, password);
    if (!matches) throw invalid;

    return { user: toPublicUser(user), tokens: await this.tokens.issue(user) };
  }

  /** Rotace refresh tokenu: starý se revokuje, vydá se nový pár (spec D23). */
  async refresh(refreshToken: string): Promise<{ tokens: TokenPair }> {
    const active = await this.tokens.findActive(refreshToken);
    const user = await this.users.findById(active.userId);
    if (user === null) {
      throw new DomainError('UNAUTHORIZED', 'Uživatel neexistuje');
    }

    await this.tokens.revoke(active.id);
    return { tokens: await this.tokens.issue(user) };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeToken(refreshToken);
  }
}

export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
}
