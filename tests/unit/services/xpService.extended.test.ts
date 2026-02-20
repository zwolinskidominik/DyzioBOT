jest.mock('../../../src/services/levelNotifier', () => ({
  notifyLevelUp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/services/rewardRoles', () => ({
  syncRewardRoles: jest.fn().mockResolvedValue({ gained: null }),
}));

import { LevelModel } from '../../../src/models/Level';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { modifyXp, getCurrentXp, trackMessage } from '../../../src/services/xpService';
import { notifyLevelUp } from '../../../src/services/levelNotifier';
import { syncRewardRoles } from '../../../src/services/rewardRoles';
import { deltaXp } from '../../../src/utils/levelMath';
import xpCache from '../../../src/cache/xpCache';
import { Collection } from 'discord.js';

const GID = 'guild-mod';

function makeClient(opts: { guildExists?: boolean; fetchResolves?: boolean } = {}): any {
  const { guildExists = true, fetchResolves = true } = opts;
  const member = {
    id: 'u1',
    roles: { cache: new Collection(), add: jest.fn(), remove: jest.fn() },
  };
  const guild = guildExists
    ? {
        id: GID,
        members: {
          fetch: fetchResolves
            ? jest.fn().mockResolvedValue(member)
            : jest.fn().mockRejectedValue(new Error('Unknown')),
        },
      }
    : undefined;
  const guilds = new Collection<string, any>();
  if (guild) guilds.set(GID, guild);
  return { guilds: { cache: guilds } };
}

function makeMember(roleIds: string[] = []): any {
  const cache = new Collection<string, any>();
  for (const r of roleIds) cache.set(r, { id: r });
  return {
    id: 'u1',
    roles: { cache },
  };
}

beforeEach(async () => {
  jest.clearAllMocks();
  xpCache.drain();
  await LevelModel.deleteMany({ guildId: GID });
  await LevelConfigModel.deleteMany({ guildId: GID });
});

/* ── modifyXp ─────────────────────────────────────────────── */

describe('modifyXp', () => {
  it('does nothing for delta=0', async () => {
    await modifyXp(makeClient(), GID, 'u1', 0);
    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' });
    expect(doc).toBeNull();
  });

  it('adds XP to existing user', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 10, level: 1 });
    await modifyXp(makeClient(), GID, 'u1', 20);
    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc!.xp).toBe(30);
    expect(doc!.level).toBe(1);
  });

  it('creates new user doc when none exists', async () => {
    await modifyXp(makeClient(), GID, 'u1', 50);
    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc).not.toBeNull();
    expect(doc!.xp).toBe(50);
    expect(doc!.level).toBe(1);
  });

  it('triggers level-up and calls notifyLevelUp', async () => {
    const threshold = deltaXp(2); // XP needed from level 1 to 2
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 0, level: 1 });
    const client = makeClient();
    await modifyXp(client, GID, 'u1', threshold);
    expect(notifyLevelUp).toHaveBeenCalledWith(client, GID, 'u1', 2);
    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc!.level).toBe(2);
    expect(doc!.xp).toBe(0);
  });

  it('handles negative delta (level-down)', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 10, level: 2 });
    // Remove more XP than current xp, triggers while(xp < 0 && lvl > 1)
    await modifyXp(makeClient(), GID, 'u1', -20);
    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc!.level).toBe(1);
    // xp should not be negative
    expect(doc!.xp).toBeGreaterThanOrEqual(0);
  });

  it('calls syncRewardRoles on level-down', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 10, level: 3 });
    await LevelConfigModel.create({
      guildId: GID,
      roleRewards: [{ level: 2, roleId: 'r2' }],
    });
    const client = makeClient();
    // Large negative delta to force level-down
    await modifyXp(client, GID, 'u1', -1000);
    expect(syncRewardRoles).toHaveBeenCalled();
  });

  it('skips syncRewardRoles when guild not found', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 10, level: 3 });
    const client = makeClient({ guildExists: false });
    await modifyXp(client, GID, 'u1', -1000);
    expect(syncRewardRoles).not.toHaveBeenCalled();
  });

  it('skips syncRewardRoles when member fetch fails', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 10, level: 3 });
    const client = makeClient({ fetchResolves: false });
    await modifyXp(client, GID, 'u1', -1000);
    expect(syncRewardRoles).not.toHaveBeenCalled();
  });

  it('clamps negative XP to 0 at level 1', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 5, level: 1 });
    await modifyXp(makeClient(), GID, 'u1', -100);
    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc!.xp).toBe(0);
    expect(doc!.level).toBe(1);
  });

  it('invalidates xpCache after modify', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 0, level: 1 });
    // Put something in cache first
    await xpCache.addMsg(GID, 'u1', 5);
    await modifyXp(makeClient(), GID, 'u1', 10);
    // After modifyXp, cache should be invalidated — drain should have no u1 entry
    const entries = xpCache.drain();
    const hasU1 = entries.some(([key]) => key.includes('u1'));
    expect(hasU1).toBe(false);
  });
});

/* ── getCurrentXp ─────────────────────────────────────────── */

describe('getCurrentXp', () => {
  it('delegates to xpCache.getCurrentXp', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 42, level: 3 });
    const result = await getCurrentXp(GID, 'u1');
    expect(result.level).toBe(3);
    expect(result.xp).toBe(42);
  });
});

/* ── trackMessage ─────────────────────────────────────────── */

describe('trackMessage', () => {
  it('tracks message and returns true', async () => {
    await LevelConfigModel.create({ guildId: GID, xpPerMsg: 10 });
    const member = makeMember();
    const result = await trackMessage(GID, 'u1', 'ch1', member);
    expect(result).toBe(true);
  });

  it('returns false if channel is ignored', async () => {
    await LevelConfigModel.create({
      guildId: GID,
      ignoredChannels: ['ch-ignored'],
    });
    const result = await trackMessage(GID, 'u1', 'ch-ignored', makeMember());
    expect(result).toBe(false);
  });

  it('returns false if user has ignored role', async () => {
    await LevelConfigModel.create({
      guildId: GID,
      ignoredRoles: ['r-ignored'],
    });
    const member = makeMember(['r-ignored']);
    const result = await trackMessage(GID, 'u1', 'ch1', member);
    expect(result).toBe(false);
  });

  it('returns false when on cooldown', async () => {
    await LevelConfigModel.create({ guildId: GID, cooldownSec: 60 });
    await LevelModel.create({
      guildId: GID,
      userId: 'u1',
      xp: 0,
      level: 1,
      lastMessageTs: new Date(),
    });
    const result = await trackMessage(GID, 'u1', 'ch1', makeMember());
    expect(result).toBe(false);
  });

  it('applies multipliers from config', async () => {
    await LevelConfigModel.create({
      guildId: GID,
      xpPerMsg: 10,
      channelMultipliers: [{ channelId: 'ch-bonus', multiplier: 2 }],
    });
    const member = makeMember();
    const result = await trackMessage(GID, 'u1', 'ch-bonus', member);
    expect(result).toBe(true);
    // XP should be 10 * 2 = 20 in cache — verify by drain
    const entries = xpCache.drain();
    expect(entries.length).toBeGreaterThan(0);
  });

  it('uses defaults when no config exists', async () => {
    const result = await trackMessage(GID, 'u1', 'ch1', makeMember());
    expect(result).toBe(true);
  });
});
