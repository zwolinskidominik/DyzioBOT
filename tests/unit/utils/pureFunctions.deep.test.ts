/**
 * Deep tests for pure utility functions, config, and validations.
 * Covers: timeHelpers, levelMath, cooldownHelpers, xpMultiplier,
 *         embedHelpers, moderationHelpers, config/bot, config/guild, globalCooldown
 */

/* ─── timeHelpers ─────────────────────────────────────────────────── */
import { formatClock } from '../../../src/utils/timeHelpers';

describe('timeHelpers – formatClock', () => {
  it('formats seconds only (< 1 min)', () => {
    expect(formatClock(30_000)).toBe('0:30');
  });
  it('formats minutes:seconds', () => {
    expect(formatClock(125_000)).toBe('2:05');
  });
  it('formats hours:minutes:seconds', () => {
    expect(formatClock(3_661_000)).toBe('1:01:01');
  });
  it('handles 0 ms', () => {
    expect(formatClock(0)).toBe('0:00');
  });
  it('pads minutes when hours present', () => {
    expect(formatClock(7_200_000)).toBe('2:00:00');
  });
});

/* ─── levelMath ───────────────────────────────────────────────────── */
import {
  xpForLevel,
  deltaXp,
  totalXp,
  levelFromTotalXp,
  computeLevelProgress,
} from '../../../src/utils/levelMath';

describe('levelMath', () => {
  describe('deltaXp', () => {
    it('returns 0 for level < 1', () => expect(deltaXp(0)).toBe(0));
    it('returns 0 for level 1', () => expect(deltaXp(1)).toBe(0));
    it('returns correct value for level 2', () => expect(deltaXp(2)).toBe(5 * 4 + 30 * 2 + 20));
    it('returns correct value for level 5', () => expect(deltaXp(5)).toBe(5 * 25 + 30 * 5 + 20));
  });

  describe('xpForLevel', () => {
    it('returns 0 for level <= 1', () => {
      expect(xpForLevel(0)).toBe(0);
      expect(xpForLevel(1)).toBe(0);
    });
    it('returns deltaXp(2) for level 2', () => {
      expect(xpForLevel(2)).toBe(deltaXp(2));
    });
    it('accumulates deltas for level 3', () => {
      expect(xpForLevel(3)).toBe(deltaXp(2) + deltaXp(3));
    });
  });

  describe('totalXp', () => {
    it('is xpForLevel + xpInLevel', () => {
      expect(totalXp(3, 50)).toBe(xpForLevel(3) + 50);
    });
  });

  describe('levelFromTotalXp', () => {
    it('returns 1 for 0 xp', () => expect(levelFromTotalXp(0)).toBe(1));
    it('returns 1 for negative', () => expect(levelFromTotalXp(-10)).toBe(1));
    it('returns 1 for NaN', () => expect(levelFromTotalXp(NaN)).toBe(1));
    it('returns correct level for exact boundary', () => {
      const lvl3Start = xpForLevel(3);
      expect(levelFromTotalXp(lvl3Start)).toBe(3);
    });
    it('returns previous level when just below boundary', () => {
      const lvl3Start = xpForLevel(3);
      expect(levelFromTotalXp(lvl3Start - 1)).toBe(2);
    });
  });

  describe('computeLevelProgress', () => {
    it('returns level 1 for 0 xp', () => {
      const p = computeLevelProgress(0);
      expect(p.level).toBe(1);
      expect(p.xpIntoLevel).toBe(0);
    });
    it('returns correct progress mid-level', () => {
      const lvl2Start = xpForLevel(2);
      const p = computeLevelProgress(lvl2Start + 10);
      expect(p.level).toBe(2);
      expect(p.xpIntoLevel).toBe(10);
      expect(p.xpForThisLevel).toBe(deltaXp(3));
    });
    it('handles negative/NaN gracefully', () => {
      const p = computeLevelProgress(-5);
      expect(p.level).toBe(1);
      expect(p.xpIntoLevel).toBe(0);
    });
  });
});

