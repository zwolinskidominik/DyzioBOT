/**
 * Deep tests for moderation commands: ban, kick, mute, unban, warn, warnRemove
 * Exercises all meaningful code paths including success, error, and permission-failure branches.
 */

/* ── shared mocks ─────────────────────────────────────────── */
const mockGetModFailMessage = jest.fn();
const mockCreateModErrorEmbed = jest.fn();
const mockCreateModSuccessEmbed = jest.fn();
const mockFindBannedUser = jest.fn();
const mockParseDuration = jest.fn();
const mockFormatHumanDuration = jest.fn();

jest.mock('../../../src/utils/moderationHelpers', () => ({
  getModFailMessage: mockGetModFailMessage,
  createModErrorEmbed: mockCreateModErrorEmbed,
  createModSuccessEmbed: mockCreateModSuccessEmbed,
  findBannedUser: mockFindBannedUser,
  parseDuration: mockParseDuration,
  formatHumanDuration: mockFormatHumanDuration,
  canModerate: jest.fn().mockReturnValue({ allowed: true }),
}));

const mockCreateBaseEmbed = jest.fn();
const mockCreateErrorEmbed = jest.fn();
const mockFormatWarnBar = jest.fn();
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: mockCreateErrorEmbed,
  formatWarnBar: mockFormatWarnBar,
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C', WARN: '#F1C40F', WARNINGS_LIST: '#FFD700' },
}));

const mockAddWarn = jest.fn();
const mockRemoveWarn = jest.fn();
jest.mock('../../../src/services/warnService', () => ({
  addWarn: mockAddWarn,
  removeWarn: mockRemoveWarn,
  WARN_LIMIT: 4,
  getWarns: jest.fn(),
}));

import { mockInteraction, mockGuildMember, mockUser, mockGuild } from '../../helpers/discordMocks';

/* ── helpers for embed mocking ──────────────────────────────── */
function fakeEmbed() {
  return {
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setAuthor: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setImage: jest.fn().mockReturnThis(),
    setTitle: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  const embed = fakeEmbed();
  mockCreateModErrorEmbed.mockReturnValue(embed);
  mockCreateModSuccessEmbed.mockReturnValue(embed);
  mockCreateBaseEmbed.mockReturnValue(embed);
  mockCreateErrorEmbed.mockReturnValue(embed);
  mockFormatWarnBar.mockReturnValue('▓▓▓▓░░░░');
  mockGetModFailMessage.mockReturnValue(null); // default: permission check passes
  mockParseDuration.mockReturnValue(86400000); // default: 1 day
  mockFormatHumanDuration.mockReturnValue('1d');
});

