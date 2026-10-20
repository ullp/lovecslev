import { HouseholdsService, INVITATION_TTL_DAYS, MAX_MEMBERS } from './households.service';
import { InMemoryHouseholdRepository } from '../../test/support/in-memory-households.repository';
import { RecordingNotifier } from '../../test/support/in-memory-alerts.repositories';

function setup() {
  const repository = new InMemoryHouseholdRepository();
  repository.users.push(
    { id: 'user-1', email: 'owner@test.cz' },
    { id: 'user-2', email: 'partner@test.cz' },
    { id: 'user-3', email: 'other@test.cz' },
  );
  const notifier = new RecordingNotifier();
  const service = new HouseholdsService(repository, notifier);
  return { service, repository, notifier };
}

describe('HouseholdsService (spec P4)', () => {
  it('vytvoří domácnost a vlastník je členem s rolí OWNER', async () => {
    const { service, repository } = setup();
    const household = await service.create('user-1', 'Rodina');

    expect(household.name).toBe('Rodina');
    const members = await repository.listMembers(household.id);
    expect(members).toEqual([
      expect.objectContaining({ userId: 'user-1', role: 'OWNER', email: 'owner@test.cz' }),
    ]);
  });

  it('druhá domácnost pro stejného uživatele = CONFLICT', async () => {
    const { service } = setup();
    await service.create('user-1', 'Rodina');

    await expect(service.create('user-1', 'Druhá')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('pozvánka pošle e-mail, uloží jen hash tokenu a má 7denní platnost', async () => {
    const { service, repository, notifier } = setup();
    const household = await service.create('user-1', 'Rodina');

    const invitation = await service.invite('user-1', household.id, 'Partner@Test.cz');

    expect(invitation.email).toBe('partner@test.cz');
    expect(invitation.token).toHaveLength(64);
    expect(notifier.emails[0]?.to).toBe('partner@test.cz');
    expect(notifier.emails[0]?.text).toContain(invitation.token);

    const stored = repository.invitations[0];
    expect(stored?.tokenHash).not.toBe(invitation.token);
    expect(stored?.tokenHash).toHaveLength(64);
    const days = Math.round((invitation.expiresAt.getTime() - Date.now()) / 86_400_000);
    expect(days).toBe(INVITATION_TTL_DAYS);
  });

  it('pozvánka od ne-vlastníka = NOT_FOUND (nevynáší existenci domácnosti)', async () => {
    const { service } = setup();
    const household = await service.create('user-1', 'Rodina');
    const invite = await service.invite('user-1', household.id, 'partner@test.cz');
    await service.accept('user-2', 'partner@test.cz', invite.token);

    await expect(service.invite('user-2', household.id, 'other@test.cz')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('přijetí pozvánky přidá člena a označí pozvánku jako použitou', async () => {
    const { service, repository } = setup();
    const household = await service.create('user-1', 'Rodina');
    const invite = await service.invite('user-1', household.id, 'partner@test.cz');

    const detail = await service.accept('user-2', 'partner@test.cz', invite.token);

    expect(detail.members.map((member) => member.userId).sort()).toEqual(['user-1', 'user-2']);
    expect(repository.invitations[0]?.usedAt).not.toBeNull();

    await expect(service.accept('user-2', 'partner@test.cz', invite.token)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('pozvánka pro jiný e-mail = UNAUTHORIZED, neplatný token = NOT_FOUND', async () => {
    const { service } = setup();
    const household = await service.create('user-1', 'Rodina');
    const invite = await service.invite('user-1', household.id, 'partner@test.cz');

    await expect(service.accept('user-3', 'other@test.cz', invite.token)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(service.accept('user-3', 'other@test.cz', 'deadbeef'.repeat(8))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('expirovaná pozvánka = CONFLICT', async () => {
    const { service, repository } = setup();
    const household = await service.create('user-1', 'Rodina');
    const invite = await service.invite('user-1', household.id, 'partner@test.cz');
    (repository.invitations[0] as { expiresAt: Date }).expiresAt = new Date(Date.now() - 1000);

    await expect(service.accept('user-2', 'partner@test.cz', invite.token)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('limit 6 členů', async () => {
    const { service, repository } = setup();
    const household = await service.create('user-1', 'Rodina');
    for (let index = 0; index < MAX_MEMBERS - 1; index += 1) {
      await repository.addMember(household.id, `extra-${index}`, 'MEMBER');
    }

    await expect(service.invite('user-1', household.id, 'other@test.cz')).rejects.toMatchObject({
      code: 'PLAN_LIMIT_REACHED',
    });
  });

  it('vlastník odebere člena; vlastníka odebrat nelze', async () => {
    const { service, repository } = setup();
    const household = await service.create('user-1', 'Rodina');
    const invite = await service.invite('user-1', household.id, 'partner@test.cz');
    await service.accept('user-2', 'partner@test.cz', invite.token);

    await service.removeMember('user-1', household.id, 'user-2');
    expect(await repository.isMember('user-2', household.id)).toBe(false);

    await expect(service.removeMember('user-1', household.id, 'user-1')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(service.removeMember('user-3', household.id, 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('pozvánka na existujícího člena = CONFLICT', async () => {
    const { service } = setup();
    const household = await service.create('user-1', 'Rodina');

    await expect(service.invite('user-1', household.id, 'owner@test.cz')).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });
});