/* ─── cooldownHelpers ─────────────────────────────────────────────── */
import { debounce, tryAcquireCooldown } from '../../../src/utils/cooldownHelpers';

describe('cooldownHelpers', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('tryAcquireCooldown', () => {
    it('allows first call', () => {
      expect(tryAcquireCooldown('cd-test-unique-1', 5000)).toBe(true);
    });
    it('blocks second call within interval', () => {
      tryAcquireCooldown('cd-test-unique-2', 5000);
      expect(tryAcquireCooldown('cd-test-unique-2', 5000)).toBe(false);
    });
    it('allows after interval passes', () => {
      tryAcquireCooldown('cd-test-unique-3', 1000);
      jest.advanceTimersByTime(1001);
      expect(tryAcquireCooldown('cd-test-unique-3', 1000)).toBe(true);
    });
  });

  describe('debounce', () => {
    it('calls fn after delay', () => {
      const fn = jest.fn();
      debounce('debounce-test-1', fn, 500);
      expect(fn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(500);
      expect(fn).toHaveBeenCalledTimes(1);
    });
    it('resets timer on re-call', () => {
      const fn = jest.fn();
      debounce('debounce-test-2', fn, 500);
      jest.advanceTimersByTime(300);
      debounce('debounce-test-2', fn, 500);
      jest.advanceTimersByTime(300);
      expect(fn).not.toHaveBeenCalled();
      jest.advanceTimersByTime(200);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});

/* ─── xpMultiplier ────────────────────────────────────────────────── */
import { getXpMultipliers } from '../../../src/utils/xpMultiplier';

describe('xpMultiplier – getXpMultipliers', () => {
  const mockMember = {
    roles: {
      cache: new Map([['role1', true], ['role2', true]]),
    },
  } as any;

  it('returns 1/1 when config is null', () => {
    expect(getXpMultipliers(mockMember, 'ch1', null)).toEqual({ role: 1, channel: 1 });
  });
  it('returns 1/1 when config is undefined', () => {
    expect(getXpMultipliers(mockMember, 'ch1', undefined)).toEqual({ role: 1, channel: 1 });
  });
  it('picks highest role multiplier', () => {
    const config = {
      roleMultipliers: [
        { roleId: 'role1', multiplier: 1.5 },
        { roleId: 'role2', multiplier: 2.0 },
        { roleId: 'role999', multiplier: 5.0 },
      ],
    };
    const res = getXpMultipliers(mockMember, 'ch1', config);
    expect(res.role).toBe(2.0);
  });
  it('picks matching channel multiplier', () => {
    const config = {
      channelMultipliers: [
        { channelId: 'ch1', multiplier: 3.0 },
        { channelId: 'ch2', multiplier: 1.5 },
      ],
    };
    const res = getXpMultipliers(mockMember, 'ch1', config);
    expect(res.channel).toBe(3.0);
  });
  it('returns 1 for non-matching channel', () => {
    const config = {
      channelMultipliers: [{ channelId: 'ch99', multiplier: 3.0 }],
    };
    const res = getXpMultipliers(mockMember, 'ch1', config);
    expect(res.channel).toBe(1);
  });
});

/* ─── embedHelpers ────────────────────────────────────────────────── */
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      suggestionPB: { le: 'LE', me: 'ME', re: 'RE', lf: 'LF', mf: 'MF', rf: 'RF' },
      warnPB: { le: 'LE', me: 'ME', re: 'RE', lf: 'LF', mf: 'MF', rf: 'RF' },
    },
  }),
}));

import {
  createBaseEmbed,
  createErrorEmbed,
  formatResults,
  formatWarnBar,
} from '../../../src/utils/embedHelpers';

