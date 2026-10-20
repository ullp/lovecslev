export interface UserRecord {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
}

export interface CreateUserInput {
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string | null;
}

/** Port nad uživateli (spec §9.9, §8.4) — auth služba nezná Prisma. */
export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  create(input: CreateUserInput): Promise<UserRecord>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface ActiveRefreshToken {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

export interface RefreshTokenRepository {
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /** Vrací jen neprošlý a nerevokovaný token (spec D23). */
  findActive(tokenHash: string): Promise<ActiveRefreshToken | null>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
}

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}
