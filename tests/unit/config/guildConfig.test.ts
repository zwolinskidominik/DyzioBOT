import { getGuildConfig, __getGuildAssetsUnsafeForTests } from '../../../src/config/guild';

describe('config/guild.getGuildConfig', () => {
  test('unknown guild id returns full defaults (deep clones)', () => {
    const cfg = getGuildConfig('unknown-guild');
    expect(cfg.roles).toEqual({ owner: '', admin: '', mod: '', partnership: '' });
    expect(cfg.channels).toEqual({ boostNotification: '', boosterList: '', tournamentRules: '' });
    // ensure objects are new instances (mutation safety)
    cfg.roles.owner = 'x';
    const cfg2 = getGuildConfig('unknown-guild');
    expect(cfg2.roles.owner).toBe('');
  });

  test('partial config merges over defaults without mutating source', () => {
    const assets = __getGuildAssetsUnsafeForTests();
    const gid = 'test-partial-guild';
    (assets as any)[gid] = {
      roles: { owner: '1' },
      channels: { boosterList: 'ch1' },
    } as any;

    const cfg = getGuildConfig(gid);
    expect(cfg.roles).toEqual({ owner: '1', admin: '', mod: '', partnership: '' });
    expect(cfg.channels).toEqual({ boostNotification: '', boosterList: 'ch1', tournamentRules: '' });
    // verify source object not mutated (no extra keys injected)
    expect((assets as any)[gid].roles.admin).toBeUndefined();
  });

  test('missing roles merges as empty over defaults', () => {
    const assets = __getGuildAssetsUnsafeForTests();
    const gid = 'test-missing-roles';
    (assets as any)[gid] = {
      channels: { boosterList: 'ch2' },
    } as any;

    const cfg = getGuildConfig(gid);
    expect(cfg.roles).toEqual({ owner: '', admin: '', mod: '', partnership: '' });
    expect(cfg.channels).toEqual({ boostNotification: '', boosterList: 'ch2', tournamentRules: '' });
  });

  test('missing channels merges as empty over defaults', () => {
    const assets = __getGuildAssetsUnsafeForTests();
    const gid = 'test-missing-channels';
    (assets as any)[gid] = {
      roles: { admin: 'a1' },
    } as any;

    const cfg = getGuildConfig(gid);
    expect(cfg.roles).toEqual({ owner: '', admin: 'a1', mod: '', partnership: '' });
    expect(cfg.channels).toEqual({ boostNotification: '', boosterList: '', tournamentRules: '' });
  });

  test('known guild returns merged copy and is immutable relative to source', () => {
    const cfg = getGuildConfig('881293681783623680');
    expect(cfg.roles.owner).toBeTruthy();
    // mutate returned object
    cfg.roles.owner = 'mutated';
    const reloaded = getGuildConfig('881293681783623680');
    expect(reloaded.roles.owner).not.toBe('mutated');
  });
});
