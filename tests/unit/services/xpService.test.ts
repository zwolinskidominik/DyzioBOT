import { LevelModel } from '../../../src/models/Level';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { ActivityBucketModel } from '../../../src/models/ActivityBucket';
import {
  getUserRank,
  getLeaderboard,
  setXp,
  setLevel,
  getConfig,
  flush,
} from '../../../src/services/xpService';
import { xpForLevel, deltaXp, computeLevelProgress } from '../../../src/utils/levelMath';
import xpCache from '../../../src/cache/xpCache';

const GID = 'guild-xp';

beforeEach(async () => {
  await LevelModel.deleteMany({});
});

/* ── helpers ──────────────────────────────────────────────── */

async function seedUsers(users: { userId: string; level: number; xp: number }[]) {
  await LevelModel.insertMany(users.map((u) => ({ guildId: GID, ...u })));
}

/* ── getUserRank ──────────────────────────────────────────── */

describe('getUserRank', () => {
  it('returns rank 1 for the highest XP user', async () => {
    await seedUsers([
      { userId: 'u1', level: 5, xp: 100 },
      { userId: 'u2', level: 3, xp: 50 },
      { userId: 'u3', level: 2, xp: 10 },
    ]);

    const res = await getUserRank(GID, 'u1');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rank).toBe(1);
      expect(res.data.totalUsers).toBe(3);
    }
  });

  it('returns correct rank for a middle user', async () => {
    await seedUsers([
      { userId: 'u1', level: 5, xp: 100 },
      { userId: 'u2', level: 3, xp: 50 },
      { userId: 'u3', level: 2, xp: 10 },
    ]);

    const res = await getUserRank(GID, 'u2');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.rank).toBe(2);
  });

  it('returns totalUsers+1 for unknown user', async () => {
    await seedUsers([
      { userId: 'u1', level: 2, xp: 0 },
    ]);

    const res = await getUserRank(GID, 'unknown');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rank).toBe(2); // 1 user + 1
      expect(res.data.totalUsers).toBe(1);
    }
  });

  it('returns rank 1 for empty guild', async () => {
    const res = await getUserRank(GID, 'any');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rank).toBe(1);
      expect(res.data.totalUsers).toBe(0);
    }
  });

  it('ranks by total XP (level+xp combined)', async () => {
    // u1: level 2, xp 500 → totalXp = xpForLevel(2)+500
    // u2: level 3, xp 0   → totalXp = xpForLevel(3)
    const u1Total = xpForLevel(2) + 500;
    const u2Total = xpForLevel(3);

    await seedUsers([
      { userId: 'u1', level: 2, xp: 500 },
      { userId: 'u2', level: 3, xp: 0 },
    ]);

    const r1 = await getUserRank(GID, 'u1');
    const r2 = await getUserRank(GID, 'u2');

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    if (r1.ok && r2.ok) {
      if (u1Total > u2Total) {
        expect(r1.data.rank).toBe(1);
        expect(r2.data.rank).toBe(2);
      } else {
        expect(r2.data.rank).toBe(1);
        expect(r1.data.rank).toBe(2);
      }
    }
  });
});

/* ── getLeaderboard ───────────────────────────────────────── */

describe('getLeaderboard', () => {
  it('returns paginated leaderboard entries', async () => {
    const users = Array.from({ length: 15 }, (_, i) => ({
      userId: `u${i}`,
      level: 15 - i,
      xp: 0,
    }));
    await seedUsers(users);

    const res = await getLeaderboard(GID, 1, 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.entries).toHaveLength(10);
      expect(res.data.totalUsers).toBe(15);
      expect(res.data.page).toBe(1);
      expect(res.data.totalPages).toBe(2);
    }
  });

  it('returns second page correctly', async () => {
    const users = Array.from({ length: 15 }, (_, i) => ({
      userId: `u${i}`,
      level: 15 - i,
      xp: 0,
    }));
    await seedUsers(users);

    const res = await getLeaderboard(GID, 2, 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.entries).toHaveLength(5);
      expect(res.data.page).toBe(2);
    }
  });

  it('fails with NO_USERS for empty guild', async () => {
    const res = await getLeaderboard(GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NO_USERS');
  });

  it('fails with INVALID_PAGE for out-of-range page', async () => {
    await seedUsers([{ userId: 'u1', level: 1, xp: 0 }]);
    const res = await getLeaderboard(GID, 5, 10);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_PAGE');
  });

  it('entries are sorted by totalXp descending', async () => {
    await seedUsers([
      { userId: 'low', level: 1, xp: 10 },
      { userId: 'high', level: 10, xp: 100 },
      { userId: 'mid', level: 5, xp: 50 },
    ]);

    const res = await getLeaderboard(GID, 1, 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const xps = res.data.entries.map((e) => e.totalXp);
      expect(xps).toEqual([...xps].sort((a, b) => b - a));
      expect(res.data.entries[0].userId).toBe('high');
    }
  });

  it('each entry contains correct totalXp', async () => {
    await seedUsers([{ userId: 'u1', level: 5, xp: 42 }]);
    const res = await getLeaderboard(GID, 1, 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.entries[0].totalXp).toBe(xpForLevel(5) + 42);
    }
  });
});

/* ── setXp ────────────────────────────────────────────────── */

