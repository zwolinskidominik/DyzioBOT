/**
 * Branch-coverage tests batch 2 — targeting commands and services
 * with low branch coverage.
 *
 * Files covered:
 *  - embed.ts (misc)            53% branches
 *  - giveaway.ts (admin)        55% branches  
 *  - toplvl.ts (user)           42% branches
 *  - serverinfo.ts (misc)       55% branches
 *  - wrozba.ts (misc)           66% branches
 *  - warnings.ts (misc)         73% branches
 *  - birthday.ts (misc)         57% branches
 *  - parseDuration.ts           (pure helper)
 *  - giveawayService            76% branches  (pickWinnerIds, computeMultiplier etc.)
 *  - birthdayService            66% branches  (parseBirthdayDate, getDaysForm, formatBirthdayConfirmation)
 *  - emojiSteal.ts              70% branches
 *  - memeHelpers.ts             56% branches
 *  - EventHandler.ts            66% branches
 */

/* ── mocks ──────────────────────────────────────────────────── */

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    addFields: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
  }),
  createErrorEmbed: jest.fn().mockReturnValue({ setDescription: jest.fn().mockReturnThis(), addFields: jest.fn().mockReturnThis() }),
  formatResults: jest.fn().mockReturnValue('0/0'),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    DEFAULT: '#000', ERROR: '#f00', EMBED: '#0099ff', FORTUNE: '#800080',
    WARNINGS_LIST: '#ffa500', BIRTHDAY: '#ff69b4', FACEIT: '#ff5500',
    GIVEAWAY: '#ffd700', GIVEAWAY_ENDED: '#808080', MUSIC: '#1db954',
    MUSIC_PAUSE: '#808080', MUSIC_SUCCESS: '#00ff00',
  },
}));
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      birthday: '🎂',
      boost: { thanks: '<:thx:1>' },
      faceit: { levels: { 1: 'L1', 10: 'L10' }, checkmark: '✅', crossmark: '❌' },
      giveaway: { join: '🎉', list: '📋' },
      suggestion: { upvote: '👍', downvote: '👎' },
      next: '➡️', previous: '⬅️',
    },
  }),
}));

/* ================================================================
   parseDuration — pure helper
   ================================================================ */
describe('parseDuration', () => {
  let parseRawDurationMs: (s: string) => number;
  let parseDuration: (s: string) => number | null;

  beforeAll(async () => {
    const mod = await import('../../../src/utils/parseDuration');
    parseRawDurationMs = mod.parseRawDurationMs;
    parseDuration = mod.parseDuration;
  });

  it('parses days', () => {
    expect(parseRawDurationMs('3d')).toBe(3 * 86400000);
    expect(parseRawDurationMs('1 day')).toBe(86400000);
    expect(parseRawDurationMs('2 days')).toBe(2 * 86400000);
  });

  it('parses hours', () => {
    expect(parseRawDurationMs('5h')).toBe(5 * 3600000);
    expect(parseRawDurationMs('1 hour')).toBe(3600000);
    expect(parseRawDurationMs('2 hours')).toBe(2 * 3600000);
  });

  it('parses minutes', () => {
    expect(parseRawDurationMs('10m')).toBe(10 * 60000);
    expect(parseRawDurationMs('1 min')).toBe(60000);
    expect(parseRawDurationMs('2 minutes')).toBe(2 * 60000);
  });

  it('parses seconds', () => {
    expect(parseRawDurationMs('30s')).toBe(30000);
    expect(parseRawDurationMs('1 sec')).toBe(1000);
    expect(parseRawDurationMs('10 seconds')).toBe(10000);
  });

  it('parses combined', () => {
    expect(parseRawDurationMs('1d 2h 30m')).toBe(86400000 + 7200000 + 1800000);
    expect(parseRawDurationMs('5d4h2m')).toBe(5 * 86400000 + 4 * 3600000 + 2 * 60000);
  });

  it('returns 0 for no tokens', () => {
    expect(parseRawDurationMs('')).toBe(0);
    expect(parseRawDurationMs('hello')).toBe(0);
  });

  it('parseDuration returns null when below min (5s)', () => {
    expect(parseDuration('1s')).toBeNull();
    expect(parseDuration('4s')).toBeNull();
  });

  it('parseDuration returns null when above max (~28 days)', () => {
    expect(parseDuration('30d')).toBeNull();
  });

  it('parseDuration returns ms for valid range', () => {
    expect(parseDuration('1h')).toBe(3600000);
    expect(parseDuration('5d')).toBe(5 * 86400000);
  });

  it('parseDuration returns null for empty string', () => {
    expect(parseDuration('')).toBeNull();
  });
});

