/**
 * Tests for guild-related events:
 * - guildBanAdd/logBan, guildBanRemove/logUnban
 * - guildCreate/initializeGuildConfigs
 * - guildMemberAdd/autoRole, logMemberJoin, userStatusAdd, welcomeCard
 * - guildMemberRemove/goodbyeCard, logMemberRemove, userStatusRemove
 * - guildMemberUpdate/boostDetection, logMemberUpdate
 * - guildUpdate/logGuildUpdate
 */

/* ── mocks ───────────────────────────────────────────────── */

jest.mock('../../../src/utils/logHelpers', () => ({
  sendLog: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/utils/auditLogHelpers', () => ({
  getModerator: jest.fn().mockResolvedValue(null),
  getAuditLogEntry: jest.fn().mockResolvedValue(null),
  getReason: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/models/AutoRole', () => ({
  AutoRoleModel: { findOne: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../../../src/models/Birthday', () => ({
  BirthdayModel: { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }), findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) },
}));
jest.mock('../../../src/models/TwitchStreamer', () => ({
  TwitchStreamerModel: { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }), findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) },
}));
jest.mock('../../../src/models/Level', () => ({
  LevelModel: { findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }), deleteOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) },
}));
jest.mock('../../../src/models/GreetingsConfiguration', () => ({
  GreetingsConfigurationModel: {
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
  },
}));

// Mock all models used by initializeGuildConfigs
const mockFindOneAndUpdate = jest.fn().mockResolvedValue(null);
jest.mock('../../../src/models/BirthdayConfiguration', () => ({ BirthdayConfigurationModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/LevelConfig', () => ({ LevelConfigModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/MonthlyStatsConfig', () => ({ MonthlyStatsConfigModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/QuestionConfiguration', () => ({ QuestionConfigurationModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/SuggestionConfiguration', () => ({ SuggestionConfigurationModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/TicketConfig', () => ({ TicketConfigModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/StreamConfiguration', () => ({ StreamConfigurationModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/ReactionRole', () => ({ ReactionRoleModel: { findOneAndUpdate: mockFindOneAndUpdate, findOne: jest.fn().mockResolvedValue(null) } }));
jest.mock('../../../src/models/LogConfiguration', () => ({ LogConfigurationModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/TournamentConfig', () => ({ TournamentConfigModel: { findOneAndUpdate: mockFindOneAndUpdate } }));
jest.mock('../../../src/models/GiveawayConfig', () => ({ GiveawayConfigModel: { findOneAndUpdate: mockFindOneAndUpdate } }));

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    channels: { boostNotification: 'ch-boost', boosterList: 'ch-list' },
    roles: { owner: 'r1', admin: 'r2', mod: 'r3', partnership: 'r4' },
  }),
}));
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: { boost: { thanks: '🙏', list: '💎' } },
  }),
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setTimestamp: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { JOIN: 0x00ff00, LEAVE: 0xff0000 },
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn().mockReturnValue(false),
  readdirSync: jest.fn().mockReturnValue([]),
}));

import { sendLog } from '../../../src/utils/logHelpers';
import { getModerator, getAuditLogEntry } from '../../../src/utils/auditLogHelpers';
import { mockClient, mockGuild, mockGuildMember, mockUser, mockTextChannel } from '../../helpers/discordMocks';
import { Collection } from 'discord.js';

/* ── guildBanAdd / logBan ─────────────────────────────────── */

describe('guildBanAdd / logBan', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildBanAdd/logBan')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with memberBan', async () => {
    const client = mockClient();
    const user = mockUser();
    const guild = mockGuild();
    const ban = { guild, user };
    await run(ban, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'memberBan', expect.any(Object));
  });

  it('includes moderator in description when available', async () => {
    const mod = mockUser({ id: 'mod-1' });
    (getModerator as jest.Mock).mockResolvedValueOnce(mod);
    const client = mockClient();
    const user = mockUser();
    const guild = mockGuild();
    await run({ guild, user }, client);
    const callArgs = (sendLog as jest.Mock).mock.calls[0][3];
    expect(callArgs.description).toContain(mod.id);
  });
});

/* ── guildBanRemove / logUnban ────────────────────────────── */

describe('guildBanRemove / logUnban', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildBanRemove/logUnban')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with memberUnban', async () => {
    const client = mockClient();
    const user = mockUser();
    const guild = mockGuild();
    await run({ guild, user }, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'memberUnban', expect.any(Object));
  });
});

/* ── guildCreate / initializeGuildConfigs ─────────────────── */

