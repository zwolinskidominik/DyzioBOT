jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import type { Guild } from 'discord.js';
import { roleSyncNote, syncStarterRole } from '../../../src/services/minecraft/playerRole';

const ROLE = '323456789012345678';

function fakeGuild(member: { has: boolean; addFails?: boolean } | null) {
  const add = jest.fn(() => (member?.addFails ? Promise.reject(new Error('Missing Permissions')) : Promise.resolve()));
  const remove = jest.fn(() => Promise.resolve());
  const fetch = jest.fn(() =>
    member ? Promise.resolve({ roles: { cache: new Map([[member.has ? ROLE : 'other', {}]]), add, remove } }) : Promise.reject(new Error('Unknown Member'))
  );
  // Tylko to, czego używa syncStarterRole.
  const guild: unknown = { id: '1', members: { fetch } };
  return { guild: guild as Guild, add, remove };
}

describe('syncStarterRole', () => {
  it('gives the role to a whitelisted member and takes it away on removal', async () => {
    const give = fakeGuild({ has: false });
    await expect(syncStarterRole(give.guild, 'u1', ROLE, true)).resolves.toBe('done');
    expect(give.add).toHaveBeenCalledWith(ROLE, expect.any(String));

    const take = fakeGuild({ has: true });
    await expect(syncStarterRole(take.guild, 'u1', ROLE, false)).resolves.toBe('done');
    expect(take.remove).toHaveBeenCalledWith(ROLE, expect.any(String));
  });

  it('does nothing when the role is already in the right state', async () => {
    const g = fakeGuild({ has: true });
    await expect(syncStarterRole(g.guild, 'u1', ROLE, true)).resolves.toBe('done');
    expect(g.add).not.toHaveBeenCalled();
  });

  it('reports a member who left and a missing permission', async () => {
    await expect(syncStarterRole(fakeGuild(null).guild, 'u1', ROLE, true)).resolves.toBe('not_member');
    await expect(syncStarterRole(fakeGuild({ has: false, addFails: true }).guild, 'u1', ROLE, true)).resolves.toBe('failed');
  });

  it('explains failures in the panel reply', () => {
    expect(roleSyncNote('done', true)).toBe('');
    expect(roleSyncNote('failed', true)).toContain('Zarządzanie rolami');
    expect(roleSyncNote('not_member', true)).toContain('nie ma na serwerze');
    expect(roleSyncNote('not_member', false)).toBe('');
  });
});
