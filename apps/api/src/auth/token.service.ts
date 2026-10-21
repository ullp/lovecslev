import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { DomainError } from '@lovecslev/shared';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from './jwt-config';
import { REFRESH_TOKEN_REPOSITORY, type RefreshTokenRepository, type TokenPair } from './auth.types';

export const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

/** Vydávání a revokace tokenů (spec §8.1: access 15 min, refresh 30 dní). */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async issue(user: { id: string; email: string }): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({ sub: user.id, email: user.email });
    const refreshToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 86_400_000);

    await this.refreshTokens.create({ userId: user.id, tokenHash: hashToken(refreshToken), expiresAt });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  /** Ověří refresh token a vrátí jeho záznam; jinak 401. */
  async findActive(refreshToken: string): Promise<{ id: string; userId: string }> {
    const active = await this.refreshTokens.findActive(hashToken(refreshToken));
    if (active === null) {
      throw new DomainError('UNAUTHORIZED', 'Neplatný nebo expirovaný refresh token');
    }
    return { id: active.id, userId: active.userId };
  }

  async revoke(id: string): Promise<void> {
    await this.refreshTokens.revoke(id);
  }

  async revokeToken(refreshToken: string): Promise<void> {
    const active = await this.refreshTokens.findActive(hashToken(refreshToken));
    if (active !== null) await this.refreshTokens.revoke(active.id);
  }

  async revokeAll(userId: string): Promise<void> {
    await this.refreshTokens.revokeAllForUser(userId);
  }
}
