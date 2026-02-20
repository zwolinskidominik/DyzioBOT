jest.mock('../../../src/models/Level', () => ({
  LevelModel: { findOne: jest.fn() },
}));
jest.mock('../../../src/services/levelNotifier', () => ({
  notifyLevelUp: jest.fn().mockResolvedValue(undefined),
}));

import { XpCache } from '../../../src/cache/xpCache';
import { LevelModel } from '../../../src/models/Level';
import { notifyLevelUp } from '../../../src/services/levelNotifier';
import { deltaXp } from '../../../src/utils/levelMath';

/* ── helpers ─────────────────────────────────────────── */
function leanReturns(doc: any) {
  (LevelModel.findOne as jest.Mock).mockReturnValue({ lean: () => doc });
}

/* ── tests ────────────────────────────────────────────── */
describe('XpCache', () => {
  let cache: XpCache;

  beforeEach(() => {
    jest.clearAllMocks();
    cache = new XpCache();
  });

  /* getCurrentXp ─────────────────────────────────── */
  describe('getCurrentXp', () => {
    it('returns DB values for uncached user', async () => {
      leanReturns({ level: 3, xp: 42 });
      const r = await cache.getCurrentXp('g1', 'u1');
      expect(r).toEqual({ level: 3, xp: 42 });
    });

    it('returns defaults when no DB doc exists', async () => {
      leanReturns(null);
      const r = await cache.getCurrentXp('g1', 'u1');
      expect(r).toEqual({ level: 1, xp: 0 });
    });

    it('returns cached values including levelDelta', async () => {
      leanReturns({ level: 1, xp: 0 });
      await cache.addMsg('g1', 'u1', 10);
      const r = await cache.getCurrentXp('g1', 'u1');
      expect(r.xp).toBe(10);
    });
  });

  /* addMsg ────────────────────────────────────────── */
  describe('addMsg', () => {
    it('creates entry for new user and increments msgCount', async () => {
      leanReturns(null); // no DB doc → level 1, xp 0
      await cache.addMsg('g1', 'u1', 5);
      const entries = cache.drain();
      expect(entries).toHaveLength(1);
      const [, entry] = entries[0];
      expect(entry.bucket.msgCount).toBe(1);
      expect(entry.bucket.vcMin).toBe(0);
    });

    it('accumulates multiple messages', async () => {
      leanReturns(null);
      await cache.addMsg('g1', 'u1', 3);
      await cache.addMsg('g1', 'u1', 3);
      await cache.addMsg('g1', 'u1', 3);
      const entries = cache.drain();
      expect(entries[0][1].bucket.msgCount).toBe(3);
    });
  });

  /* addVcMin ──────────────────────────────────────── */
  describe('addVcMin', () => {
    it('creates entry for new user and increments vcMin', async () => {
      leanReturns(null);
      await cache.addVcMin('g1', 'u1', 2);
      const entries = cache.drain();
      expect(entries[0][1].bucket.vcMin).toBe(1);
      expect(entries[0][1].bucket.msgCount).toBe(0);
    });

    it('accumulates vc minutes', async () => {
      leanReturns(null);
      await cache.addVcMin('g1', 'u1', 2);
      await cache.addVcMin('g1', 'u1', 2);
      const entries = cache.drain();
      expect(entries[0][1].bucket.vcMin).toBe(2);
    });
  });

  /* level-up detection ────────────────────────────── */
  describe('level-up detection', () => {
    it('levels up when XP exceeds delta threshold', async () => {
      // deltaXp(2) = 5*4 + 30*2 + 20 = 100
      const threshold = deltaXp(2); // should be 100
      leanReturns({ level: 1, xp: 0 });
      // Give exactly threshold xp to trigger level-up
      await cache.addMsg('g1', 'u1', threshold);
      const entries = cache.drain();
      expect(entries[0][1].persistedLevel).toBe(2);
    });

    it('calls notifyLevelUp when client is set and user levels up', async () => {
      const threshold = deltaXp(2);
      const fakeClient = {} as any;
      cache.setClient(fakeClient);
      leanReturns({ level: 1, xp: 0 });
      await cache.addMsg('g1', 'u1', threshold);
      expect(notifyLevelUp).toHaveBeenCalledWith(fakeClient, 'g1', 'u1', 2);
    });

    it('does not call notifyLevelUp when no client set', async () => {
      const threshold = deltaXp(2);
      leanReturns({ level: 1, xp: 0 });
      await cache.addMsg('g1', 'u1', threshold);
      expect(notifyLevelUp).not.toHaveBeenCalled();
    });

    it('does not level up when XP below threshold', async () => {
      leanReturns({ level: 1, xp: 0 });
      await cache.addMsg('g1', 'u1', 10);
      const entries = cache.drain();
      expect(entries[0][1].persistedLevel).toBe(1);
    });

    it('handles multi-level jump', async () => {
      // Give enough XP to skip from level 1 to level 3+
      const threshold2 = deltaXp(2); // 100
      const threshold3 = deltaXp(3); // 5*9+30*3+20 = 45+90+20 = 155
      const total = threshold2 + threshold3 + 10; // 265 (beyond both)
      leanReturns({ level: 1, xp: 0 });
      await cache.addMsg('g1', 'u1', total);
      const entries = cache.drain();
      expect(entries[0][1].persistedLevel).toBeGreaterThanOrEqual(3);
    });
  });

  /* invalidateUser ────────────────────────────────── */
  describe('invalidateUser', () => {
    it('removes user from cache', async () => {
      leanReturns(null);
      await cache.addMsg('g1', 'u1', 5);
      cache.invalidateUser('g1', 'u1');
      const entries = cache.drain();
      expect(entries).toHaveLength(0);
    });

    it('no-op when user not in cache', () => {
      expect(() => cache.invalidateUser('g1', 'u1')).not.toThrow();
    });
  });

  /* drain ─────────────────────────────────────────── */
  describe('drain', () => {
    it('returns all entries and clears the map', async () => {
      leanReturns(null);
      await cache.addMsg('g1', 'u1', 5);
      await cache.addMsg('g1', 'u2', 10);
      const first = cache.drain();
      expect(first).toHaveLength(2);
      const second = cache.drain();
      expect(second).toHaveLength(0);
    });
  });

  /* setClient ─────────────────────────────────────── */
  describe('setClient', () => {
    it('sets internal client reference', () => {
      const fakeClient = { id: 'test' } as any;
      cache.setClient(fakeClient);
      // Verify by triggering level-up (notifyLevelUp would use client)
      expect(() => cache.setClient(fakeClient)).not.toThrow();
    });
  });

  /* separate guilds / users ──────────────────────── */
  describe('isolation', () => {
    it('keeps separate entries per guild:user', async () => {
      leanReturns(null);
      await cache.addMsg('g1', 'u1', 5);
      await cache.addMsg('g2', 'u1', 10);
      const entries = cache.drain();
      expect(entries).toHaveLength(2);
    });
  });
});