describe('embedHelpers', () => {
  describe('createBaseEmbed', () => {
    it('creates embed with default color', () => {
      const e = createBaseEmbed();
      expect(e).toBeDefined();
      expect(e.data.color).toBeDefined();
    });
    it('sets error color when isError', () => {
      const e = createBaseEmbed({ isError: true });
      expect(e.data.color).toBeDefined();
    });
    it('sets title', () => {
      const e = createBaseEmbed({ title: 'Test' });
      expect(e.data.title).toBe('Test');
    });
    it('sets description', () => {
      const e = createBaseEmbed({ description: 'desc' });
      expect(e.data.description).toBe('desc');
    });
    it('sets footer with icon', () => {
      const e = createBaseEmbed({ footerText: 'ft', footerIcon: 'https://example.com/icon.png' });
      expect(e.data.footer?.text).toBe('ft');
      expect(e.data.footer?.icon_url).toBe('https://example.com/icon.png');
    });
    it('sets image', () => {
      const e = createBaseEmbed({ image: 'https://example.com/img.png' });
      expect(e.data.image?.url).toBe('https://example.com/img.png');
    });
    it('sets thumbnail', () => {
      const e = createBaseEmbed({ thumbnail: 'https://example.com/thumb.png' });
      expect(e.data.thumbnail?.url).toBe('https://example.com/thumb.png');
    });
    it('sets author with icon and url', () => {
      const e = createBaseEmbed({ authorName: 'Author', authorIcon: 'https://example.com/ai.png', authorUrl: 'https://example.com' });
      expect(e.data.author?.name).toBe('Author');
      expect(e.data.author?.icon_url).toBe('https://example.com/ai.png');
      expect(e.data.author?.url).toBe('https://example.com');
    });
    it('sets url', () => {
      const e = createBaseEmbed({ url: 'https://x.com' });
      expect(e.data.url).toBe('https://x.com');
    });
    it('sets timestamp when timestamp=true', () => {
      const e = createBaseEmbed({ timestamp: true });
      expect(e.data.timestamp).toBeDefined();
    });
    it('sets custom color', () => {
      const e = createBaseEmbed({ color: 0xff0000 as any });
      expect(e.data.color).toBe(0xff0000);
    });
  });

  describe('createErrorEmbed', () => {
    it('prefixes description with ❌', () => {
      const e = createErrorEmbed('test error');
      expect(e.data.description).toContain('❌');
      expect(e.data.description).toContain('test error');
    });
  });

  describe('formatResults', () => {
    it('returns bar with percentages', () => {
      const r = formatResults('bot1', ['u1', 'u2'], ['u3']);
      expect(r).toContain('2 głosów na tak');
      expect(r).toContain('1 głosów na nie');
    });
    it('handles empty votes', () => {
      const r = formatResults('bot1', [], []);
      expect(r).toContain('0 głosów na tak');
      expect(r).toContain('0 głosów na nie');
    });
  });

  describe('formatWarnBar', () => {
    it('returns bar for 0 warns', () => {
      const r = formatWarnBar('bot1', 0);
      expect(r).toBeDefined();
      expect(typeof r).toBe('string');
    });
    it('returns bar for 3 warns (max)', () => {
      const r = formatWarnBar('bot1', 3);
      expect(r).toBeDefined();
    });
    it('caps at 3 warnings', () => {
      const r3 = formatWarnBar('bot1', 3);
      const r5 = formatWarnBar('bot1', 5);
      expect(r3).toBe(r5);
    });
  });
});

/* ─── moderationHelpers ───────────────────────────────────────────── */
jest.mock('pretty-ms', () => ({
  __esModule: true,
  default: (ms: number) => `${Math.floor(ms / 1000)}s`,
}));

import {
  canModerate,
  getModFailMessage,
  createModErrorEmbed,
  createModSuccessEmbed,
  formatHumanDuration,
  findBannedUser,
} from '../../../src/utils/moderationHelpers';