describe('guildCreate / initializeGuildConfigs', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildCreate/initializeGuildConfigs')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls findOneAndUpdate for each model', async () => {
    const client = mockClient();
    const guild = mockGuild();
    mockFindOneAndUpdate.mockClear();
    await run(client, guild);
    // 13 models are initialized (Birthday, Greetings, Level, MonthlyStats, Question, Suggestion, Ticket, Stream, ReactionRole, Log, Tournament, Giveaway, AutoRole)
    expect(mockFindOneAndUpdate).toHaveBeenCalled();
    expect(mockFindOneAndUpdate.mock.calls.length).toBeGreaterThanOrEqual(10);
  });
});

/* ── guildMemberAdd / autoRole ────────────────────────────── */

describe('guildMemberAdd / autoRole', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberAdd/autoRole')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no autoRole config', async () => {
    const member = mockGuildMember();
    member.guild = mockGuild();
    await expect(run(member)).resolves.not.toThrow();
  });

  it('assigns roles when config exists', async () => {
    const { AutoRoleModel } = require('../../../src/models/AutoRole');
    AutoRoleModel.findOne.mockResolvedValueOnce({
      roleIds: ['bot-role', 'user-role-1', 'user-role-2'],
    });

    const guild = mockGuild();
    const role1 = { id: 'user-role-1', name: 'Role1' };
    const role2 = { id: 'user-role-2', name: 'Role2' };
    guild.roles.cache = new Collection([['user-role-1', role1], ['user-role-2', role2]]);

    const member = mockGuildMember();
    member.guild = guild;
    member.user.bot = false;

    await run(member);
    expect(member.roles.add).toHaveBeenCalled();
  });
});

/* ── guildMemberAdd / logMemberJoin ───────────────────────── */

describe('guildMemberAdd / logMemberJoin', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberAdd/logMemberJoin')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('calls sendLog with memberJoin', async () => {
    const client = mockClient();
    const member = mockGuildMember();
    member.guild = mockGuild();
    await run(member, client);
    expect(sendLog).toHaveBeenCalledWith(client, member.guild.id, 'memberJoin', expect.any(Object));
  });
});

/* ── guildMemberAdd / userStatusAdd ───────────────────────── */

describe('guildMemberAdd / userStatusAdd', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberAdd/userStatusAdd')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('runs without throwing', async () => {
    const member = mockGuildMember();
    member.guild = mockGuild();
    await expect(run(member)).resolves.not.toThrow();
  });
});

/* ── guildMemberAdd / welcomeCard ─────────────────────────── */

describe('guildMemberAdd / welcomeCard', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberAdd/welcomeCard')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no greetings config', async () => {
    const member = mockGuildMember();
    member.guild = mockGuild();
    await expect(run(member)).resolves.not.toThrow();
  });

  it('sends welcome when config exists and welcomeEnabled', async () => {
    const channel = mockTextChannel();
    const guild = mockGuild();
    guild.channels.cache = new Collection([['ch-greet', channel]]);
    guild.members.cache = new Collection([['bot-id', { id: 'bot-id' }]]);
    
    // Mock permissionsFor
    channel.permissionsFor = jest.fn().mockReturnValue({
      has: jest.fn().mockReturnValue(true),
    });

    const { GreetingsConfigurationModel } = require('../../../src/models/GreetingsConfiguration');
    GreetingsConfigurationModel.findOne.mockResolvedValueOnce({
      greetingsChannelId: 'ch-greet',
      welcomeEnabled: true,
      dmEnabled: false,
    });

    const member = mockGuildMember();
    member.guild = guild;
    (member.guild as any).client = mockClient();

    await run(member);
    expect(channel.send).toHaveBeenCalled();
  });
});

/* ── guildMemberRemove / goodbyeCard ──────────────────────── */

describe('guildMemberRemove / goodbyeCard', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberRemove/goodbyeCard')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when no config', async () => {
    const member = mockGuildMember();
    member.guild = mockGuild();
    await expect(run(member)).resolves.not.toThrow();
  });
});

/* ── guildMemberRemove / logMemberRemove ──────────────────── */

