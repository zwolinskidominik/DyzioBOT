/**
 * Deep tests for misc commands: avatar, embed, emoji, faceit, help,
 * kalendarzAdwentowy, ping, roll, serverinfo, warnings, wrozba, birthday commands
 */

/* ── shared mocks ──────────────────────────────────────────── */
const mockCreateBaseEmbed = jest.fn();
const mockCreateErrorEmbed = jest.fn();
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: mockCreateErrorEmbed,
}));
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    DEFAULT: '#4C4C54', ERROR: '#E74D3C', FACEIT: '#FF5500', FORTUNE: '#AA8DD8',
    FORTUNE_ADD: '#00FF00', BIRTHDAY: 'EA596E', WARNINGS_LIST: '#FFD700', WARN: '#F1C40F',
  },
}));
const mockGetBotConfig = jest.fn();
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: mockGetBotConfig,
}));

const mockGetFortune = jest.fn();
jest.mock('../../../src/services/fortuneService', () => ({
  getFortune: mockGetFortune,
  DAILY_FORTUNE_LIMIT: 3,
}));

const mockGetBirthday = jest.fn();
const mockGetUpcomingBirthdays = jest.fn();
const mockSetBirthday = jest.fn();
const mockFormatBirthdayConfirmation = jest.fn();
const mockGetDaysForm = jest.fn();
jest.mock('../../../src/services/birthdayService', () => ({
  getBirthday: mockGetBirthday,
  getUpcomingBirthdays: mockGetUpcomingBirthdays,
  setBirthday: mockSetBirthday,
  formatBirthdayConfirmation: mockFormatBirthdayConfirmation,
  getDaysForm: mockGetDaysForm,
}));

const mockGetWarnings = jest.fn();
jest.mock('../../../src/services/warnService', () => ({
  getWarnings: mockGetWarnings,
  getWarns: mockGetWarnings,
}));

jest.mock('../../../src/models/AdventCalendar', () => ({
  AdventCalendarModel: {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    create: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../src/models/Level', () => ({
  LevelModel: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }),
    }),
  },
}));
jest.mock('../../../src/models/LevelConfig', () => ({
  LevelConfigModel: { findOne: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../../../src/utils/canvasRankCard', () => ({
  CanvasRankCard: jest.fn().mockImplementation(() => ({
    build: jest.fn().mockResolvedValue(Buffer.from('png')),
  })),
}));
jest.mock('../../../src/utils/canvasLeaderboardCard', () => ({
  CanvasLeaderboardCard: jest.fn().mockImplementation(() => ({
    build: jest.fn().mockResolvedValue(Buffer.from('png')),
  })),
}));
jest.mock('../../../src/utils/levelMath', () => ({
  xpForLevel: jest.fn().mockReturnValue(0),
  deltaXp: jest.fn().mockReturnValue(100),
}));

import { mockInteraction, mockGuild, mockUser, mockGuildMember } from '../../helpers/discordMocks';

/* ── embed helpers ──────────────────────────────────────────── */
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
  mockCreateBaseEmbed.mockReturnValue(embed);
  mockCreateErrorEmbed.mockReturnValue(embed);
  mockGetBotConfig.mockReturnValue({
    emojis: {
      giveaway: { join: '🎉', list: '📋' },
      trophy: { gold: '🥇', silver: '🥈', bronze: '🥉' },
      birthday: '🎂',
    },
  });
  mockGetDaysForm.mockReturnValue('dni');
});