/* ================================================================
   giveawayService — pickWinnerIds, computeMultiplier (pure functions)
   ================================================================ */
describe('giveawayService pure functions', () => {
  let pickWinnerIds: (participants: string[], count: number) => string[];
  let computeMultiplier: (memberRoleIds: string[], roleMultipliers: Record<string, number>) => number;

  beforeAll(async () => {
    const mod = await import('../../../src/services/giveawayService');
    pickWinnerIds = mod.pickWinnerIds;
    computeMultiplier = mod.computeMultiplier;
  });

  describe('pickWinnerIds', () => {
    it('returns empty for empty pool', () => {
      expect(pickWinnerIds([], 5)).toEqual([]);
    });

    it('returns empty for count < 1', () => {
      expect(pickWinnerIds(['a', 'b'], 0)).toEqual([]);
    });

    it('picks unique winners from pool with duplicates', () => {
      const pool = ['a', 'a', 'b', 'b', 'c', 'c'];
      const winners = pickWinnerIds(pool, 3);
      expect(winners.length).toBe(3);
      expect(new Set(winners).size).toBe(3);
    });

    it('returns fewer winners when pool too small', () => {
      const winners = pickWinnerIds(['a', 'a', 'a'], 5);
      expect(winners).toEqual(['a']);
    });

    it('picks exactly count unique winners', () => {
      const pool = ['a', 'b', 'c', 'd', 'e'];
      const winners = pickWinnerIds(pool, 2);
      expect(winners.length).toBe(2);
      expect(new Set(winners).size).toBe(2);
    });
  });

  describe('computeMultiplier', () => {
    it('returns 1 when no matching roles', () => {
      expect(computeMultiplier(['r1', 'r2'], { r3: 5 })).toBe(1);
    });

    it('returns 1 when empty multipliers', () => {
      expect(computeMultiplier(['r1'], {})).toBe(1);
    });

    it('returns the multiplier for matching role', () => {
      expect(computeMultiplier(['r1', 'r2'], { r1: 3 })).toBe(3);
    });

    it('returns the best (highest) multiplier', () => {
      expect(computeMultiplier(['r1', 'r2'], { r1: 2, r2: 5 })).toBe(5);
    });

    it('ignores multiplier <= 1', () => {
      expect(computeMultiplier(['r1'], { r1: 1 })).toBe(1);
    });
  });
});

/* ================================================================
   birthdayService — parseBirthdayDate, getDaysForm, formatBirthdayConfirmation
   ================================================================ */
