import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@slevari/shared';
import { NOTIFICATION_SENDER, type NotificationSender } from '../alerts/notification.sender';
import {
  HOUSEHOLD_REPOSITORY,
  type HouseholdInvitationRecord,
  type HouseholdMemberRecord,
  type HouseholdRecord,
  type HouseholdRepository,
} from './households.types';

export const INVITATION_TTL_DAYS = 7;
export const MAX_MEMBERS = 6;

export interface HouseholdDetail {
  readonly id: string;
  readonly name: string;
  readonly ownerUserId: string;
  readonly members: readonly HouseholdMemberRecord[];
}

const hashToken = (token: string): string => createHash('sha256').update(token, 'utf8').digest('hex');

/** P4 — rodinné sdílení (spec §6 P4). Volající MUSÍ být za `PremiumGuard` (kromě accept). */
@Injectable()
export class HouseholdsService {
  constructor(
    @Inject(HOUSEHOLD_REPOSITORY) private readonly households: HouseholdRepository,
    @Inject(NOTIFICATION_SENDER) private readonly notifier: NotificationSender,
  ) {}

  async create(userId: string, name: string | undefined): Promise<HouseholdRecord> {
    const existing = await this.households.listForUser(userId);
    // Jeden uživatel = jedna domácnost (MVP; M5 nepokrývá víc domácností).
    if (existing.length > 0) {
      throw new DomainError('CONFLICT', 'Už jste členem domácnosti', { householdId: existing[0]?.id });
    }
    return this.households.create(userId, name?.trim() || 'Moje domácnost');
  }

  async list(userId: string): Promise<readonly HouseholdDetail[]> {
    const households = await this.households.listForUser(userId);
    const details: HouseholdDetail[] = [];

    for (const household of households) {
      details.push({
        ...household,
        members: await this.households.listMembers(household.id),
      });
    }

    return details;
  }

  /** Pozvánka e-mailem s jednorázovým tokenem (platnost 7 dní, spec P4). */
  async invite(
    userId: string,
    householdId: string,
    email: string,
  ): Promise<{ invitationId: string; email: string; expiresAt: Date; token: string }> {
    const household = await this.requireMember(userId, householdId);
    if (household.ownerUserId !== userId) {
      throw new DomainError('NOT_FOUND', `Domácnost ${householdId} neexistuje`, { householdId });
    }

    const members = await this.households.listMembers(householdId);
    if (members.length >= MAX_MEMBERS) {
      throw new DomainError('PLAN_LIMIT_REACHED', `Domácnost může mít max ${MAX_MEMBERS} členů`, {
        limit: MAX_MEMBERS,
      });
    }

    const normalized = email.trim().toLowerCase();
    if (members.some((member) => member.email === normalized)) {
      throw new DomainError('CONFLICT', 'Tento e-mail už je členem domácnosti', { email: normalized });
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 86_400_000);

    const invitation = await this.households.createInvitation({
      householdId,
      email: normalized,
      tokenHash: hashToken(token),
      expiresAt,
    });

    await this.notifier.sendEmail(
      normalized,
      'Pozvánka do domácnosti na Slevaři kolem mě',
      `Byli jste pozváni do domácnosti "${household.name}". Token pro přijetí: ${token} (platí ${INVITATION_TTL_DAYS} dní).`,
    );

    return { invitationId: invitation.id, email: invitation.email, expiresAt, token };
  }

  /** Přijetí pozvánky — e-mail v pozvánce se MUSÍ shodovat s přihlášeným uživatelem. */
  async accept(userId: string, userEmail: string, token: string): Promise<HouseholdDetail> {
    const invitation = await this.households.findInvitationByTokenHash(hashToken(token));
    if (invitation === null) {
      throw new DomainError('NOT_FOUND', 'Pozvánka neexistuje');
    }
    if (invitation.usedAt !== null) {
      throw new DomainError('CONFLICT', 'Pozvánka už byla použita');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new DomainError('CONFLICT', 'Pozvánka vypršela');
    }
    if (invitation.email !== userEmail.trim().toLowerCase()) {
      throw new DomainError('UNAUTHORIZED', 'Pozvánka patří jinému e-mailu');
    }

    await this.households.addMember(invitation.householdId, userId, 'MEMBER');
    await this.households.markInvitationUsed(invitation.id);

    const household = await this.households.find(invitation.householdId);
    if (household === null) {
      throw new DomainError('NOT_FOUND', 'Domácnost neexistuje');
    }

    return { ...household, members: await this.households.listMembers(household.id) };
  }

  /** Odebrání člena — jen vlastník, vlastníka odebrat nelze (spec P4). */
  async removeMember(userId: string, householdId: string, memberUserId: string): Promise<void> {
    const household = await this.requireOwner(userId, householdId);
    if (household.ownerUserId === memberUserId) {
      throw new DomainError('VALIDATION_ERROR', 'Vlastníka domácnosti nelze odebrat');
    }

    await this.households.removeMember(householdId, memberUserId);
  }

  private async requireMember(userId: string, householdId: string): Promise<HouseholdRecord> {
    const household = await this.households.find(householdId);
    const member = household !== null && (await this.households.isMember(userId, householdId));
    if (household === null || !member) {
      throw new DomainError('NOT_FOUND', `Domácnost ${householdId} neexistuje`, { householdId });
    }
    return household;
  }

  private async requireOwner(userId: string, householdId: string): Promise<HouseholdRecord> {
    const household = await this.requireMember(userId, householdId);
    if (household.ownerUserId !== userId) {
      throw new DomainError('NOT_FOUND', `Domácnost ${householdId} neexistuje`, { householdId });
    }
    return household;
  }
}

export type { HouseholdInvitationRecord };
