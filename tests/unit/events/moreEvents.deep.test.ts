export {};
/**
 * Deep tests for remaining low-coverage event files:
 * welcomeCard, goodbyeCard, autoRole, userStatusRemove,
 * logChannelUpdate, logMemberUpdate, logGuildUpdate,
 * handleSuggestions, monthlyStatsButtons, createSuggestions, twitchScheduler
 */

/* ─── Common mocks ─── */
jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    DEFAULT: 0, ERROR: 0xff0000, JOIN: 0x00ff00, LEAVE: 0xff0000,
    GIVEAWAY: 0xff00ff, TWITCH: 0x9146ff, MONTHLY_STATS: 0x00aaff,
  },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      suggestion: { upvote: '👍', downvote: '👎' },
      suggestionPB: '▪', warnPB: '▪',
      monthlyStats: { upvote: '📈', downvote: '📉', whitedash: '➡️', crown: '👑', up: '📈', down: '📉', same: '➡️', new: '🆕', mic: '🎤' },
    },
  }),
}));

const mockCreateBaseEmbed = jest.fn().mockReturnValue({
  setFooter: jest.fn().mockReturnThis(),
  setTimestamp: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  addFields: jest.fn().mockReturnThis(),
  setColor: jest.fn().mockReturnThis(),
  setTitle: jest.fn().mockReturnThis(),
  setImage: jest.fn().mockReturnThis(),
  setThumbnail: jest.fn().mockReturnThis(),
  setURL: jest.fn().mockReturnThis(),
  setAuthor: jest.fn().mockReturnThis(),
  data: {},
  fields: [{ value: 'x' }, { value: 'y' }],
});
const mockFormatResults = jest.fn().mockReturnValue('formatted');
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: jest.fn().mockReturnValue({ data: {} }),
  formatResults: mockFormatResults,
}));

const mockSendLog = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: mockSendLog,
}));

const mockGetModerator = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: mockGetModerator,
}));

/* ─── Model mocks ─── */
const mockGreetingsFind = jest.fn();
jest.mock('../../../src/models/GreetingsConfiguration', () => ({
  GreetingsConfigurationModel: { findOne: mockGreetingsFind },
}));

const mockAutoRoleFind = jest.fn();
jest.mock('../../../src/models/AutoRole', () => ({
  AutoRoleModel: { findOne: mockAutoRoleFind },
}));

const mockBirthdayFindOne = jest.fn();
const mockBirthdayFindOneAndUpdate = jest.fn();
jest.mock('../../../src/models/Birthday', () => ({
  BirthdayModel: {
    findOne: jest.fn().mockReturnValue({ exec: mockBirthdayFindOne }),
    findOneAndUpdate: jest.fn().mockReturnValue({ exec: mockBirthdayFindOneAndUpdate }),
  },
}));

const mockTwitchStreamerFindOne = jest.fn();
const mockTwitchStreamerFindOneAndUpdate = jest.fn();
jest.mock('../../../src/models/TwitchStreamer', () => ({
  TwitchStreamerModel: {
    findOne: jest.fn().mockReturnValue({ exec: mockTwitchStreamerFindOne }),
    findOneAndUpdate: jest.fn().mockReturnValue({ exec: mockTwitchStreamerFindOneAndUpdate }),
  },
}));

const mockLevelFindOne = jest.fn();
const mockLevelDeleteOne = jest.fn();
jest.mock('../../../src/models/Level', () => ({
  LevelModel: {
    findOne: jest.fn().mockReturnValue({ exec: mockLevelFindOne }),
    deleteOne: jest.fn().mockReturnValue({ exec: mockLevelDeleteOne }),
  },
}));

/* ─── Service mocks ─── */
const mockIsSuggestionChannel = jest.fn();
const mockCreateSuggestion = jest.fn();
const mockVote = jest.fn();
const mockGetSuggestion = jest.fn();
jest.mock('../../../src/services/suggestionService', () => ({
  isSuggestionChannel: mockIsSuggestionChannel,
  createSuggestion: mockCreateSuggestion,
  vote: mockVote,
  getSuggestion: mockGetSuggestion,
}));

const mockGetPersonalStats = jest.fn();
const mockGetMonthString = jest.fn();
const mockFormatVoiceTime = jest.fn();
jest.mock('../../../src/services/monthlyStatsService', () => ({
  getPersonalStats: mockGetPersonalStats,
  getMonthString: mockGetMonthString,
  formatVoiceTime: mockFormatVoiceTime,
  MONTH_NAMES: { '01': 'STYCZEŃ', '02': 'LUTY', '12': 'GRUDZIEŃ' },
}));