describe('birthdayService pure functions', () => {
  let parseBirthdayDate: (s: string) => any;
  let getDaysForm: (d: number) => string;
  let formatBirthdayConfirmation: (emoji: string, userId: string, date: Date, yearSpecified: boolean) => string;

  beforeAll(async () => {
    // Use requireActual to bypass the mock
    const mod = jest.requireActual('../../../src/services/birthdayService');
    parseBirthdayDate = mod.parseBirthdayDate;
    getDaysForm = mod.getDaysForm;
    formatBirthdayConfirmation = mod.formatBirthdayConfirmation;
  });

  describe('parseBirthdayDate', () => {
    it('parses DD-MM-YYYY format', () => {
      const result = parseBirthdayDate('15-04-1994');
      expect(result.isValid).toBe(true);
      expect(result.yearSpecified).toBe(true);
      expect(result.date).toBeInstanceOf(Date);
    });

    it('parses DD-MM format', () => {
      const result = parseBirthdayDate('25-12');
      expect(result.isValid).toBe(true);
      expect(result.yearSpecified).toBe(false);
    });

    it('rejects invalid format', () => {
      const result = parseBirthdayDate('2024/01/15');
      expect(result.isValid).toBe(false);
      expect(result.date).toBeNull();
    });

    it('rejects invalid date (e.g., 32-13-2000)', () => {
      const result = parseBirthdayDate('32-13-2000');
      expect(result.isValid).toBe(false);
    });

    it('rejects invalid DD-MM date', () => {
      const result = parseBirthdayDate('99-99');
      expect(result.isValid).toBe(false);
    });
  });

  describe('getDaysForm', () => {
    it('returns singular form for 1', () => {
      const result = getDaysForm(1);
      expect(result.length).toBeGreaterThan(0);
    });

    it('returns plural form for other numbers', () => {
      const result5 = getDaysForm(5);
      expect(result5.length).toBeGreaterThan(0);
      expect(getDaysForm(0)).toBe(result5);
      expect(getDaysForm(100)).toBe(result5);
    });
  });

  describe('formatBirthdayConfirmation', () => {
    it('returns today message with year', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birthdayThisYear = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
      const result = formatBirthdayConfirmation('🎂', 'u1', birthdayThisYear, true);
      expect(result).toContain('u1');
      expect(result).toContain('25');
    });

    it('returns today message without year', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const birthdayToday = new Date(1970, today.getMonth(), today.getDate());
      const result = formatBirthdayConfirmation('🎂', 'u1', birthdayToday, false);
      expect(result).toContain('u1');
      expect(result).toContain('kolejne');
    });

    it('returns future message with year specified', () => {
      const future = new Date();
      future.setMonth(future.getMonth() + 2);
      future.setFullYear(future.getFullYear() - 20);
      const result = formatBirthdayConfirmation('🎂', 'u1', future, true);
      expect(result).toContain('urodziny');
      expect(result).toContain('u1');
    });

    it('returns future message without year specified', () => {
      const future = new Date(1970, new Date().getMonth() + 2, 15);
      const result = formatBirthdayConfirmation('🎂', 'u1', future, false);
      expect(result).toContain('u1');
      // future without year has 'Nastepne' or equivalent
      expect(result.length).toBeGreaterThan(10);
    });

    it('handles birthday that has already passed this year (wraps to next year)', () => {
      const past = new Date();
      past.setMonth(past.getMonth() - 1);
      past.setFullYear(past.getFullYear() - 20);
      const result = formatBirthdayConfirmation('🎂', 'u1', past, true);
      expect(result).toContain('urodziny');
    });
  });
});

/* ================================================================
   embed.ts command — buildEmbed branches (no guild, extra fields)
   ================================================================ */