describe('guildMemberRemove / logMemberRemove', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberRemove/logMemberRemove')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('sends memberLeave log when no kick audit entry', async () => {
    const client = mockClient();
    const member = mockGuildMember();
    member.guild = mockGuild();
    await run(member, client);
    expect(sendLog).toHaveBeenCalledWith(client, member.guild.id, 'memberLeave', expect.any(Object));
  });

  it('sends memberKick log when kick audit entry exists', async () => {
    const client = mockClient();
    const member = mockGuildMember();
    member.guild = mockGuild();
    (getAuditLogEntry as jest.Mock).mockResolvedValueOnce({ id: 'audit-1' });
    await run(member, client);
    expect(sendLog).toHaveBeenCalledWith(client, member.guild.id, 'memberKick', expect.any(Object));
  });
});

/* ── guildMemberRemove / userStatusRemove ─────────────────── */

describe('guildMemberRemove / userStatusRemove', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberRemove/userStatusRemove')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('runs without throwing', async () => {
    const member = mockGuildMember();
    member.guild = mockGuild();
    await expect(run(member)).resolves.not.toThrow();
  });
});

/* ── guildMemberUpdate / boostDetection ───────────────────── */

describe('guildMemberUpdate / boostDetection', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberUpdate/boostDetection')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('does nothing when boost status unchanged', async () => {
    const guild = mockGuild();
    const channel = mockTextChannel({ id: 'ch-boost' });
    guild.channels.cache = new Collection([['ch-boost', channel]]);
    
    const oldMember = mockGuildMember({ premiumSince: null });
    oldMember.guild = guild;
    const newMember = mockGuildMember({ premiumSince: null });
    newMember.guild = guild;
    newMember.client = mockClient();

    await run(oldMember, newMember);
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('sends message when user starts boosting', async () => {
    const guild = mockGuild();
    const channel = mockTextChannel({ id: 'ch-boost' });
    guild.channels.cache = new Collection([['ch-boost', channel]]);
    
    const oldMember = mockGuildMember({ premiumSince: null });
    oldMember.guild = guild;
    const newMember = mockGuildMember({ premiumSince: new Date() });
    newMember.guild = guild;
    newMember.client = mockClient();

    await run(oldMember, newMember);
    expect(channel.send).toHaveBeenCalled();
  });
});

/* ── guildMemberUpdate / logMemberUpdate ──────────────────── */

describe('guildMemberUpdate / logMemberUpdate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildMemberUpdate/logMemberUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('logs nickname change', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const oldMember = mockGuildMember();
    oldMember.nickname = 'OldNick';
    oldMember.guild = guild;
    oldMember.communicationDisabledUntil = null;
    const newMember = mockGuildMember();
    newMember.nickname = 'NewNick';
    newMember.guild = guild;
    newMember.communicationDisabledUntil = null;

    await run(oldMember, newMember, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'memberNicknameChange', expect.any(Object), expect.any(Object));
  });

  it('logs role additions', async () => {
    const client = mockClient();
    const guild = mockGuild();
    const role = { id: 'role-new', name: 'NewRole' };
    
    const oldMember = mockGuildMember();
    oldMember.guild = guild;
    oldMember.nickname = 'Same';
    oldMember.communicationDisabledUntil = null;
    oldMember.roles.cache = new Collection();

    const newMember = mockGuildMember();
    newMember.guild = guild;
    newMember.nickname = 'Same';
    newMember.communicationDisabledUntil = null;
    newMember.roles.cache = new Collection([['role-new', role]]);

    await run(oldMember, newMember, client);
    expect(sendLog).toHaveBeenCalledWith(client, guild.id, 'memberRoleAdd', expect.any(Object), expect.any(Object));
  });
});

/* ── guildUpdate / logGuildUpdate ─────────────────────────── */

describe('guildUpdate / logGuildUpdate', () => {
  let run: any;
  beforeAll(async () => {
    run = (await import('../../../src/events/guildUpdate/logGuildUpdate')).default;
  });
  beforeEach(() => jest.clearAllMocks());

  it('logs name change', async () => {
    const client = mockClient();
    const oldGuild = mockGuild({ name: 'Old Name' });
    const newGuild = mockGuild({ name: 'New Name' });
    await run(oldGuild, newGuild, client);
    expect(sendLog).toHaveBeenCalledWith(client, newGuild.id, 'guildUpdate', expect.any(Object));
  });

  it('logs icon change', async () => {
    const client = mockClient();
    const oldGuild = mockGuild({ icon: 'old-hash' });
    const newGuild = mockGuild({ icon: 'new-hash' });
    await run(oldGuild, newGuild, client);
    expect(sendLog).toHaveBeenCalled();
  });

  it('does nothing when nothing changes', async () => {
    const client = mockClient();
    const guild = mockGuild();
    await run(guild, guild, client);
    expect(sendLog).not.toHaveBeenCalled();
  });
});
