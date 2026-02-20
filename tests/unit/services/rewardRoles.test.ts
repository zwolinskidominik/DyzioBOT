import { syncRewardRoles } from '../../../src/services/rewardRoles';
import { mockGuildMember } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── helpers ──────────────────────────────────────────────── */

function memberWithRoles(ownedRoleIds: string[]): any {
  const m = mockGuildMember({ id: 'u1' });
  const cache = new Collection<string, any>();
  for (const id of ownedRoleIds) cache.set(id, { id });
  m.roles.cache = cache;
  return m;
}

const rewards = [
  { level: 5, roleId: 'r-5' },
  { level: 10, roleId: 'r-10' },
  { level: 15, roleId: 'r-15' },
];

/* ── tests ────────────────────────────────────────────────── */

describe('syncRewardRoles', () => {
  it('adds highest eligible role when member has none', async () => {
    const m = memberWithRoles([]);
    await syncRewardRoles(m, 12, rewards);
    expect(m.roles.add).toHaveBeenCalledWith('r-10');
  });

  it('does not add role if already has the best one', async () => {
    const m = memberWithRoles(['r-10']);
    await syncRewardRoles(m, 12, rewards);
    expect(m.roles.add).not.toHaveBeenCalled();
  });

  it('removes lower reward roles the member has', async () => {
    const m = memberWithRoles(['r-5']);
    await syncRewardRoles(m, 12, rewards);
    expect(m.roles.remove).toHaveBeenCalledWith('r-5');
  });

  it('removes higher reward roles no longer deserved', async () => {
    const m = memberWithRoles(['r-15']);
    await syncRewardRoles(m, 12, rewards);
    expect(m.roles.remove).toHaveBeenCalledWith('r-15');
    expect(m.roles.add).toHaveBeenCalledWith('r-10');
  });

  it('handles level below all rewards gracefully', async () => {
    const m = memberWithRoles([]);
    const result = await syncRewardRoles(m, 2, rewards);
    expect(m.roles.add).not.toHaveBeenCalled();
    expect(result.gained).toBeNull();
  });

  it('handles empty rewards array', async () => {
    const m = memberWithRoles([]);
    const result = await syncRewardRoles(m, 50, []);
    expect(m.roles.add).not.toHaveBeenCalled();
    expect(result.gained).toBeNull();
  });

  it('returns gained roleId when a new role is added', async () => {
    const m = memberWithRoles([]);
    const result = await syncRewardRoles(m, 5, rewards);
    expect(result.gained).toBe('r-5');
  });

  it('returns null gained when member already has best role', async () => {
    const m = memberWithRoles(['r-10']);
    const result = await syncRewardRoles(m, 12, rewards);
    expect(result.gained).toBeNull();
  });

  it('catches role.add errors gracefully (gained still set)', async () => {
    const m = memberWithRoles([]);
    m.roles.add = jest.fn().mockRejectedValue(new Error('Missing Permissions'));
    // .catch(() => null) swallows error, gained is assigned after await
    const result = await syncRewardRoles(m, 5, rewards);
    expect(result.gained).toBe('r-5');
  });

  it('catches role.remove errors gracefully', async () => {
    const m = memberWithRoles(['r-5']);
    m.roles.remove = jest.fn().mockRejectedValue(new Error('Missing Permissions'));
    // Should not throw
    await expect(syncRewardRoles(m, 12, rewards)).resolves.toBeTruthy();
  });
});