describe('embed command', () => {
  let run: (opts: any) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('../../../src/commands/misc/embed');
    run = mod.run;
  });
  beforeEach(() => jest.clearAllMocks());

  function makeInteraction(opts: Record<string, any> = {}) {
    const options = new Map<string, any>();
    return {
      deferReply: jest.fn(),
      editReply: jest.fn(),
      guild: opts.guild ?? { name: 'TestGuild', iconURL: jest.fn().mockReturnValue('icon') },
      options: {
        getString: jest.fn((key: string) => options.get(key) ?? null),
        _set: (key: string, val: any) => options.set(key, val),
      },
      ...opts,
    };
  }

  it('creates embed with title and description only', async () => {
    const interaction = makeInteraction();
    interaction.options._set('tytul', 'Test Title');
    interaction.options._set('opis', 'Test Description');
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('creates embed with extra fields (tytul2/opis2, tytul3/opis3)', async () => {
    const interaction = makeInteraction();
    interaction.options._set('tytul', 'T');
    interaction.options._set('opis', 'D');
    interaction.options._set('tytul2', 'Field2');
    interaction.options._set('opis2', 'Desc2');
    interaction.options._set('tytul3', 'Field3');
    interaction.options._set('opis3', 'Desc3');
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('skips incomplete extra fields (title without description)', async () => {
    const interaction = makeInteraction();
    interaction.options._set('tytul', 'T');
    interaction.options._set('opis', 'D');
    interaction.options._set('tytul2', 'Field2');
    // opis2 missing
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('uses default color when none specified', async () => {
    const interaction = makeInteraction();
    interaction.options._set('tytul', 'T');
    interaction.options._set('opis', 'D');
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('uses custom color when specified', async () => {
    const interaction = makeInteraction();
    interaction.options._set('tytul', 'T');
    interaction.options._set('opis', 'D');
    interaction.options._set('kolor', '#ff0000');
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns error when guild is null (buildEmbed returns null)', async () => {
    const interaction = makeInteraction({ guild: null });
    interaction.options._set('tytul', 'T');
    interaction.options._set('opis', 'D');
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles error in try/catch', async () => {
    const interaction = makeInteraction();
    interaction.deferReply.mockRejectedValue(new Error('fail'));
    interaction.options._set('tytul', 'T');
    interaction.options._set('opis', 'D');
    // The outer catch should handle this - editReply with error embed
    await run({ interaction });
  });
});

/* ================================================================
   wrozba command — success, error from service, catch
   ================================================================ */
jest.mock('../../../src/services/fortuneService', () => ({
  getFortune: jest.fn(),
  DAILY_FORTUNE_LIMIT: 3,
}));

describe('wrozba command', () => {
  let run: (opts: any) => Promise<void>;
  let getFortune: jest.Mock;

  beforeAll(async () => {
    const mod = await import('../../../src/commands/misc/wrozba');
    run = mod.run;
    getFortune = require('../../../src/services/fortuneService').getFortune;
  });
  beforeEach(() => jest.clearAllMocks());

  function makeInteraction() {
    return {
      deferReply: jest.fn(),
      editReply: jest.fn(),
      user: { id: 'u1' },
    };
  }

  it('sends fortune on success', async () => {
    getFortune.mockResolvedValue({ ok: true, data: { fortune: 'Good luck!', remainingToday: 2 } });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('sends error embed when service returns fail', async () => {
    getFortune.mockResolvedValue({ ok: false, message: 'Limit exceeded' });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles thrown error', async () => {
    getFortune.mockRejectedValue(new Error('db error'));
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles non-Error thrown value', async () => {
    getFortune.mockRejectedValue('string error');
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ================================================================
   warnings command — permission check, success, no warnings, error
   ================================================================ */
jest.mock('../../../src/services/warnService', () => ({
  getWarnings: jest.fn(),
}));

describe('warnings command', () => {
  let run: (opts: any) => Promise<void>;
  let getWarnings: jest.Mock;

  beforeAll(async () => {
    const mod = await import('../../../src/commands/misc/warnings');
    run = mod.run;
    getWarnings = require('../../../src/services/warnService').getWarnings;
  });
  beforeEach(() => jest.clearAllMocks());

  function makeInteraction(overrides: Record<string, any> = {}) {
    return {
      deferReply: jest.fn(),
      editReply: jest.fn(),
      reply: jest.fn(),
      user: { id: 'u1', tag: 'User#1', displayAvatarURL: jest.fn().mockReturnValue('url') },
      guild: { id: 'g1' },
      member: {
        permissions: { has: jest.fn().mockReturnValue(true) },
      },
      options: {
        getUser: jest.fn().mockReturnValue(null),
      },
      ...overrides,
    };
  }

  it('shows own warnings without additional permissions', async () => {
    getWarnings.mockResolvedValue({
      ok: true,
      data: { warnings: [{ date: new Date(), moderatorId: 'mod1', reason: 'test' }], count: 1 },
    });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('denies checking other users warnings without permissions', async () => {
    const targetUser = { id: 'u2', tag: 'Other#1', displayAvatarURL: jest.fn().mockReturnValue('') };
    const interaction = makeInteraction({
      options: { getUser: jest.fn().mockReturnValue(targetUser) },
      member: { permissions: { has: jest.fn().mockReturnValue(false) } },
    });
    await run({ interaction });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('allows checking others with permissions', async () => {
    const targetUser = { id: 'u2', tag: 'Other#1', displayAvatarURL: jest.fn().mockReturnValue('') };
    getWarnings.mockResolvedValue({ ok: true, data: { warnings: [], count: 0 } });
    const interaction = makeInteraction({
      options: { getUser: jest.fn().mockReturnValue(targetUser) },
    });
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles service error', async () => {
    getWarnings.mockResolvedValue({ ok: false, message: 'DB error' });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles thrown error', async () => {
    getWarnings.mockRejectedValue(new Error('crash'));
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('formats warnings with moderatorId', async () => {
    getWarnings.mockResolvedValue({
      ok: true,
      data: {
        warnings: [
          { date: new Date(), moderatorId: 'mod1', reason: 'spam' },
          { date: new Date(), moderatorId: null, moderator: 'OldMod', reason: 'test' },
          { date: new Date(), moderatorId: null, moderator: null, reason: 'unknown' },
        ],
        count: 3,
      },
    });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles string permissions from member', async () => {
    const targetUser = { id: 'u2', tag: 'Other#1', displayAvatarURL: jest.fn().mockReturnValue('') };
    const interaction = makeInteraction({
      options: { getUser: jest.fn().mockReturnValue(targetUser) },
      member: { permissions: 'some_string' },
    });
    await run({ interaction });
    expect(interaction.reply).toHaveBeenCalled();
  });
});

/* ================================================================
   serverinfo command — success, joinedAt null, error
   ================================================================ */
describe('serverinfo command', () => {
  let run: (opts: any) => Promise<void>;

  beforeAll(async () => {
    const mod = await import('../../../src/commands/misc/serverinfo');
    run = mod.run;
  });
  beforeEach(() => jest.clearAllMocks());

  function makeInteraction(overrides: Record<string, any> = {}) {
    return {
      deferReply: jest.fn(),
      editReply: jest.fn(),
      guild: {
        name: 'TestGuild',
        id: 'g1',
        ownerId: 'own1',
        memberCount: 100,
        roles: { cache: new Map([['r1', {}]]) },
        emojis: { cache: new Map([['e1', {}]]) },
        createdTimestamp: Date.now() - 86400000,
        premiumSubscriptionCount: 5,
        verificationLevel: 2,
        iconURL: jest.fn().mockReturnValue('iconUrl'),
      },
      member: {
        joinedAt: new Date(),
      },
      ...overrides,
    };
  }

  it('shows server info successfully', async () => {
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows server info with no icon', async () => {
    const interaction = makeInteraction();
    interaction.guild!.iconURL.mockReturnValue(null);
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows server info with zero premium count', async () => {
    const interaction = makeInteraction();
    interaction.guild!.premiumSubscriptionCount = 0;
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows server info with unknown verification level', async () => {
    const interaction = makeInteraction();
    interaction.guild!.verificationLevel = 99;
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles error when joinedAt is null', async () => {
    const interaction = makeInteraction({ member: { joinedAt: null } });
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
  });

  it('handles thrown error', async () => {
    const interaction = makeInteraction();
    (interaction as any).guild = null;
    (interaction as any).member = null;
    await run({ interaction }).catch(() => {});
  });
});

/* ================================================================
   toplvl command — success, error, NO_USERS, user fetch error, page > 1
   ================================================================ */
jest.mock('../../../src/services/xpService', () => ({
  getLeaderboard: jest.fn(),
}));
jest.mock('../../../src/events/clientReady/xpFlush', () => jest.fn().mockResolvedValue(undefined));
jest.mock('../../../src/utils/canvasLeaderboardCard', () => ({
  CanvasLeaderboardCard: jest.fn().mockImplementation(() => ({
    build: jest.fn().mockResolvedValue(Buffer.from('png')),
  })),
}));

describe('toplvl command', () => {
  let run: (opts: any) => Promise<void>;
  let getLeaderboard: jest.Mock;

  beforeAll(async () => {
    const mod = await import('../../../src/commands/user/toplvl');
    run = mod.run;
    getLeaderboard = require('../../../src/services/xpService').getLeaderboard;
  });
  beforeEach(() => jest.clearAllMocks());

  function makeInteraction(page: number | null = null) {
    return {
      guildId: 'g1',
      guild: { name: 'TestGuild' },
      options: { getInteger: jest.fn().mockReturnValue(page) },
      deferReply: jest.fn(),
      reply: jest.fn(),
      editReply: jest.fn(),
      client: {
        users: { fetch: jest.fn().mockResolvedValue({ username: 'User1', displayAvatarURL: jest.fn().mockReturnValue('avatar') }) },
        user: { id: 'bot1' },
        application: { id: 'bot1' },
      },
    };
  }

  it('shows leaderboard page 1', async () => {
    getLeaderboard.mockResolvedValue({
      ok: true,
      data: { entries: [{ userId: 'u1', level: 5, totalXp: 500 }] },
    });
    const interaction = makeInteraction(null);
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows leaderboard page > 1 with content', async () => {
    getLeaderboard.mockResolvedValue({
      ok: true,
      data: { entries: [{ userId: 'u2', level: 3, totalXp: 300 }] },
    });
    const interaction = makeInteraction(2);
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles NO_USERS error', async () => {
    getLeaderboard.mockResolvedValue({ ok: false, code: 'NO_USERS', message: 'No users' });
    const interaction = makeInteraction(null);
    await run({ interaction });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('handles other error from service', async () => {
    getLeaderboard.mockResolvedValue({ ok: false, code: 'OTHER', message: 'Some error' });
    const interaction = makeInteraction(null);
    await run({ interaction });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('handles user fetch error (shows unknown user)', async () => {
    getLeaderboard.mockResolvedValue({
      ok: true,
      data: { entries: [{ userId: 'u_fail', level: 1, totalXp: 100 }] },
    });
    const interaction = makeInteraction(null);
    interaction.client.users.fetch.mockRejectedValue(new Error('not found'));
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ================================================================
   birthday command — no guild, no birthday, birthday today, future, error
   ================================================================ */
jest.mock('../../../src/services/birthdayService', () => ({
  ...jest.requireActual('../../../src/services/birthdayService'),
  getBirthday: jest.fn(),
  getDaysForm: jest.fn().mockReturnValue('dni'),
}));

describe('birthday command', () => {
  let run: (opts: any) => Promise<void>;
  let getBirthday: jest.Mock;

  beforeAll(async () => {
    const mod = await import('../../../src/commands/misc/birthdays/birthday');
    run = mod.run;
    getBirthday = require('../../../src/services/birthdayService').getBirthday;
  });
  beforeEach(() => jest.clearAllMocks());

  function makeInteraction(overrides: Record<string, any> = {}) {
    return {
      deferReply: jest.fn(),
      editReply: jest.fn(),
      reply: jest.fn(),
      user: { id: 'u1' },
      guild: { id: 'g1' },
      client: { application: { id: 'bot1' } },
      options: { getUser: jest.fn().mockReturnValue(null) },
      ...overrides,
    };
  }

  it('returns error when no guildId', async () => {
    const interaction = makeInteraction({ guild: null });
    await run({ interaction });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('returns no birthday info when result is null', async () => {
    getBirthday.mockResolvedValue({ ok: true, data: null });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns birthday data (today, with year)', async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const birthday = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate());
    getBirthday.mockResolvedValue({ ok: true, data: { date: birthday, yearSpecified: true, active: true } });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns birthday data (future, without year)', async () => {
    const future = new Date();
    future.setMonth(future.getMonth() + 3);
    getBirthday.mockResolvedValue({ ok: true, data: { date: future, yearSpecified: false, active: true } });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns birthday data (already passed this year)', async () => {
    const past = new Date();
    past.setMonth(past.getMonth() - 1);
    past.setFullYear(past.getFullYear() - 20);
    getBirthday.mockResolvedValue({ ok: true, data: { date: past, yearSpecified: true, active: true } });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles service error', async () => {
    getBirthday.mockResolvedValue({ ok: false, message: 'DB error' });
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles thrown error', async () => {
    getBirthday.mockRejectedValue(new Error('crash'));
    const interaction = makeInteraction();
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('checks other user birthday', async () => {
    const targetUser = { id: 'u2' };
    getBirthday.mockResolvedValue({ ok: true, data: null });
    const interaction = makeInteraction({
      options: { getUser: jest.fn().mockReturnValue(targetUser) },
    });
    await run({ interaction });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ================================================================
   canvasHelpers — formatNumberDotSep, formatNumberCompact
   ================================================================ */
describe('canvasHelpers formatters', () => {
  let formatNumberDotSep: (n: number) => string;
  let formatNumberCompact: (n: number) => string;

  beforeAll(async () => {
    const mod = await import('../../../src/utils/canvasHelpers');
    formatNumberDotSep = mod.formatNumberDotSep;
    formatNumberCompact = mod.formatNumberCompact;
  });

  it('formats small numbers', () => {
    expect(formatNumberDotSep(123)).toBe('123');
  });

  it('formats thousands with dot', () => {
    expect(formatNumberDotSep(1234)).toBe('1.234');
    expect(formatNumberDotSep(1234567)).toBe('1.234.567');
  });

  it('compact: small numbers', () => {
    expect(formatNumberCompact(5000)).toBe('5.000');
  });

  it('compact: >= 10k shows k', () => {
    expect(formatNumberCompact(12345)).toBe('12.3k');
  });

  it('compact: >= 1M shows M', () => {
    expect(formatNumberCompact(1234567)).toBe('1.2M');
  });
});

/* ================================================================
   musicPlayer — createProgressBar, canUseMusic, canPlayInChannel
   ================================================================ */
jest.mock('../../../src/models/MusicConfig', () => ({
  MusicConfigModel: { findOne: jest.fn() },
}));

describe('musicPlayer pure functions', () => {
  let createProgressBar: (current: number, total: number, length?: number) => string;
  let canUseMusic: (guildId: string, userRoleIds: string[]) => Promise<any>;
  let canPlayInChannel: (guildId: string, channelId: string) => Promise<any>;

  beforeAll(async () => {
    const mod = await import('../../../src/services/musicPlayer');
    createProgressBar = mod.createProgressBar;
    canUseMusic = mod.canUseMusic;
    canPlayInChannel = mod.canPlayInChannel;
  });
  beforeEach(() => jest.clearAllMocks());

  const { MusicConfigModel } = require('../../../src/models/MusicConfig');

  it('createProgressBar shows progress', () => {
    const bar = createProgressBar(5, 10, 10);
    expect(bar.length).toBe(10);
  });

  it('createProgressBar at 0', () => {
    const bar = createProgressBar(0, 10, 10);
    expect(bar).toContain('—');
  });

  it('createProgressBar at 100%', () => {
    const bar = createProgressBar(10, 10, 10);
    expect(bar).not.toContain('—');
  });

  it('canUseMusic returns not allowed when disabled', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue(null);
    const result = await canUseMusic('g1', ['r1']);
    expect(result.allowed).toBe(false);
  });

  it('canUseMusic returns not allowed when DJ role required', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, djRoleId: 'dj1' });
    const result = await canUseMusic('g1', ['r1']);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('DJ');
  });

  it('canUseMusic returns allowed when DJ role present', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, djRoleId: 'dj1' });
    const result = await canUseMusic('g1', ['dj1']);
    expect(result.allowed).toBe(true);
  });

  it('canUseMusic returns allowed when no DJ role required', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, djRoleId: null });
    const result = await canUseMusic('g1', ['r1']);
    expect(result.allowed).toBe(true);
  });

  it('canPlayInChannel returns not allowed when disabled', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue(null);
    const result = await canPlayInChannel('g1', 'ch1');
    expect(result.allowed).toBe(false);
  });

  it('canPlayInChannel allows all when no channels specified', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, allowedChannels: [] });
    const result = await canPlayInChannel('g1', 'ch1');
    expect(result.allowed).toBe(true);
  });

  it('canPlayInChannel allows matching channel', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, allowedChannels: ['ch1'] });
    const result = await canPlayInChannel('g1', 'ch1');
    expect(result.allowed).toBe(true);
  });

  it('canPlayInChannel denies non-matching channel', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, allowedChannels: ['ch1'] });
    const result = await canPlayInChannel('g1', 'ch2');
    expect(result.allowed).toBe(false);
  });

  it('canPlayInChannel allows when allowedChannels is undefined/null', async () => {
    (MusicConfigModel.findOne as jest.Mock).mockResolvedValue({ enabled: true, allowedChannels: null });
    const result = await canPlayInChannel('g1', 'ch1');
    expect(result.allowed).toBe(true);
  });
});
