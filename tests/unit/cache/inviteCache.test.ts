import { Collection, Invite } from 'discord.js';
import {
  cacheGuildInvites,
  getCachedInvites,
  detectUsedInvite,
  clearGuildCache,
  _resetCache,
} from '../../../src/cache/inviteCache';

// Helper to create a mock invite collection
function createMockInvites(entries: Array<{ code: string; uses: number; inviterId?: string }>): Collection<string, Invite> {
  const collection = new Collection<string, Invite>();
  for (const entry of entries) {
    collection.set(entry.code, {
      code: entry.code,
      uses: entry.uses,
      inviter: entry.inviterId ? { id: entry.inviterId } : null,
    } as unknown as Invite);
  }
  return collection;
}

beforeEach(() => {
  _resetCache();
});

describe('inviteCache', () => {
  describe('cacheGuildInvites', () => {
    it('stores invite uses for a guild', async () => {
      const invites = createMockInvites([
        { code: 'abc', uses: 5 },
        { code: 'def', uses: 10 },
      ]);

      await cacheGuildInvites('g1', invites);

      const cached = getCachedInvites('g1');
      expect(cached).toBeDefined();
      expect(cached?.get('abc')).toBe(5);
      expect(cached?.get('def')).toBe(10);
    });
  });

  describe('getCachedInvites', () => {
    it('returns undefined for uncached guild', () => {
      expect(getCachedInvites('unknown')).toBeUndefined();
    });
  });

  describe('detectUsedInvite', () => {
    it('detects an invite with increased uses', async () => {
      // Seed cache with old state
      const oldInvites = createMockInvites([
        { code: 'abc', uses: 5, inviterId: 'user-1' },
        { code: 'def', uses: 10 },
      ]);
      await cacheGuildInvites('g1', oldInvites);

      // New state: abc went from 5 → 6
      const newInvites = createMockInvites([
        { code: 'abc', uses: 6, inviterId: 'user-1' },
        { code: 'def', uses: 10 },
      ]);

      const result = await detectUsedInvite('g1', newInvites);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('abc');
      expect(result?.inviterId).toBe('user-1');
    });

    it('detects a deleted invite (single-use)', async () => {
      const oldInvites = createMockInvites([
        { code: 'abc', uses: 0 },
        { code: 'single', uses: 0 },
      ]);
      await cacheGuildInvites('g1', oldInvites);

      // "single" invite was used and auto-deleted
      const newInvites = createMockInvites([
        { code: 'abc', uses: 0 },
      ]);

      const result = await detectUsedInvite('g1', newInvites);
      expect(result).not.toBeNull();
      expect(result?.code).toBe('single');
      expect(result?.inviterId).toBeNull();
    });

    it('returns null when no invite was used', async () => {
      const invites = createMockInvites([
        { code: 'abc', uses: 5 },
      ]);
      await cacheGuildInvites('g1', invites);

      // Same state — no change
      const result = await detectUsedInvite('g1', invites);
      expect(result).toBeNull();
    });

    it('returns null and seeds cache when no prior cache exists', async () => {
      const invites = createMockInvites([
        { code: 'abc', uses: 1 },
      ]);

      const result = await detectUsedInvite('g1', invites);
      expect(result).toBeNull();

      // Cache should now be populated
      const cached = getCachedInvites('g1');
      expect(cached).toBeDefined();
      expect(cached?.get('abc')).toBe(1);
    });
  });

  describe('clearGuildCache', () => {
    it('removes cached invites for a guild', async () => {
      const invites = createMockInvites([{ code: 'abc', uses: 5 }]);
      await cacheGuildInvites('g1', invites);

      clearGuildCache('g1');
      expect(getCachedInvites('g1')).toBeUndefined();
    });
  });

  describe('_resetCache', () => {
    it('clears all cached data', async () => {
      const invites = createMockInvites([{ code: 'abc', uses: 5 }]);
      await cacheGuildInvites('g1', invites);
      await cacheGuildInvites('g2', invites);

      _resetCache();
      expect(getCachedInvites('g1')).toBeUndefined();
      expect(getCachedInvites('g2')).toBeUndefined();
    });
  });
});
