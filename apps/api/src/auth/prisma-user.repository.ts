import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ActiveRefreshToken,
  CreateUserInput,
  RefreshTokenRepository,
  UserRecord,
  UserRepository,
} from './auth.types';

const USER_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  displayName: true,
} as const;

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: USER_SELECT,
    });
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
  }

  async create(input: CreateUserInput): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        // Každý nový uživatel má explicitní FREE záznam (D19: zdroj pravdy o tarifu).
        subscriptions: {
          create: { plan: 'FREE', status: 'ACTIVE', provider: 'MANUAL' },
        },
      },
      select: USER_SELECT,
    });
  }
}

@Injectable()
export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.refreshToken.create({ data: input });
  }

  async findActive(tokenHash: string): Promise<ActiveRefreshToken | null> {
    const token = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userId: true, expiresAt: true },
    });
    return token;
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