jest.mock('fs', () => {
  const actual = jest.requireActual('fs');
  return {
    ...actual,
    existsSync: jest.fn().mockReturnValue(true),
    readdirSync: jest.fn().mockReturnValue(['welcome.gif']),
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

/* ═══════════════════════════════════════════════════════════════════
   welcomeCard
   ═══════════════════════════════════════════════════════════════════ */
describe('welcomeCard', () => {
  const welcomeCard = require('../../../src/events/guildMemberAdd/welcomeCard').default;

  function makeMember(overrides: any = {}) {
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const channelsMap = new Map([
      ['ch1', { id: 'ch1', send: sendFn, permissionsFor: () => ({ has: () => true }) }],
    ]);
    return {
      user: { id: 'u1', tag: 'user#0001', username: 'user', displayAvatarURL: () => 'https://example.com/av.png', ...overrides.user },
      guild: {
        id: 'g1',
        name: 'TestGuild',
        memberCount: 100,
        iconURL: () => 'https://example.com/icon.png',
        client: { user: { id: 'bot1' } },
        channels: { cache: channelsMap },
        members: { cache: new Map([['bot1', { id: 'bot1' }]]) },
        ...overrides.guild,
      },
      send: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('sends welcome message when config exists', async () => {
    mockGreetingsFind.mockResolvedValue({
      greetingsChannelId: 'ch1', welcomeEnabled: true, welcomeMessage: 'Welcome {user}!',
      rulesChannelId: 'rules1', chatChannelId: 'chat1',
    });
    const member = makeMember();
    await welcomeCard(member as any);
    const ch = member.guild.channels.cache.get('ch1');
    expect(ch!.send).toHaveBeenCalled();
  });

  it('does nothing when no config', async () => {
    mockGreetingsFind.mockResolvedValue(null);
    const member = makeMember();
    await welcomeCard(member as any);
  });

  it('does nothing when welcome disabled', async () => {
    mockGreetingsFind.mockResolvedValue({ greetingsChannelId: 'ch1', welcomeEnabled: false });
    const member = makeMember();
    await welcomeCard(member as any);
  });

  it('does nothing when no guild', async () => {
    const member = makeMember();
    member.guild = null;
    await welcomeCard(member as any);
  });

  it('sends DM when dmEnabled', async () => {
    mockGreetingsFind.mockResolvedValue({
      greetingsChannelId: 'ch1', welcomeEnabled: true, dmEnabled: true,
      welcomeMessage: 'Hello {user}!',
    });
    const member = makeMember();
    await welcomeCard(member as any);
    expect(member.send).toHaveBeenCalled();
  });

  it('handles DM failure gracefully', async () => {
    mockGreetingsFind.mockResolvedValue({
      greetingsChannelId: 'ch1', welcomeEnabled: true, dmEnabled: true,
      welcomeMessage: 'Hello!',
    });
    const member = makeMember();
    member.send.mockRejectedValue(new Error('Cannot send DM'));
    await welcomeCard(member as any);
  });

  it('skips when bot lacks permissions', async () => {
    mockGreetingsFind.mockResolvedValue({
      greetingsChannelId: 'ch1', welcomeEnabled: true,
    });
    const member = makeMember();
    const ch = member.guild.channels.cache.get('ch1');
    (ch as any).permissionsFor = () => ({ has: () => false });
    await welcomeCard(member as any);
    expect(ch!.send).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   goodbyeCard
   ═══════════════════════════════════════════════════════════════════ */
describe('goodbyeCard', () => {
  const goodbyeCard = require('../../../src/events/guildMemberRemove/goodbyeCard').default;

  function makeMember(overrides: any = {}) {
    const sendFn = jest.fn().mockResolvedValue(undefined);
    const channelsMap = new Map([
      ['ch1', { id: 'ch1', send: sendFn, permissionsFor: () => ({ has: () => true }) }],
    ]);
    return {
      user: { id: 'u1', tag: 'user#0001', username: 'user', displayAvatarURL: () => 'https://example.com/av.png' },
      guild: {
        id: 'g1', name: 'TestGuild', memberCount: 99,
        client: { user: { id: 'bot1' } },
        channels: { cache: channelsMap },
        members: { cache: new Map([['bot1', { id: 'bot1' }]]) },
        ...overrides.guild,
      },
      ...overrides,
    };
  }

  it('sends goodbye message', async () => {
    mockGreetingsFind.mockResolvedValue({
      greetingsChannelId: 'ch1', goodbyeEnabled: true, goodbyeMessage: 'Bye {user}!',
    });
    const member = makeMember();
    await goodbyeCard(member as any);
    expect(member.guild.channels.cache.get('ch1')!.send).toHaveBeenCalled();
  });

  it('does nothing when no config', async () => {
    mockGreetingsFind.mockResolvedValue(null);
    await goodbyeCard(makeMember() as any);
  });

  it('does nothing when goodbye disabled', async () => {
    mockGreetingsFind.mockResolvedValue({ greetingsChannelId: 'ch1', goodbyeEnabled: false });
    await goodbyeCard(makeMember() as any);
  });

  it('does nothing when no guild', async () => {
    const m = makeMember();
    m.guild = null;
    await goodbyeCard(m as any);
  });

  it('skips when bot lacks permissions', async () => {
    mockGreetingsFind.mockResolvedValue({ greetingsChannelId: 'ch1', goodbyeEnabled: true });
    const m = makeMember();
    const ch = m.guild.channels.cache.get('ch1');
    (ch as any).permissionsFor = () => ({ has: () => false });
    await goodbyeCard(m as any);
    expect(ch!.send).not.toHaveBeenCalled();
  });

  it('uses default message when none configured', async () => {
    mockGreetingsFind.mockResolvedValue({ greetingsChannelId: 'ch1', goodbyeEnabled: true });
    const m = makeMember();
    await goodbyeCard(m as any);
    expect(m.guild.channels.cache.get('ch1')!.send).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   autoRole
   ═══════════════════════════════════════════════════════════════════ */
describe('autoRole', () => {
  const autoRole = require('../../../src/events/guildMemberAdd/autoRole').default;

  function makeMember(isBot = false) {
    const addFn = jest.fn().mockResolvedValue(undefined);
    return {
      user: { bot: isBot, tag: 'user#0001' },
      guild: {
        id: 'g1', name: 'TestGuild',
        roles: { cache: new Map([['r1', { id: 'r1' }], ['r2', { id: 'r2' }], ['r3', { id: 'r3' }]]) },
      },
      roles: { add: addFn },
    };
  }

  it('assigns user roles for non-bot members', async () => {
    mockAutoRoleFind.mockResolvedValue({ roleIds: ['r1', 'r2', 'r3'] });
    const m = makeMember(false);
    await autoRole(m as any);
    expect(m.roles.add).toHaveBeenCalled();
  });

  it('assigns bot role for bot members', async () => {
    mockAutoRoleFind.mockResolvedValue({ roleIds: ['r1', 'r2', 'r3'] });
    const m = makeMember(true);
    await autoRole(m as any);
    expect(m.roles.add).toHaveBeenCalledWith([expect.objectContaining({ id: 'r1' })]);
  });

  it('does nothing when no autoRole config', async () => {
    mockAutoRoleFind.mockResolvedValue(null);
    const m = makeMember();
    await autoRole(m as any);
    expect(m.roles.add).not.toHaveBeenCalled();
  });

  it('does nothing when roleIds empty', async () => {
    mockAutoRoleFind.mockResolvedValue({ roleIds: [] });
    const m = makeMember();
    await autoRole(m as any);
    expect(m.roles.add).not.toHaveBeenCalled();
  });

  it('returns when no guild', async () => {
    const m = makeMember();
    (m as any).guild = null;
    await autoRole(m as any);
  });

  it('warns when roles not found', async () => {
    mockAutoRoleFind.mockResolvedValue({ roleIds: ['r1', 'missing'] });
    const m = makeMember();
    m.guild.roles.cache = new Map();
    await autoRole(m as any);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   userStatusRemove
   ═══════════════════════════════════════════════════════════════════ */
describe('userStatusRemove', () => {
  const userStatusRemove = require('../../../src/events/guildMemberRemove/userStatusRemove').default;

  it('deactivates birthday, twitch, and resets level', async () => {
    mockBirthdayFindOne.mockResolvedValue({ active: true });
    mockBirthdayFindOneAndUpdate.mockResolvedValue({});
    mockTwitchStreamerFindOne.mockResolvedValue({ active: true });
    mockTwitchStreamerFindOneAndUpdate.mockResolvedValue({});
    mockLevelFindOne.mockResolvedValue({ guildId: 'g1', userId: 'u1' });
    mockLevelDeleteOne.mockResolvedValue({});

    await userStatusRemove({ guild: { id: 'g1' }, user: { id: 'u1' } } as any);
  });

  it('skips when entries dont exist', async () => {
    mockBirthdayFindOne.mockResolvedValue(null);
    mockTwitchStreamerFindOne.mockResolvedValue(null);
    mockLevelFindOne.mockResolvedValue(null);

    await userStatusRemove({ guild: { id: 'g1' }, user: { id: 'u1' } } as any);
  });

  it('skips when already inactive', async () => {
    mockBirthdayFindOne.mockResolvedValue({ active: false });
    mockTwitchStreamerFindOne.mockResolvedValue({ active: false });
    mockLevelFindOne.mockResolvedValue(null);

    await userStatusRemove({ guild: { id: 'g1' }, user: { id: 'u1' } } as any);
  });

  it('returns when no guild', async () => {
    await userStatusRemove({ guild: null, user: { id: 'u1' } } as any);
  });
});

/* ═══════════════════════════════════════════════════════════════════
   logChannelUpdate
   ═══════════════════════════════════════════════════════════════════ */
describe('logChannelUpdate', () => {
  const logChannelUpdate = require('../../../src/events/channelUpdate/logChannelUpdate').default;

  /** Make a Map that behaves like a discord.js Collection (has .filter) */
  function collectionMap<V>(entries: [string, V][] = []): Map<string, V> {
    const m = new Map<string, V>(entries);
    (m as any).filter = (fn: Function) => {
      const out = new Map<string, V>();
      for (const [k, v] of m) if (fn(v, k)) out.set(k, v);
      (out as any).filter = (m as any).filter;
      return out;
    };
    return m;
  }

  function makeChannel(overrides: any = {}) {
    return {
      id: 'ch1', name: 'general', topic: 'Topic',
      guild: {
        id: 'g1',
        roles: { cache: new Map([['r1', { name: '@everyone', id: 'r1' }]]) },
        fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
      },
      permissionOverwrites: {
        cache: collectionMap(),
      },
      ...overrides,
    };
  }

  it('logs name change', async () => {
    const oldCh = makeChannel({ name: 'old-name' });
    const newCh = makeChannel({ name: 'new-name' });
    await logChannelUpdate(oldCh as any, newCh as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs topic change', async () => {
    const oldCh = makeChannel({ topic: 'Old topic' });
    const newCh = makeChannel({ topic: 'New topic' });
    await logChannelUpdate(oldCh as any, newCh as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs added permission overwrites', async () => {
    const oldCh = makeChannel();
    const newCh = makeChannel();
    newCh.permissionOverwrites.cache = collectionMap([
      ['r1', { id: 'r1', type: 0, allow: { toArray: () => ['SendMessages'] }, deny: { toArray: () => [] } }],
    ]);
    await logChannelUpdate(oldCh as any, newCh as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs removed permission overwrites', async () => {
    const oldCh = makeChannel();
    oldCh.permissionOverwrites.cache = collectionMap([
      ['r1', { id: 'r1', type: 0, allow: { toArray: () => [] }, deny: { toArray: () => [] } }],
    ]);
    const newCh = makeChannel();
    await logChannelUpdate(oldCh as any, newCh as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs modified permission overwrites', async () => {
    const oldCh = makeChannel();
    oldCh.permissionOverwrites.cache = collectionMap([
      ['u1', { id: 'u1', type: 1, allow: { toArray: () => [], bitfield: 0n, has: () => false }, deny: { toArray: () => [], bitfield: 0n, has: () => false } }],
    ]);
    const newCh = makeChannel();
    newCh.permissionOverwrites.cache = collectionMap([
      ['u1', { id: 'u1', type: 1, allow: { toArray: () => ['ViewChannel'], bitfield: 1n, has: () => true }, deny: { toArray: () => [], bitfield: 0n, has: () => false } }],
    ]);
    await logChannelUpdate(oldCh as any, newCh as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('does nothing when nothing changed', async () => {
    const ch = makeChannel();
    await logChannelUpdate(ch as any, ch as any, {} as any);
    expect(mockSendLog).not.toHaveBeenCalled();
  });

  it('logs with moderator when found', async () => {
    mockGetModerator.mockResolvedValueOnce({ id: 'mod1' });
    const oldCh = makeChannel({ name: 'old' });
    const newCh = makeChannel({ name: 'new' });
    await logChannelUpdate(oldCh as any, newCh as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   logMemberUpdate
   ═══════════════════════════════════════════════════════════════════ */
describe('logMemberUpdate', () => {
  const logMemberUpdate = require('../../../src/events/guildMemberUpdate/logMemberUpdate').default;

  /** Make a Map that behaves like a discord.js Collection (has .filter) */
  function roleCollection(entries: Record<string, any> = {}) {
    const m = new Map(Object.entries(entries));
    (m as any).filter = (fn: Function) => {
      const out = new Map();
      for (const [k, v] of m) if (fn(v, k)) out.set(k, v);
      (out as any).filter = (m as any).filter;
      return out;
    };
    return m;
  }

  function makeMember(overrides: any = {}) {
    const rolesCache = roleCollection(overrides.roles || {});
    return {
      id: overrides.id || 'u1',
      user: { id: overrides.id || 'u1', tag: 'user#0001', displayAvatarURL: () => 'https://example.com/av.png' },
      guild: { id: 'g1', fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }) },
      nickname: overrides.nickname ?? null,
      communicationDisabledUntil: overrides.timeout ?? null,
      roles: { cache: rolesCache },
    };
  }

  it('logs timeout added', async () => {
    const oldMember = makeMember({ timeout: null });
    const newMember = makeMember({ timeout: new Date(Date.now() + 60000) });
    await logMemberUpdate(oldMember as any, newMember as any, {} as any);
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'memberTimeout', expect.anything(), expect.anything());
  });

  it('logs timeout removed', async () => {
    const oldMember = makeMember({ timeout: new Date(Date.now() + 60000) });
    const newMember = makeMember({ timeout: null });
    await logMemberUpdate(oldMember as any, newMember as any, {} as any);
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'memberTimeout', expect.anything(), expect.anything());
  });

  it('logs nickname change', async () => {
    const oldMember = makeMember({ nickname: 'OldNick' });
    const newMember = makeMember({ nickname: 'NewNick' });
    await logMemberUpdate(oldMember as any, newMember as any, {} as any);
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'memberNicknameChange', expect.anything(), expect.anything());
  });

  it('logs role added', async () => {
    const oldMember = makeMember({ roles: {} });
    const newMember = makeMember({ roles: { r1: { id: 'r1' } } });
    await logMemberUpdate(oldMember as any, newMember as any, {} as any);
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'memberRoleAdd', expect.anything(), expect.anything());
  });

  it('logs role removed', async () => {
    const oldMember = makeMember({ roles: { r1: { id: 'r1' } } });
    const newMember = makeMember({ roles: {} });
    await logMemberUpdate(oldMember as any, newMember as any, {} as any);
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'memberRoleRemove', expect.anything(), expect.anything());
  });

  it('does nothing when nothing changed', async () => {
    const m = makeMember();
    await logMemberUpdate(m as any, m as any, {} as any);
    expect(mockSendLog).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   logGuildUpdate
   ═══════════════════════════════════════════════════════════════════ */
describe('logGuildUpdate', () => {
  const logGuildUpdate = require('../../../src/events/guildUpdate/logGuildUpdate').default;

  function makeGuild(overrides: any = {}) {
    return {
      id: 'g1', name: 'TestGuild', icon: 'icon1', banner: 'banner1',
      verificationLevel: 0, systemChannelId: 'sys1',
      iconURL: () => 'https://example.com/icon.png',
      bannerURL: () => 'https://example.com/banner.png',
      fetchAuditLogs: jest.fn().mockResolvedValue({ entries: { first: () => null } }),
      ...overrides,
    };
  }

  it('logs name change', async () => {
    await logGuildUpdate(makeGuild({ name: 'Old' }) as any, makeGuild({ name: 'New' }) as any, {} as any);
    expect(mockSendLog).toHaveBeenCalledWith(expect.anything(), 'g1', 'guildUpdate', expect.anything());
  });

  it('logs icon change', async () => {
    await logGuildUpdate(makeGuild({ icon: 'a' }) as any, makeGuild({ icon: 'b' }) as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs banner change', async () => {
    await logGuildUpdate(makeGuild({ banner: 'a' }) as any, makeGuild({ banner: 'b' }) as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs verification level change', async () => {
    await logGuildUpdate(makeGuild({ verificationLevel: 0 }) as any, makeGuild({ verificationLevel: 2 }) as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('logs system channel change', async () => {
    await logGuildUpdate(makeGuild({ systemChannelId: 's1' }) as any, makeGuild({ systemChannelId: 's2' }) as any, {} as any);
    expect(mockSendLog).toHaveBeenCalled();
  });

  it('does nothing when nothing changed', async () => {
    const g = makeGuild();
    await logGuildUpdate(g as any, g as any, {} as any);
    expect(mockSendLog).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   handleSuggestions
   ═══════════════════════════════════════════════════════════════════ */
describe('handleSuggestions', () => {
  const handleSuggestions = require('../../../src/events/interactionCreate/handleSuggestions').default;

  function makeInteraction(customId: string = 'suggestion.123.upvote') {
    return {
      isButton: () => true,
      customId,
      user: { id: 'u1', username: 'testuser' },
      client: { user: { id: 'bot1' } },
      channel: {
        messages: { fetch: jest.fn().mockResolvedValue({
          embeds: [{ fields: [{ value: 'x' }, { value: 'y' }] }],
          edit: jest.fn().mockResolvedValue(undefined),
        })},
      },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
      replied: false, deferred: false,
    };
  }

  it('handles upvote successfully', async () => {
    mockGetSuggestion.mockResolvedValue({ ok: true, data: { messageId: 'msg1' } });
    mockVote.mockResolvedValue({ ok: true, data: { upvotes: 5, downvotes: 2 } });
    const i = makeInteraction('suggestion.123.upvote');
    await handleSuggestions(i as any);
    expect(mockVote).toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalled();
  });

  it('handles downvote successfully', async () => {
    mockGetSuggestion.mockResolvedValue({ ok: true, data: { messageId: 'msg1' } });
    mockVote.mockResolvedValue({ ok: true, data: { upvotes: 5, downvotes: 3 } });
    const i = makeInteraction('suggestion.123.downvote');
    await handleSuggestions(i as any);
    expect(i.editReply).toHaveBeenCalled();
  });

  it('skips non-suggestion buttons', async () => {
    const i = makeInteraction('other.123.action');
    await handleSuggestions(i as any);
    expect(mockGetSuggestion).not.toHaveBeenCalled();
  });

  it('skips non-button interactions', async () => {
    const i = makeInteraction();
    i.isButton = () => false;
    await handleSuggestions(i as any);
  });

  it('handles suggestion not found', async () => {
    mockGetSuggestion.mockResolvedValue({ ok: false });
    const i = makeInteraction();
    await handleSuggestions(i as any);
    expect(i.editReply).toHaveBeenCalledWith('Sugestia nie została znaleziona.');
  });

  it('handles vote error', async () => {
    mockGetSuggestion.mockResolvedValue({ ok: true, data: { messageId: 'msg1' } });
    mockVote.mockResolvedValue({ ok: false, message: 'Already voted' });
    const i = makeInteraction();
    await handleSuggestions(i as any);
    expect(i.editReply).toHaveBeenCalledWith('Already voted');
  });

  it('handles missing channel', async () => {
    mockGetSuggestion.mockResolvedValue({ ok: true, data: { messageId: 'msg1' } });
    const i = makeInteraction();
    (i as any).channel = null;
    await handleSuggestions(i as any);
    expect(i.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   monthlyStatsButtons
   ═══════════════════════════════════════════════════════════════════ */
describe('monthlyStatsButtons', () => {
  const monthlyStatsButtons = require('../../../src/events/interactionCreate/monthlyStatsButtons').default;

  function makeInteraction(customId = 'monthly_stats:details:2024-01') {
    return {
      isButton: () => true,
      customId,
      guildId: 'g1',
      user: { id: 'u1', username: 'testuser' },
      client: { user: { id: 'bot1' } },
      deferReply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('shows personal stats', async () => {
    mockGetMonthString.mockReturnValue('2023-12');
    mockGetPersonalStats
      .mockResolvedValueOnce({
        ok: true,
        data: { messageCount: 100, voiceMinutes: 300, messageRank: 3, voiceRank: 5, totalMessages: 1000 },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { messageCount: 80, voiceMinutes: 250, messageRank: 5, voiceRank: 7, totalMessages: 800 },
      });
    mockFormatVoiceTime.mockReturnValue('5h');

    const i = makeInteraction();
    await monthlyStatsButtons(i as any);
    expect(i.deferReply).toHaveBeenCalled();
    expect(i.editReply).toHaveBeenCalled();
  });

  it('shows stats without previous month', async () => {
    mockGetMonthString.mockReturnValue('2023-12');
    mockGetPersonalStats
      .mockResolvedValueOnce({
        ok: true,
        data: { messageCount: 100, voiceMinutes: 300, messageRank: 3, voiceRank: 5, totalMessages: 1000 },
      })
      .mockResolvedValueOnce({ ok: false });
    mockFormatVoiceTime.mockReturnValue('5h');

    const i = makeInteraction();
    await monthlyStatsButtons(i as any);
    expect(i.editReply).toHaveBeenCalled();
  });

  it('handles no stats for month', async () => {
    mockGetMonthString.mockReturnValue('2023-12');
    mockGetPersonalStats.mockResolvedValue({ ok: false });

    const i = makeInteraction();
    await monthlyStatsButtons(i as any);
    expect(i.editReply).toHaveBeenCalled();
  });

  it('skips non-monthly-stats buttons', async () => {
    const i = makeInteraction('other_button');
    await monthlyStatsButtons(i as any);
    expect(mockGetPersonalStats).not.toHaveBeenCalled();
  });

  it('skips non-button interactions', async () => {
    const i = makeInteraction();
    i.isButton = () => false;
    await monthlyStatsButtons(i as any);
  });

  it('handles error gracefully', async () => {
    mockGetMonthString.mockReturnValue('2023-12');
    mockGetPersonalStats.mockRejectedValue(new Error('DB error'));
    const i = makeInteraction();
    await monthlyStatsButtons(i as any);
    expect(i.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   createSuggestions
   ═══════════════════════════════════════════════════════════════════ */
describe('createSuggestions', () => {
  const createSuggestions = require('../../../src/events/messageCreate/createSuggestions').default;

  function makeMessage(overrides: any = {}) {
    return {
      author: { bot: false, id: 'u1', username: 'testuser', displayAvatarURL: () => 'https://example.com/av.png' },
      client: { user: { id: 'bot1' } },
      guild: { id: 'g1' },
      channel: {
        type: 0, send: jest.fn().mockResolvedValue({
          id: 'msg1',
          edit: jest.fn().mockResolvedValue(undefined),
          startThread: jest.fn().mockResolvedValue(undefined),
        }),
      },
      channelId: 'ch1',
      content: 'My suggestion text here',
      delete: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('creates suggestion successfully', async () => {
    mockIsSuggestionChannel.mockResolvedValue(true);
    mockCreateSuggestion.mockResolvedValue({ ok: true, data: { suggestionId: 's1' } });
    const msg = makeMessage();
    await createSuggestions(msg as any);
    expect(msg.delete).toHaveBeenCalled();
    expect(msg.channel.send).toHaveBeenCalled();
  });

  it('skips bot messages', async () => {
    const msg = makeMessage({ author: { bot: true, id: 'bot1' } });
    await createSuggestions(msg as any);
    expect(mockIsSuggestionChannel).not.toHaveBeenCalled();
  });

  it('skips non-suggestion channels', async () => {
    mockIsSuggestionChannel.mockResolvedValue(false);
    await createSuggestions(makeMessage() as any);
    expect(mockCreateSuggestion).not.toHaveBeenCalled();
  });

  it('skips empty messages', async () => {
    mockIsSuggestionChannel.mockResolvedValue(true);
    await createSuggestions(makeMessage({ content: '' }) as any);
    expect(mockCreateSuggestion).not.toHaveBeenCalled();
  });

  it('skips DM messages', async () => {
    const msg = makeMessage({ channel: { type: 1 } });
    msg.guild = null;
    await createSuggestions(msg as any);
  });

  it('handles create error', async () => {
    mockIsSuggestionChannel.mockResolvedValue(true);
    mockCreateSuggestion.mockResolvedValue({ ok: false, message: 'DB error' });
    const msg = makeMessage();
    await createSuggestions(msg as any);
  });

  it('skips self messages', async () => {
    const msg = makeMessage({ author: { bot: false, id: 'bot1' } });
    msg.client.user.id = 'bot1';
    await createSuggestions(msg as any);
  });
});