describe('setXp', () => {
  it('sets absolute total XP and computes level', async () => {
    const total = 5000;
    const expected = computeLevelProgress(total);

    const res = await setXp(GID, 'u1', total);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.level).toBe(expected.level);
      expect(res.data.xp).toBe(expected.xpIntoLevel);
      expect(res.data.totalXp).toBe(total);
    }

    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc).not.toBeNull();
    expect(doc!.level).toBe(expected.level);
    expect(doc!.xp).toBe(expected.xpIntoLevel);
  });

  it('upserts if user does not exist', async () => {
    const res = await setXp(GID, 'new-user', 100);
    expect(res.ok).toBe(true);

    const doc = await LevelModel.findOne({ guildId: GID, userId: 'new-user' }).lean();
    expect(doc).not.toBeNull();
  });

  it('overwrites existing data', async () => {
    await seedUsers([{ userId: 'u1', level: 10, xp: 999 }]);
    const res = await setXp(GID, 'u1', 0);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.level).toBe(1);
      expect(res.data.xp).toBe(0);
    }
  });

  it('fails for negative XP', async () => {
    const res = await setXp(GID, 'u1', -100);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_VALUE');
  });

  it('fails for NaN', async () => {
    const res = await setXp(GID, 'u1', NaN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_VALUE');
  });
});

/* ── setLevel ─────────────────────────────────────────────── */

describe('setLevel', () => {
  it('sets level and resets xp to 0', async () => {
    const res = await setLevel(GID, 'u1', 10);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.level).toBe(10);
      expect(res.data.xp).toBe(0);
      expect(res.data.totalXp).toBe(xpForLevel(10));
    }

    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc!.level).toBe(10);
    expect(doc!.xp).toBe(0);
  });

  it('upserts if user does not exist', async () => {
    const res = await setLevel(GID, 'new-user', 5);
    expect(res.ok).toBe(true);

    const doc = await LevelModel.findOne({ guildId: GID, userId: 'new-user' }).lean();
    expect(doc).not.toBeNull();
  });

  it('fails for level < 1', async () => {
    const res = await setLevel(GID, 'u1', 0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_VALUE');
  });

  it('fails for NaN', async () => {
    const res = await setLevel(GID, 'u1', NaN);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_VALUE');
  });

  it('overwrites existing level', async () => {
    await seedUsers([{ userId: 'u1', level: 50, xp: 999 }]);
    const res = await setLevel(GID, 'u1', 3);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.level).toBe(3);
      expect(res.data.xp).toBe(0);
    }
  });
});

/* ── getConfig ────────────────────────────────────────────── */

describe('getConfig', () => {
  it('returns null when no config exists', async () => {
    const res = await getConfig('nonexistent');
    expect(res).toBeNull();
  });

  it('returns config data when config exists', async () => {
    await LevelConfigModel.create({
      guildId: GID,
      enabled: true,
      xpPerMsg: 10,
      xpPerMinVc: 20,
      cooldownSec: 5,
      ignoredChannels: ['ch1'],
      ignoredRoles: ['r1'],
    });

    const res = await getConfig(GID);
    expect(res).not.toBeNull();
    expect(res!.guildId).toBe(GID);
    expect(res!.enabled).toBe(true);
    expect(res!.xpPerMsg).toBe(10);
    expect(res!.xpPerMinVc).toBe(20);
    expect(res!.cooldownSec).toBe(5);
    expect(res!.ignoredChannels).toContain('ch1');
    expect(res!.ignoredRoles).toContain('r1');
  });

  it('returns defaults for unset fields', async () => {
    await LevelConfigModel.create({ guildId: GID });

    const res = await getConfig(GID);
    expect(res).not.toBeNull();
    expect(res!.xpPerMsg).toBe(5);
    expect(res!.xpPerMinVc).toBe(10);
    expect(res!.cooldownSec).toBe(0);
    expect(res!.ignoredChannels).toEqual([]);
    expect(res!.ignoredRoles).toEqual([]);
  });
});

/* ── flush ────────────────────────────────────────────────── */

describe('flush', () => {
  beforeEach(() => {
    // Ensure cache is empty before each test
    xpCache.drain();
  });

  it('returns flushed: 0 when cache is empty', async () => {
    const res = await flush();
    expect(res.flushed).toBe(0);
  });

  it('flushes accumulated XP to Level model', async () => {
    // Seed a user so cache can load persisted state
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 50, level: 1 });

    // Manually add XP through cache (small amount, no level-up)
    await xpCache.addMsg(GID, 'u1', 10);
    const res = await flush();

    expect(res.flushed).toBe(1);

    const doc = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    expect(doc).not.toBeNull();
    expect(doc!.xp).toBe(60); // 50 + 10
    expect(doc!.level).toBe(1);
  });

  it('flushes activity bucket data', async () => {
    await LevelModel.create({ guildId: GID, userId: 'u1', xp: 0, level: 1 });

    await xpCache.addMsg(GID, 'u1', 5);
    await flush();

    const buckets = await ActivityBucketModel.find({ guildId: GID, userId: 'u1' }).lean();
    expect(buckets.length).toBeGreaterThanOrEqual(1);
    expect(buckets[0].msgCount).toBe(1);
  });

  it('handles multiple users in a single flush', async () => {
    await LevelModel.insertMany([
      { guildId: GID, userId: 'u1', xp: 0, level: 1 },
      { guildId: GID, userId: 'u2', xp: 0, level: 1 },
    ]);

    await xpCache.addMsg(GID, 'u1', 10);
    await xpCache.addMsg(GID, 'u2', 20);

    const res = await flush();
    expect(res.flushed).toBe(2);

    const u1 = await LevelModel.findOne({ guildId: GID, userId: 'u1' }).lean();
    const u2 = await LevelModel.findOne({ guildId: GID, userId: 'u2' }).lean();
    expect(u1!.xp).toBe(10);
    expect(u2!.xp).toBe(20);
  });
});
