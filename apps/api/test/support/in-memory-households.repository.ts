import { randomUUID } from 'node:crypto';
import type {
  HouseholdInvitationRecord,
  HouseholdMemberRecord,
  HouseholdRecord,
  HouseholdRepository,
  HouseholdRole,
} from '../../src/households/households.types';

interface MemberRow {
  householdId: string;
  userId: string;
  role: HouseholdRole;
  joinedAt: Date;
}

interface InvitationRow {
  id: string;
  householdId: string;
  email: string;
  expiresAt: Date;
  usedAt: Date | null;
  tokenHash: string;
}

export class InMemoryHouseholdRepository implements HouseholdRepository {
  readonly households: HouseholdRecord[] = [];
  readonly members: MemberRow[] = [];
  readonly invitations: InvitationRow[] = [];
  readonly users: { id: string; email: string }[] = [];

  async create(ownerUserId: string, name: string): Promise<HouseholdRecord> {
    const household: HouseholdRecord = { id: randomUUID(), name, ownerUserId };
    this.households.push(household);
    this.members.push({ householdId: household.id, userId: ownerUserId, role: 'OWNER', joinedAt: new Date() });
    return household;
  }

  async find(householdId: string): Promise<HouseholdRecord | null> {
    return this.households.find((household) => household.id === householdId) ?? null;
  }

  async listForUser(userId: string): Promise<readonly HouseholdRecord[]> {
    const ids = new Set(this.members.filter((member) => member.userId === userId).map((m) => m.householdId));
    return this.households.filter((household) => ids.has(household.id));
  }

  async listMembers(householdId: string): Promise<readonly HouseholdMemberRecord[]> {
    return this.members
      .filter((member) => member.householdId === householdId)
      .map((member) => ({
        userId: member.userId,
        email: this.users.find((user) => user.id === member.userId)?.email ?? `${member.userId}@test.cz`,
        role: member.role,
        joinedAt: member.joinedAt,
      }));
  }

  async addMember(householdId: string, userId: string, role: HouseholdRole): Promise<void> {
    if (this.members.some((m) => m.householdId === householdId && m.userId === userId)) return;
    this.members.push({ householdId, userId, role, joinedAt: new Date() });
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    const index = this.members.findIndex((m) => m.householdId === householdId && m.userId === userId);
    if (index >= 0) this.members.splice(index, 1);
  }

  async isMember(userId: string, householdId: string): Promise<boolean> {
    return this.members.some((m) => m.householdId === householdId && m.userId === userId);
  }

  async findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    return this.users.find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async createInvitation(input: {
    householdId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<HouseholdInvitationRecord> {
    const invitation: InvitationRow = {
      id: randomUUID(),
      householdId: input.householdId,
      email: input.email,
      expiresAt: input.expiresAt,
      usedAt: null,
      tokenHash: input.tokenHash,
    };
    this.invitations.push(invitation);
    return invitation;
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<HouseholdInvitationRecord | null> {
    return this.invitations.find((invitation) => invitation.tokenHash === tokenHash) ?? null;
  }

  async markInvitationUsed(invitationId: string): Promise<void> {
    const invitation = this.invitations.find((entry) => entry.id === invitationId);
    if (invitation !== undefined) invitation.usedAt = new Date();
  }
}
