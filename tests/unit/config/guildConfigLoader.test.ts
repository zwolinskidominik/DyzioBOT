import { getGuildConfig, __getGuildAssetsUnsafeForTests } from '../../../src/config/guild';

describe('config/guild config loader', () => {
  test('returns defaults when guild not found', () => {
    const cfg = getGuildConfig('non-existent');
    expect(cfg.roles.owner).toBe('');
    expect(cfg.channels.boostNotification).toBe('');
  });

  test('partial configuration merges with defaults', () => {
    const assets = __getGuildAssetsUnsafeForTests();
    assets['test-partial'] = {
      roles: { owner: 'r-owner' },
      channels: { boosterList: 'c-booster' },
    } as any;

    const cfg = getGuildConfig('test-partial');
    expect(cfg.roles.owner).toBe('r-owner');
    expect(cfg.roles.admin).toBe(''); // from defaults
    expect(cfg.channels.boosterList).toBe('c-booster');
    expect(cfg.channels.tournamentRules).toBe(''); // from defaults
  });
});