/* ════════════════════════════════════════════════════════════ */
/*  PING                                                       */
/* ════════════════════════════════════════════════════════════ */
describe('ping command', () => {
  const load = () => require('../../../src/commands/misc/ping');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('ping');
  });

  it('calculates and displays ping values', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    const now = Date.now();
    interaction.createdTimestamp = now - 100;
    interaction.fetchReply = jest.fn().mockResolvedValue({ createdTimestamp: now });

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.fetchReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockCreateBaseEmbed).toHaveBeenCalledWith(expect.objectContaining({
      title: expect.stringContaining('Pong'),
    }));
  });

  it('handles error gracefully', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.fetchReply = jest.fn().mockRejectedValue(new Error('API timeout'));

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  ROLL                                                       */
/* ════════════════════════════════════════════════════════════ */
describe('roll command', () => {
  const load = () => require('../../../src/commands/misc/roll');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('roll');
  });

  it('rolls with default 6 sides', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getInteger = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('1 - 6'));
  });

  it('rolls with custom sides', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getInteger = jest.fn().mockReturnValue(20);

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('1 - 20'));
  });

  it('rejects invalid sides (< 2)', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getInteger = jest.fn().mockReturnValue(1);

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('2'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  AVATAR                                                     */
/* ════════════════════════════════════════════════════════════ */
describe('avatar command', () => {
  const load = () => require('../../../src/commands/misc/avatar');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('avatar');
  });

  it('shows target user avatar', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'u2', username: 'SomeUser' });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(targetUser.displayAvatarURL).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows own avatar when no user specified', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockImplementation(() => {
      throw new Error('Test error');
    });

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  SERVERINFO                                                 */
/* ════════════════════════════════════════════════════════════ */
describe('serverinfo command', () => {
  const load = () => require('../../../src/commands/misc/serverinfo');

  it('has correct data', () => {
    const { data, options } = load();
    expect(data.name).toBe('serverinfo');
    expect(options.guildOnly).toBe(true);
  });

  it('shows server information', async () => {
    const { run } = load();
    const guild = mockGuild();
    guild.createdTimestamp = Date.now() - 86400000;
    guild.premiumSubscriptionCount = 5;
    guild.verificationLevel = 2;
    const member = mockGuildMember({ id: 'u1' });
    member.joinedAt = new Date();
    const interaction = mockInteraction({ guild, member });

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
    expect(mockCreateBaseEmbed).toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.guild = null;

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  WROZBA (fortune)                                           */
/* ════════════════════════════════════════════════════════════ */
describe('wrozba command', () => {
  const load = () => require('../../../src/commands/misc/wrozba');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('wrozba');
  });

  it('happy path: shows fortune', async () => {
    const { run } = load();
    mockGetFortune.mockResolvedValue({
      ok: true,
      data: { fortune: 'Good luck today!', remainingToday: 2 },
    });
    const interaction = mockInteraction();

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGetFortune).toHaveBeenCalledWith({ userId: interaction.user.id });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows error when service returns not ok', async () => {
    const { run } = load();
    mockGetFortune.mockResolvedValue({
      ok: false,
      message: 'Daily limit reached',
    });
    const interaction = mockInteraction();

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('Daily limit reached');
  });

  it('handles exception gracefully', async () => {
    const { run } = load();
    mockGetFortune.mockRejectedValue(new Error('DB error'));
    const interaction = mockInteraction();

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('DB error'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  WARNINGS                                                   */
/* ════════════════════════════════════════════════════════════ */
describe('warnings command', () => {
  const load = () => require('../../../src/commands/misc/warnings');

  it('has correct data', () => {
    const { data, options } = load();
    expect(data.name).toBe('warnings');
    expect(options.guildOnly).toBe(true);
  });

  it('shows own warnings without permission check', async () => {
    const { run } = load();
    mockGetWarnings.mockResolvedValue({
      ok: true,
      data: { warnings: [], count: 0 },
    });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null); // check own

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows other user warnings when moderator', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'other-1' });
    mockGetWarnings.mockResolvedValue({
      ok: true,
      data: {
        warnings: [{ date: new Date(), reason: 'Test', moderatorId: 'mod1' }],
        count: 1,
      },
    });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.member.permissions = { has: jest.fn().mockReturnValue(true) };

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('denies checking others when not moderator', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'other-1' });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.member.permissions = { has: jest.fn().mockReturnValue(false) };

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalled();
    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('uprawnień'));
  });

  it('shows service error', async () => {
    const { run } = load();
    mockGetWarnings.mockResolvedValue({ ok: false, message: 'Not found' });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith('Not found');
  });

  it('handles exception gracefully', async () => {
    const { run } = load();
    mockGetWarnings.mockRejectedValue(new Error('DB error'));
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockCreateErrorEmbed).toHaveBeenCalledWith(expect.stringContaining('błąd'));
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  BIRTHDAY                                                   */
/* ════════════════════════════════════════════════════════════ */
describe('birthday command', () => {
  const load = () => require('../../../src/commands/misc/birthdays/birthday');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('birthday');
  });

  it('shows birthday info for target user', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'u2' });
    mockGetBirthday.mockResolvedValue({
      ok: true,
      data: { date: new Date('2000-04-15'), yearSpecified: true },
    });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGetBirthday).toHaveBeenCalledWith({ guildId: interaction.guild.id, userId: 'u2' });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows own birthday when no user specified', async () => {
    const { run } = load();
    mockGetBirthday.mockResolvedValue({
      ok: true,
      data: { date: new Date('1995-09-13'), yearSpecified: false },
    });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(mockGetBirthday).toHaveBeenCalledWith({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
    });
  });

  it('shows error when no guild', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.guild = { id: undefined };
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalled();
  });

  it('shows "no birthday" message when data is null', async () => {
    const { run } = load();
    mockGetBirthday.mockResolvedValue({ ok: true, data: null });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows service error', async () => {
    const { run } = load();
    mockGetBirthday.mockResolvedValue({ ok: false, message: 'DB error' });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  NEXT BIRTHDAYS                                             */
/* ════════════════════════════════════════════════════════════ */
describe('nextBirthdays command', () => {
  const load = () => require('../../../src/commands/misc/birthdays/nextBirthdays');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('birthdays-next');
  });

  it('shows upcoming birthdays', async () => {
    const { run } = load();
    mockGetUpcomingBirthdays.mockResolvedValue({
      ok: true,
      data: [
        { userId: 'u1', nextBirthday: new Date(), age: 25, daysUntil: 5 },
        { userId: 'u2', nextBirthday: new Date(), age: null, daysUntil: 0 },
      ],
    });
    const interaction = mockInteraction();
    interaction.client.users.fetch = jest.fn()
      .mockResolvedValueOnce(mockUser({ id: 'u1' }))
      .mockResolvedValueOnce(mockUser({ id: 'u2' }));

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockGetUpcomingBirthdays).toHaveBeenCalledWith({ guildId: interaction.guild.id, limit: 10 });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows empty message when no birthdays', async () => {
    const { run } = load();
    mockGetUpcomingBirthdays.mockResolvedValue({ ok: true, data: [] });
    const interaction = mockInteraction();

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows error when no guild', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.guild = { id: undefined };

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows service error', async () => {
    const { run } = load();
    mockGetUpcomingBirthdays.mockResolvedValue({ ok: false, message: 'Error' });
    const interaction = mockInteraction();

    await run({ interaction, client: interaction.client });

    // Uses errorEmbed.setDescription, then editReply
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles exception gracefully', async () => {
    const { run } = load();
    mockGetUpcomingBirthdays.mockRejectedValue(new Error('DB error'));
    const interaction = mockInteraction();

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles user fetch failures gracefully', async () => {
    const { run } = load();
    mockGetUpcomingBirthdays.mockResolvedValue({
      ok: true,
      data: [{ userId: 'deleted-user', nextBirthday: new Date(), age: null, daysUntil: 3 }],
    });
    const interaction = mockInteraction();
    interaction.client.users.fetch = jest.fn().mockRejectedValue(new Error('Unknown User'));

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  REMEMBER BIRTHDAY                                          */
/* ════════════════════════════════════════════════════════════ */
describe('rememberBirthday command', () => {
  const load = () => require('../../../src/commands/misc/birthdays/rememberBirthday');

  it('has correct data', () => {
    const { data } = load();
    expect(data.name).toBe('birthday-remember');
  });

  it('sets birthday successfully', async () => {
    const { run } = load();
    mockSetBirthday.mockResolvedValue({
      ok: true,
      data: { date: new Date('2000-04-15'), yearSpecified: true },
    });
    mockFormatBirthdayConfirmation.mockReturnValue('Birthdate set!');
    const interaction = mockInteraction();
    interaction.options.getString = jest.fn().mockReturnValue('15-04-2000');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockSetBirthday).toHaveBeenCalledWith({
      guildId: interaction.guild.id,
      userId: interaction.user.id,
      dateString: '15-04-2000',
    });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows error when no guild', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    interaction.guild = { id: undefined };
    interaction.options.getString = jest.fn().mockReturnValue('15-04');

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalled();
  });

  it('shows error when service returns not ok', async () => {
    const { run } = load();
    mockSetBirthday.mockResolvedValue({ ok: false, message: 'Invalid date' });
    const interaction = mockInteraction();
    interaction.options.getString = jest.fn().mockReturnValue('99-99');

    await run({ interaction, client: interaction.client });

    // replyWithError uses interaction.reply (not editReply)
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('handles exception gracefully', async () => {
    const { run } = load();
    mockSetBirthday.mockRejectedValue(new Error('DB error'));
    const interaction = mockInteraction();
    interaction.options.getString = jest.fn().mockReturnValue('15-04');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ════════════════════════════════════════════════════════════ */
/*  SET USER BIRTHDAY                                          */
/* ════════════════════════════════════════════════════════════ */
describe('setUserBirthday command', () => {
  const load = () => require('../../../src/commands/misc/birthdays/setUserBirthday');

  it('has correct data', () => {
    const { data, options } = load();
    expect(data.name).toBe('birthday-set-user');
    expect(options.userPermissions).toBeDefined();
  });

  it('sets birthday for another user', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'u2' });
    mockSetBirthday.mockResolvedValue({
      ok: true,
      data: { date: new Date('1994-09-13'), yearSpecified: true },
    });
    mockFormatBirthdayConfirmation.mockReturnValue('Set!');
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('13-09-1994');

    await run({ interaction, client: interaction.client });

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(mockSetBirthday).toHaveBeenCalledWith({
      guildId: interaction.guild.id,
      userId: 'u2',
      dateString: '13-09-1994',
    });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('denies setting own birthday with this command', async () => {
    const { run } = load();
    const interaction = mockInteraction();
    const selfUser = mockUser({ id: interaction.user.id });
    interaction.options.getUser = jest.fn().mockReturnValue(selfUser);
    interaction.options.getString = jest.fn().mockReturnValue('15-04');

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalled();
  });

  it('shows error when no guild', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'other' });
    const interaction = mockInteraction();
    interaction.guild = { id: undefined };
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('15-04');

    await run({ interaction, client: interaction.client });

    expect(interaction.reply).toHaveBeenCalled();
  });

  it('shows service error', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'u2' });
    mockSetBirthday.mockResolvedValue({ ok: false, message: 'Invalid date' });
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('99-99');

    await run({ interaction, client: interaction.client });

    // replyWithError uses interaction.reply
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('handles exception gracefully', async () => {
    const { run } = load();
    const targetUser = mockUser({ id: 'u2' });
    mockSetBirthday.mockRejectedValue(new Error('DB error'));
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    interaction.options.getString = jest.fn().mockReturnValue('15-04');

    await run({ interaction, client: interaction.client });

    expect(interaction.editReply).toHaveBeenCalled();
  });
});