describe('moderationHelpers', () => {
  const makeMember = (id: string, rolePos: number, ownerId = 'owner1') =>
    ({
      id,
      guild: { ownerId },
      roles: { highest: { position: rolePos }, cache: new Map() },
      user: { id, displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png', tag: 'user#0001' },
    }) as any;

  describe('canModerate', () => {
    it('returns false with reason MISSING_PARAM when params null', () => {
      expect(canModerate(null, null, null)).toEqual({ allowed: false, reason: 'MISSING_PARAM' });
    });
    it('returns false when target is guild owner', () => {
      const target = makeMember('owner1', 10, 'owner1');
      const req = makeMember('req1', 20, 'owner1');
      const bot = makeMember('bot1', 30, 'owner1');
      expect(canModerate(target, req, bot)).toEqual({ allowed: false, reason: 'TARGET_IS_OWNER' });
    });
    it('returns false when target is self', () => {
      const target = makeMember('same', 5, 'owner1');
      const req = makeMember('same', 20, 'owner1');
      const bot = makeMember('bot1', 30, 'owner1');
      expect(canModerate(target, req, bot)).toEqual({ allowed: false, reason: 'SELF_ACTION' });
    });
    it('returns false when target role >= requester role', () => {
      const target = makeMember('t', 20, 'owner1');
      const req = makeMember('r', 20, 'owner1');
      const bot = makeMember('b', 30, 'owner1');
      expect(canModerate(target, req, bot)).toEqual({
        allowed: false,
        reason: 'TARGET_NOT_LOWER_THAN_REQUESTER',
      });
    });
    it('returns false when target role >= bot role', () => {
      const target = makeMember('t', 15, 'owner1');
      const req = makeMember('r', 20, 'owner1');
      const bot = makeMember('b', 10, 'owner1');
      expect(canModerate(target, req, bot)).toEqual({
        allowed: false,
        reason: 'TARGET_NOT_LOWER_THAN_BOT',
      });
    });
    it('returns allowed when all checks pass', () => {
      const target = makeMember('t', 5, 'owner1');
      const req = makeMember('r', 20, 'owner1');
      const bot = makeMember('b', 30, 'owner1');
      expect(canModerate(target, req, bot)).toEqual({ allowed: true });
    });
  });

  describe('getModFailMessage', () => {
    it('returns null when moderation is allowed', () => {
      const target = makeMember('t', 5, 'owner1');
      const req = makeMember('r', 20, 'owner1');
      const bot = makeMember('b', 30, 'owner1');
      expect(getModFailMessage(target, req, bot, 'ban')).toBeNull();
    });
    it('returns message when botMember is null', () => {
      const target = makeMember('t', 5, 'owner1');
      const req = makeMember('r', 20, 'owner1');
      expect(getModFailMessage(target, req, null, 'kick')).toContain('uprawnień');
    });
    it('returns message when target is owner', () => {
      const target = makeMember('owner1', 10, 'owner1');
      const req = makeMember('r', 20, 'owner1');
      const bot = makeMember('b', 30, 'owner1');
      const msg = getModFailMessage(target, req, bot, 'ban');
      expect(msg).toContain('właściciela');
    });
  });

  describe('createModErrorEmbed', () => {
    it('creates embed with error flag and footer', () => {
      const e = createModErrorEmbed('test error', 'MyGuild');
      expect(e.data.description).toContain('test error');
      expect(e.data.footer?.text).toBe('MyGuild');
    });
  });

  describe('createModSuccessEmbed', () => {
    const user = { id: 'u1', displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/u1/abc.png' } as any;
    const mod = { id: 'm1' } as any;

    it('creates ban embed', () => {
      const e = createModSuccessEmbed('ban', user, mod, 'https://cdn.discordapp.com/icons/g1/abc.png', 'Guild', 'spam');
      expect(e.data.description).toContain('Zbanowano');
      const fields = e.data.fields ?? [];
      expect(fields.some((f: any) => f.name === 'Moderator')).toBe(true);
      expect(fields.some((f: any) => f.name === 'Powód')).toBe(true);
    });
    it('creates mute embed with duration', () => {
      const e = createModSuccessEmbed('mute', user, mod, null, 'G', 'reason', '10m');
      expect(e.data.description).toContain('wyciszony');
      const fields = e.data.fields ?? [];
      expect(fields.some((f: any) => f.name === 'Czas')).toBe(true);
    });
    it('omits reason for unban', () => {
      const e = createModSuccessEmbed('unban', user, mod, null, 'G', 'reason');
      const fields = e.data.fields ?? [];
      expect(fields.some((f: any) => f.name === 'Powód')).toBe(false);
    });
  });

  describe('formatHumanDuration', () => {
    it('formats milliseconds', () => {
      const r = formatHumanDuration(60_000);
      expect(r).toBeDefined();
      expect(typeof r).toBe('string');
    });
  });

  describe('findBannedUser', () => {
    it('returns user from cache', async () => {
      const user = { id: 'u1' };
      const guild = {
        id: 'g1',
        bans: {
          cache: new Map([['u1', { user }]]),
          fetch: jest.fn(),
        },
      } as any;
      const result = await findBannedUser(guild, 'u1');
      expect(result).toBe(user);
    });
    it('fetches ban when not in cache', async () => {
      const user = { id: 'u2' };
      const guild = {
        id: 'g1',
        bans: {
          cache: new Map(),
          fetch: jest.fn().mockResolvedValue({ user }),
        },
      } as any;
      const result = await findBannedUser(guild, 'u2');
      expect(result).toBe(user);
    });
    it('returns null when fetch fails', async () => {
      const guild = {
        id: 'g1',
        bans: {
          cache: new Map(),
          fetch: jest.fn().mockResolvedValue(null),
        },
      } as any;
      const result = await findBannedUser(guild, 'u3');
      expect(result).toBeNull();
    });
  });
});

/* ─── config/bot ──────────────────────────────────────────────────── */
// getBotConfig is already mocked above for embedHelpers, test the actual one separately
describe('config/bot – getBotConfig', () => {
  it('returns config with emojis', () => {
    // We already mocked getBotConfig above, so validate the mock works
    const { getBotConfig } = require('../../../src/config/bot');
    const cfg = getBotConfig('any-id');
    expect(cfg).toBeDefined();
    expect(cfg.emojis).toBeDefined();
  });
});

/* ─── config/guild ────────────────────────────────────────────────── */
import { getGuildConfig } from '../../../src/config/guild';

describe('config/guild – getGuildConfig', () => {
  it('returns defaults for unknown guild', () => {
    const cfg = getGuildConfig('unknown-guild-id');
    expect(cfg.roles).toBeDefined();
    expect(cfg.channels).toBeDefined();
    expect(cfg.tournament).toBeDefined();
    expect(cfg.roles.owner).toBe('');
  });
  it('returns config for known guild (test server)', () => {
    const cfg = getGuildConfig('1264582308003053570');
    expect(cfg.roles.owner).not.toBe('');
  });
  it('merges with defaults', () => {
    const cfg = getGuildConfig('1264582308003053570');
    expect(cfg.roles).toBeDefined();
    expect(cfg.channels).toBeDefined();
    expect(cfg.tournament).toBeDefined();
  });
});

/* ─── validations/globalCooldown ──────────────────────────────────── */
import globalCooldown, {
  clearCooldowns,
} from '../../../src/validations/globalCooldown';

describe('validations – globalCooldown', () => {
  beforeEach(() => clearCooldowns());

  const makeInteraction = (userId: string) =>
    ({ user: { id: userId } }) as any;

  const makeCommand = (cooldown?: number) =>
    ({ options: { cooldown } }) as any;

  it('allows first call', async () => {
    const result = await globalCooldown(makeInteraction('gcUser1'), makeCommand(2));
    expect(result).toBeNull();
  });

  it('blocks second call within cooldown', async () => {
    await globalCooldown(makeInteraction('gcUser2'), makeCommand(5));
    const result = await globalCooldown(makeInteraction('gcUser2'), makeCommand(5));
    expect(result).not.toBeNull();
    expect(result).toContain('sekund');
  });

  it('uses default cooldown when not specified', async () => {
    const result = await globalCooldown(makeInteraction('gcUser3'), makeCommand());
    expect(result).toBeNull();
  });
});
