import { getGuildConfig } from '../../../src/config/guild';

describe('getGuildConfig', () => {
  it('returns main server config for known guild ID', () => {
    const cfg = getGuildConfig('881293681783623680');
    expect(cfg.roles.owner).toBe('881295973782007868');
    expect(cfg.roles.admin).toBe('881295975036104766');
    expect(cfg.channels.boostNotification).toBe('1292423972859940966');
    expect(cfg.tournament.organizerUserIds).toContain('813135633248682064');
  });

  it('returns test server config for test guild ID', () => {
    const cfg = getGuildConfig('1264582308003053570');
    expect(cfg.roles.owner).toBe('1264582308263100482');
    expect(cfg.tournament.organizerUserIds).toContain('548177225661546496');
  });

  it('returns defaults for unknown guild ID', () => {
    const cfg = getGuildConfig('unknown');
    expect(cfg.roles.owner).toBe('');
    expect(cfg.roles.admin).toBe('');
    expect(cfg.channels.boostNotification).toBe('');
    expect(cfg.tournament.organizerUserIds).toEqual([]);
  });

  it('defaults are independent copies (no shared references)', () => {
    const a = getGuildConfig('unknown-1');
    const b = getGuildConfig('unknown-2');
    a.roles.owner = 'modified';
    expect(b.roles.owner).toBe('');
  });

  it('known config merges with defaults (filling missing keys)', () => {
    const cfg = getGuildConfig('881293681783623680');
    // All role keys should exist
    expect(cfg.roles).toHaveProperty('owner');
    expect(cfg.roles).toHaveProperty('admin');
    expect(cfg.roles).toHaveProperty('mod');
    expect(cfg.roles).toHaveProperty('partnership');
    expect(cfg.roles).toHaveProperty('tournamentParticipants');
    expect(cfg.roles).toHaveProperty('tournamentOrganizer');
  });

  it('__getGuildAssetsUnsafeForTests returns the raw assets object', () => {
    const { __getGuildAssetsUnsafeForTests } = require('../../../src/config/guild');
    const raw = __getGuildAssetsUnsafeForTests();
    expect(raw).toHaveProperty('881293681783623680');
    expect(raw).toHaveProperty('1264582308003053570');
  });
});
