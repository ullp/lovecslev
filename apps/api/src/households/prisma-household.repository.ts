import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type {
  HouseholdInvitationRecord,
  HouseholdMemberRecord,
  HouseholdRecord,
  HouseholdRepository,
  HouseholdRole,
} from './households.types';

@Injectable()
export class PrismaHouseholdRepository implements HouseholdRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerUserId: string, name: string): Promise<HouseholdRecord> {
    return this.prisma.household.create({
      data: {
        name,
        ownerUserId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
      select: { id: true, name: true, ownerUserId: true },
    });
  }

  async find(householdId: string): Promise<HouseholdRecord | null> {
    return this.prisma.household.findUnique({
      where: { id: householdId },
      select: { id: true, name: true, ownerUserId: true },
    });
  }

  async listForUser(userId: string): Promise<readonly HouseholdRecord[]> {
    return this.prisma.household.findMany({
      where: { members: { some: { userId } } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, ownerUserId: true },
    });
  }

  async listMembers(householdId: string): Promise<readonly HouseholdMemberRecord[]> {
    const members = await this.prisma.householdMember.findMany({
      where: { householdId },
      orderBy: { joinedAt: 'asc' },
      select: {
        userId: true,
        role: true,
        joinedAt: true,
        user: { select: { email: true } },
      },
    });

    return members.map((member) => ({
      userId: member.userId,
      email: member.user.email,
      role: member.role as HouseholdRole,
      joinedAt: member.joinedAt,
    }));
  }

  async addMember(householdId: string, userId: string, role: HouseholdRole): Promise<void> {
    await this.prisma.householdMember.upsert({
      where: { householdId_userId: { householdId, userId } },
      create: { householdId, userId, role },
      update: {},
    });
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    await this.prisma.householdMember.deleteMany({ where: { householdId, userId } });
  }

  async isMember(userId: string, householdId: string): Promise<boolean> {
    const membership = await this.prisma.householdMember.findUnique({
      where: { householdId_userId: { householdId, userId } },
      select: { id: true },
    });
    return membership !== null;
  }

  async findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: { id: true, email: true },
    });
  }

  async createInvitation(input: {
    householdId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<HouseholdInvitationRecord> {
    return this.prisma.householdInvitation.create({
      data: {
        householdId: input.householdId,
        email: input.email.toLowerCase(),
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
      select: { id: true, householdId: true, email: true, expiresAt: true, usedAt: true },
    });
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<HouseholdInvitationRecord | null> {
    return this.prisma.householdInvitation.findUnique({
      where: { tokenHash },
      select: { id: true, householdId: true, email: true, expiresAt: true, usedAt: true },
    });
  }

  async markInvitationUsed(invitationId: string): Promise<void> {
    await this.prisma.householdInvitation.update({
      where: { id: invitationId },
      data: { usedAt: new Date() },
    });
  }
}
