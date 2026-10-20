export type HouseholdRole = 'OWNER' | 'MEMBER';

export interface HouseholdRecord {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
}

export interface HouseholdMemberRecord {
  readonly userId: string;
  readonly email: string;
  readonly role: HouseholdRole;
  readonly joinedAt: Date;
}

export interface HouseholdInvitationRecord {
  readonly id: string;
  readonly householdId: string;
  readonly email: string;
  readonly expiresAt: Date;
  readonly usedAt: Date | null;
}

export interface HouseholdRepository {
  create(ownerUserId: string, name: string): Promise<HouseholdRecord>;
  find(householdId: string): Promise<HouseholdRecord | null>;
  listForUser(userId: string): Promise<readonly HouseholdRecord[]>;
  listMembers(householdId: string): Promise<readonly HouseholdMemberRecord[]>;
  addMember(householdId: string, userId: string, role: HouseholdRole): Promise<void>;
  removeMember(householdId: string, userId: string): Promise<void>;
  isMember(userId: string, householdId: string): Promise<boolean>;
  findUserByEmail(email: string): Promise<{ id: string; email: string } | null>;
  createInvitation(input: {
    householdId: string;
    email: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<HouseholdInvitationRecord>;
  findInvitationByTokenHash(tokenHash: string): Promise<HouseholdInvitationRecord | null>;
  markInvitationUsed(invitationId: string): Promise<void>;
}

export const HOUSEHOLD_REPOSITORY = Symbol('HOUSEHOLD_REPOSITORY');

/** Minimální port pro ověření přístupu ke sdílenému seznamu (spec P4). */
export interface HouseholdAccess {
  isMember(userId: string, householdId: string): Promise<boolean>;
}

export const HOUSEHOLD_ACCESS = Symbol('HOUSEHOLD_ACCESS');