/* ════════════════════════════════════════════════════════════ */
/*  BAN                                                        */
/* ════════════════════════════════════════════════════════════ */
describe('ban command', () => {
  const loadBan = () => require('../../../src/commands/moderation/ban');

  it('has correct data and options', () => {
    const { data, options } = loadBan();
    expect(data.name).toBe('ban');
    expect(options.guildOnly).toBe(true);
  });

  it('happy path: bans member and replies with success embed', async () => {
    const { run } = loadBan();
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(guild.members.fetch).toHaveBeenCalledWith('target-1');
    expect(mockGetModFailMessage).toHaveBeenCalled();
    expect(targetMember.ban).toHaveBeenCalledWith({ reason: 'Spam', deleteMessageSeconds: 86400 });
    expect(mockCreateModSuccessEmbed).toHaveBeenCalledWith(
      'ban', targetUser, interaction.user, expect.anything(), expect.any(String), 'Spam'
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns error when member is not found on server', async () => {
    const { run } = loadBan();
    const targetUser = mockUser({ id: 'target-1' });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockRejectedValue(new Error('Unknown Member'));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Nie można znaleźć'));
  });

  it('returns error when bot member (members.me) is null', async () => {
    const { run } = loadBan();
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    guild.members.me = null;
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('uprawnień bota'));
  });

  it('returns error when permission check fails', async () => {
    const { run } = loadBan();
    mockGetModFailMessage.mockReturnValue('Nie możesz zbanować tego użytkownika.');
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 99 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(targetMember.ban).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles ban error gracefully', async () => {
    const { run } = loadBan();
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    targetMember.ban = jest.fn().mockRejectedValue(new Error('API error'));
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 'target-1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('błąd'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  KICK                                                       */
/* ════════════════════════════════════════════════════════════ */
describe('kick command', () => {
  const loadKick = () => require('../../../src/commands/moderation/kick');

  it('has correct data and options', () => {
    const { data, options } = loadKick();
    expect(data.name).toBe('kick');
    expect(options.guildOnly).toBe(true);
  });

  it('happy path: kicks member', async () => {
    const { run } = loadKick();
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(targetMember.kick).toHaveBeenCalledWith('Spam');
    expect(mockCreateModSuccessEmbed).toHaveBeenCalledWith(
      'kick', targetUser, interaction.user, expect.anything(), expect.any(String), 'Spam'
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns error when no user provided', async () => {
    const { run } = loadKick();
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(null);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('użytkownika'));
  });

  it('returns error when no reason provided', async () => {
    const { run } = loadKick();
    const guild = mockGuild();
    const targetUser = mockUser({ id: 'target-1' });
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('powodu'));
  });

  it('returns error when member not found on server', async () => {
    const { run } = loadKick();
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockRejectedValue(new Error('Not found'));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Nie można znaleźć'));
  });

  it('returns error when bot member is null', async () => {
    const { run } = loadKick();
    const guild = mockGuild();
    guild.members.me = null;
    guild.members.fetch = jest.fn().mockResolvedValue(mockGuildMember({ id: 't1' }));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('uprawnień'));
  });

  it('returns error when permission check fails', async () => {
    const { run } = loadKick();
    mockGetModFailMessage.mockReturnValue('Nie możesz wyrzucić tego użytkownika.');
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(mockGuildMember({ id: 't1' }));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalled();
  });

  it('handles kick error gracefully', async () => {
    const { run } = loadKick();
    const targetMember = mockGuildMember({ id: 't1' });
    targetMember.kick = jest.fn().mockRejectedValue(new Error('API fail'));
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('błąd'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  MUTE                                                       */
/* ════════════════════════════════════════════════════════════ */
describe('mute command', () => {
  const loadMute = () => require('../../../src/commands/moderation/mute');

  it('has correct data and options', () => {
    const { data, options } = loadMute();
    expect(data.name).toBe('mute');
    expect(options.guildOnly).toBe(true);
  });

  it('happy path: mutes member with duration', async () => {
    const { run } = loadMute();
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '1d';
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(targetMember.timeout).toHaveBeenCalledWith(86400000, 'Spam');
    expect(mockCreateModSuccessEmbed).toHaveBeenCalledWith(
      'mute', targetUser, interaction.user, expect.anything(), expect.any(String), 'Spam', expect.any(String)
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles already muted user (updates timeout)', async () => {
    const { run } = loadMute();
    const targetUser = mockUser({ id: 'target-1' });
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    targetMember.isCommunicationDisabled = jest.fn().mockReturnValue(true);
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '2h';
      if (name === 'powod') return 'Too noisy';
      return null;
    });

    await run({ interaction, client: interaction.client });

    expect(targetMember.timeout).toHaveBeenCalled();
    const successEmbed = mockCreateModSuccessEmbed.mock.results[0].value;
    expect(successEmbed.setDescription).toHaveBeenCalledWith(expect.stringContaining('zaktualizowany'));
  });

  it('returns error when no user provided', async () => {
    const { run } = loadMute();
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(null);
    interaction.options.getString = jest.fn().mockReturnValue('1h');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('użytkownika'));
  });

  it('returns error when no duration provided', async () => {
    const { run } = loadMute();
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser());
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return null;
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('czasu'));
  });

  it('returns error when no reason provided', async () => {
    const { run } = loadMute();
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser());
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '1h';
      if (name === 'powod') return null;
      return null;
    });

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('powodu'));
  });

  it('returns error when duration is invalid', async () => {
    const { run } = loadMute();
    mockParseDuration.mockReturnValue(null);
    const targetMember = mockGuildMember({ id: 't1' });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return 'invalid';
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      content: expect.stringContaining('prawidłową wartość'),
    }));
  });

  it('returns error when member not found', async () => {
    const { run } = loadMute();
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockRejectedValue(new Error('Not found'));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '1h';
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('nie istnieje'));
  });

  it('returns error when bot member is null', async () => {
    const { run } = loadMute();
    const guild = mockGuild();
    guild.members.me = null;
    guild.members.fetch = jest.fn().mockResolvedValue(mockGuildMember({ id: 't1' }));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '1h';
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('uprawnień'));
  });

  it('returns error when permission check fails', async () => {
    const { run } = loadMute();
    mockGetModFailMessage.mockReturnValue('Too high role');
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(mockGuildMember({ id: 't1' }));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '1h';
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('Too high role'));
  });

  it('handles timeout error gracefully', async () => {
    const { run } = loadMute();
    const targetMember = mockGuildMember({ id: 't1' });
    targetMember.timeout = jest.fn().mockRejectedValue(new Error('API error'));
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'czas_trwania') return '1h';
      if (name === 'powod') return 'Spam';
      return null;
    });

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('błąd'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  UNBAN                                                      */
/* ════════════════════════════════════════════════════════════ */
describe('unban command', () => {
  const loadUnban = () => require('../../../src/commands/moderation/unban');

  it('has correct data and options', () => {
    const { data, options } = loadUnban();
    expect(data.name).toBe('unban');
    expect(options.guildOnly).toBe(true);
  });

  it('happy path: unbans user by ID', async () => {
    const { run } = loadUnban();
    const bannedUser = mockUser({ id: 'banned-1', username: 'BannedGuy' });
    mockFindBannedUser.mockResolvedValue(bannedUser);
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('banned-1');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockFindBannedUser).toHaveBeenCalledWith(guild, 'banned-1');
    expect(guild.bans.remove).toHaveBeenCalledWith('banned-1');
    expect(mockCreateModSuccessEmbed).toHaveBeenCalledWith(
      'unban', bannedUser, interaction.user, expect.anything(), expect.any(String)
    );
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns error when user not found in ban list', async () => {
    const { run } = loadUnban();
    mockFindBannedUser.mockResolvedValue(null);
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('unknown-id');

    await run({ interaction, client: interaction.client });

    expect(guild.bans.remove).not.toHaveBeenCalled();
    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('banów'));
  });

  it('handles unban error gracefully', async () => {
    const { run } = loadUnban();
    mockFindBannedUser.mockResolvedValue(mockUser({ id: 'banned-1' }));
    const guild = mockGuild();
    guild.bans.remove = jest.fn().mockRejectedValue(new Error('API error'));
    const interaction = mockInteraction({ guild });
    interaction.options.getString = jest.fn().mockReturnValue('banned-1');

    await run({ interaction, client: interaction.client });

    const embed = mockCreateModErrorEmbed.mock.results[0].value;
    expect(embed.setDescription).toHaveBeenCalledWith(expect.stringContaining('błąd'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  WARN                                                       */
/* ════════════════════════════════════════════════════════════ */
describe('warn command', () => {
  const loadWarn = () => require('../../../src/commands/moderation/warn');

  it('has correct data and options', () => {
    const { data, options } = loadWarn();
    expect(data.name).toBe('warn');
    expect(options.guildOnly).toBe(true);
  });

  it('happy path: warns user without auto-ban', async () => {
    const { run } = loadWarn();
    const targetUser = mockUser({ id: 'target-1' });
    targetUser.send = jest.fn().mockResolvedValue(undefined);
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    mockAddWarn.mockResolvedValue({
      ok: true,
      data: { count: 1, shouldBan: false, punishment: null, nextPunishment: { label: '1h timeout' } },
    });

    await run({ interaction, client: interaction.client });

    expect(mockAddWarn).toHaveBeenCalledWith({
      guildId: guild.id,
      userId: 'target-1',
      reason: 'Spam',
      moderatorId: interaction.user.id,
      moderatorTag: interaction.user.tag,
    });
    expect(targetUser.send).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(targetMember.ban).not.toHaveBeenCalled();
  });

  it('auto-bans user when shouldBan is true', async () => {
    const { run } = loadWarn();
    const targetUser = mockUser({ id: 'target-1' });
    targetUser.send = jest.fn().mockResolvedValue(undefined);
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Too many warnings');
    mockAddWarn.mockResolvedValue({
      ok: true,
      data: { count: 4, shouldBan: true, punishment: null, nextPunishment: null },
    });

    await run({ interaction, client: interaction.client });

    expect(targetMember.ban).toHaveBeenCalledWith(expect.objectContaining({
      reason: expect.stringContaining('Auto-ban'),
    }));
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('applies mute punishment when duration > 0', async () => {
    const { run } = loadWarn();
    const targetUser = mockUser({ id: 'target-1' });
    targetUser.send = jest.fn().mockResolvedValue(undefined);
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    mockAddWarn.mockResolvedValue({
      ok: true,
      data: { count: 2, shouldBan: false, punishment: { duration: 3600000, label: '1h' }, nextPunishment: null },
    });

    await run({ interaction, client: interaction.client });

    expect(targetMember.timeout).toHaveBeenCalledWith(3600000, 'Spam');
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('returns error when no user provided', async () => {
    const { run } = loadWarn();
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('użytkownika'));
  });

  it('returns error when no reason provided', async () => {
    const { run } = loadWarn();
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockImplementation((name: string) => {
      if (name === 'uzytkownik' || name === 'użytkownik') return null;
      return null; // both powod and user return null, but getUser returns the user
    });
    // Override: getUser returns user, getString returns null for powod
    interaction.options.getString = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('powodu'));
  });

  it('returns error when member not found', async () => {
    const { run } = loadWarn();
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockRejectedValue(new Error('Not found'));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('znaleźć'));
  });

  it('returns error when permission check fails', async () => {
    const { run } = loadWarn();
    mockGetModFailMessage.mockReturnValue('Too high role');
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(mockGuildMember({ id: 't1' }));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('Too high role');
  });

  it('returns error when addWarn fails', async () => {
    const { run } = loadWarn();
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(mockGuildMember({ id: 't1' }));
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    mockAddWarn.mockResolvedValue({ ok: false, message: 'Service error' });

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('Service error');
  });

  it('handles DM send failure gracefully (still works)', async () => {
    const { run } = loadWarn();
    const targetUser = mockUser({ id: 'target-1' });
    targetUser.send = jest.fn().mockRejectedValue(new Error('Cannot send DM'));
    const targetMember = mockGuildMember({ id: 'target-1', highestPos: 1 });
    const guild = mockGuild();
    guild.members.fetch = jest.fn().mockResolvedValue(targetMember);
    const interaction = mockInteraction({ guild });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('Spam');
    mockAddWarn.mockResolvedValue({
      ok: true,
      data: { count: 1, shouldBan: false, punishment: null, nextPunishment: null },
    });

    await run({ interaction, client: interaction.client });

    // Should still editReply even though DM failed
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  WARN REMOVE                                                */
/* ════════════════════════════════════════════════════════════ */
describe('warnRemove command', () => {
  const loadWarnRemove = () => require('../../../src/commands/moderation/warnRemove');

  it('has correct data and options', () => {
    const { data, options } = loadWarnRemove();
    expect(data.name).toBe('warn-remove');
    expect(options.guildOnly).toBe(true);
  });

  it('happy path: removes warning successfully', async () => {
    const { run } = loadWarnRemove();
    const targetUser = mockUser({ id: 'target-1' });
    mockRemoveWarn.mockResolvedValue({
      ok: true,
      data: { count: 0 },
    });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getInteger = jest.fn().mockReturnValue(1);

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockRemoveWarn).toHaveBeenCalledWith({
      guildId: interaction.guild.id,
      userId: 'target-1',
      warningIndex: 1,
    });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows error when removeWarn returns not ok', async () => {
    const { run } = loadWarnRemove();
    mockRemoveWarn.mockResolvedValue({
      ok: false,
      message: 'Warning not found',
    });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getInteger = jest.fn().mockReturnValue(99);

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('Warning not found');
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles exception gracefully', async () => {
    const { run } = loadWarnRemove();
    mockRemoveWarn.mockRejectedValue(new Error('DB error'));
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(mockUser({ id: 't1' }));
    interaction.options.getInteger = jest.fn().mockReturnValue(1);

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('błąd'));
    expect(interaction.editReply).toHaveBeenCalled();
  });
});
