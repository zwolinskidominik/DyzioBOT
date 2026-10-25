import { Collection, Invite } from 'discord.js';
import {
  cacheGuildInvites,
  getCachedInvites,
  getCachedVanityUses,
  detectUsedInvite,
  addInviteToCache,
  clearGuildCache,
  _resetCache,
} from '../../../src/cache/inviteCache';

// Helper to create a mock invite collection
function createMockInvites(entries: Array<{ code: string; uses: number; inviterId?: string; maxUses?: number; expiresTimestamp?: number | null }>): Collection<string, Invite> {
  const collection = new Collection<string, Invite>();
  for (const entry of entries) {
    collection.set(entry.code, {
      code: entry.code,
      uses: entry.uses,
      inviter: entry.inviterId ? { id: entry.inviterId } : null,
      maxUses: entry.maxUses ?? 0,
      expiresTimestamp: entry.expiresTimestamp ?? null,
    } as unknown as Invite);
  }
  return collection;
}

const NOW = Date.parse('2026-10-13T12:00:00Z');

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

    it('attributes a single-use invite that Discord deleted after its last use to its author', async () => {
      await cacheGuildInvites('g1', createMockInvites([
        { code: 'abc', uses: 0 },
        { code: 'single', uses: 0, inviterId: 'user-9', maxUses: 1 },
      ]));

      const result = await detectUsedInvite('g1', createMockInvites([{ code: 'abc', uses: 0 }]), null, NOW);
      expect(result).toEqual({ code: 'single', inviterId: 'user-9', consumedUses: 1 });
    });

    it('attributes a limited invite that reached its max uses', async () => {
      await cacheGuildInvites('g1', createMockInvites([{ code: 'lim', uses: 4, inviterId: 'user-9', maxUses: 5 }]));

      const result = await detectUsedInvite('g1', createMockInvites([]), null, NOW);
      expect(result).toEqual({ code: 'lim', inviterId: 'user-9', consumedUses: 5 });
    });

    it('does NOT treat an invite that simply expired as used', async () => {
      await cacheGuildInvites('g1', createMockInvites([
        { code: 'old', uses: 0, inviterId: 'user-9', maxUses: 1, expiresTimestamp: NOW - 1000 },
      ]));

      const result = await detectUsedInvite('g1', createMockInvites([]), null, NOW);
      expect(result).toBeNull();
      expect(getCachedInvites('g1')?.has('old')).toBe(false);
    });

    it('does NOT treat a manually deleted unlimited invite as used', async () => {
      await cacheGuildInvites('g1', createMockInvites([{ code: 'manual', uses: 12, inviterId: 'user-9' }]));

      const result = await detectUsedInvite('g1', createMockInvites([]), null, NOW);
      expect(result).toBeNull();
    });

    it('returns null when two invites were consumed at once (ambiguous)', async () => {
      await cacheGuildInvites('g1', createMockInvites([
        { code: 's1', uses: 0, inviterId: 'a', maxUses: 1 },
        { code: 's2', uses: 0, inviterId: 'b', maxUses: 1 },
      ]));

      const result = await detectUsedInvite('g1', createMockInvites([]), null, NOW);
      expect(result).toBeNull();
    });

    it('keeps a just-consumed invite in memory when a new invite is created in between', async () => {
      await cacheGuildInvites('g1', createMockInvites([{ code: 'single', uses: 0, inviterId: 'user-9', maxUses: 1 }]));
      // inviteCreate dopisuje jedno zaproszenie zamiast pobierać całą listę od nowa
      const fresh = createMockInvites([{ code: 'new', uses: 0, inviterId: 'user-2' }]);
      addInviteToCache('g1', fresh.get('new')!);

      const result = await detectUsedInvite('g1', fresh, null, NOW);
      expect(result?.code).toBe('single');
      expect(result?.inviterId).toBe('user-9');
    });

    it('returns null when no invite was used', async () => {
      const invites = createMockInvites([
        { code: 'abc', uses: 5 },
      ]);
      await cacheGuildInvites('g1', invites);

      // Same state - no change
      const result = await detectUsedInvite('g1', invites);
      expect(result).toBeNull();
    });

    it('detects a join through the vanity link (uses counter went up)', async () => {
      const invites = createMockInvites([{ code: 'abc', uses: 5 }]);
      await cacheGuildInvites('g1', invites, 40);

      // Zwykłe zaproszenia bez zmian, ale licznik vanity 40 → 41
      const result = await detectUsedInvite('g1', invites, { code: 'gamezone', uses: 41 });

      expect(result).not.toBeNull();
      expect(result?.code).toBe('gamezone');
      expect(result?.inviterId).toBeNull();
      expect(getCachedVanityUses('g1')).toBe(41);
    });

    it('prefers a regular invite over vanity when both could match', async () => {
      const oldInvites = createMockInvites([{ code: 'abc', uses: 5, inviterId: 'user-1' }]);
      await cacheGuildInvites('g1', oldInvites, 40);

      const newInvites = createMockInvites([{ code: 'abc', uses: 6, inviterId: 'user-1' }]);
      const result = await detectUsedInvite('g1', newInvites, { code: 'gamezone', uses: 41 });

      expect(result?.code).toBe('abc');
      expect(result?.inviterId).toBe('user-1');
    });

    it('ignores vanity when its uses did not change', async () => {
      const invites = createMockInvites([{ code: 'abc', uses: 5 }]);
      await cacheGuildInvites('g1', invites, 40);

      const result = await detectUsedInvite('g1', invites, { code: 'gamezone', uses: 40 });
      expect(result).toBeNull();
    });

    it('does not report vanity on the first join after restart (no baseline yet)', async () => {
      const invites = createMockInvites([{ code: 'abc', uses: 5 }]);
      await cacheGuildInvites('g1', invites); // brak licznika vanity w cache

      const result = await detectUsedInvite('g1', invites, { code: 'gamezone', uses: 41 });
      expect(result).toBeNull();
      // ...ale stan wyjściowy zostaje zapamiętany, więc kolejne dołączenie już się wykryje
      expect(getCachedVanityUses('g1')).toBe(41);
    });

    it('keeps the vanity counter untouched when caching without it (inviteCreate/Delete)', async () => {
      const invites = createMockInvites([{ code: 'abc', uses: 5 }]);
      await cacheGuildInvites('g1', invites, 40);

      await cacheGuildInvites('g1', createMockInvites([{ code: 'abc', uses: 5 }, { code: 'new', uses: 0 }]));

      expect(getCachedVanityUses('g1')).toBe(40);
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
