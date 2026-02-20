/**
 * Tests for misc commands: avatar, embed, emoji, faceit, help, kalendarzAdwentowy,
 * ping, roll, serverinfo, warnings, wrozba, birthday subcommands
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setImage: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
  createErrorEmbed: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: {
    DEFAULT: '#4C4C54', ERROR: '#E74D3C', FACEIT: '#FF5500', FORTUNE: '#AA8DD8',
    FORTUNE_ADD: '#00FF00', BIRTHDAY: 'EA596E', WARNINGS_LIST: '#FFD700', WARN: '#F1C40F',
  },
}));
jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      giveaway: { join: '🎉', list: '📋' },
      trophy: { gold: '🥇', silver: '🥈', bronze: '🥉' },
    },
  }),
}));
jest.mock('../../../src/services/fortuneService', () => ({
  getRandomFortune: jest.fn().mockResolvedValue({ ok: true, data: { content: 'Good luck' } }),
}));
jest.mock('../../../src/services/birthdayService', () => ({
  rememberedBirthday: jest.fn().mockResolvedValue({ ok: true }),
  getNextBirthdays: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));
jest.mock('../../../src/services/warnService', () => ({
  getWarns: jest.fn().mockResolvedValue({ ok: true, data: [] }),
}));
jest.mock('../../../src/models/AdventCalendar', () => ({
  AdventCalendarModel: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn() },
}));
jest.mock('../../../src/models/Level', () => ({
  LevelModel: {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue([]) }) }),
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

import { mockInteraction, mockGuild, mockUser } from '../../helpers/discordMocks';

describe('Misc commands - data exports', () => {
  it('avatar has correct command data', () => {
    const { data } = require('../../../src/commands/misc/avatar');
    expect(data.name).toBe('avatar');
  });

  it('embed has correct command data', () => {
    const { data } = require('../../../src/commands/misc/embed');
    expect(data.name).toBe('embed');
  });

  it('emoji has correct command data', () => {
    const { data } = require('../../../src/commands/misc/emoji');
    expect(data.name).toBe('emoji');
  });

  it('faceit has correct command data', () => {
    const { data } = require('../../../src/commands/misc/faceit');
    expect(data.name).toBe('faceit');
  });

  it('help has correct command data', () => {
    const { data } = require('../../../src/commands/misc/help');
    expect(data.name).toBe('help');
  });

  it('kalendarzAdwentowy has correct command data', () => {
    const { data } = require('../../../src/commands/misc/kalendarzAdwentowy');
    expect(data.name).toBe('kalendarz-adwentowy');
  });

  it('ping has correct command data', () => {
    const { data } = require('../../../src/commands/misc/ping');
    expect(data.name).toBe('ping');
  });

  it('roll has correct command data', () => {
    const { data } = require('../../../src/commands/misc/roll');
    expect(data.name).toBe('roll');
  });

  it('serverinfo has correct command data', () => {
    const { data } = require('../../../src/commands/misc/serverinfo');
    expect(data.name).toBe('serverinfo');
  });

  it('warnings has correct command data', () => {
    const { data } = require('../../../src/commands/misc/warnings');
    expect(data.name).toBe('warnings');
  });

  it('wrozba has correct command data', () => {
    const { data } = require('../../../src/commands/misc/wrozba');
    expect(data.name).toBe('wrozba');
  });
});

describe('Misc birthday commands', () => {
  it('birthday has correct command data', () => {
    const { data } = require('../../../src/commands/misc/birthdays/birthday');
    expect(data.name).toBe('birthday');
  });

  it('nextBirthdays has correct command data', () => {
    const { data } = require('../../../src/commands/misc/birthdays/nextBirthdays');
    expect(data.name).toBe('birthdays-next');
  });

  it('rememberBirthday has correct command data', () => {
    const { data } = require('../../../src/commands/misc/birthdays/rememberBirthday');
    expect(data.name).toBe('birthday-remember');
  });

  it('setUserBirthday has correct command data', () => {
    const { data } = require('../../../src/commands/misc/birthdays/setUserBirthday');
    expect(data.name).toBe('birthday-set-user');
  });
});

describe('Misc commands - run functions', () => {
  it('ping.run defers reply and shows latency', async () => {
    const { run } = require('../../../src/commands/misc/ping');
    const interaction = mockInteraction();
    interaction.fetchReply = jest.fn().mockResolvedValue({ createdTimestamp: Date.now() - 50 });
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('roll.run replies with a number', async () => {
    const { run } = require('../../../src/commands/misc/roll');
    const interaction = mockInteraction();
    interaction.options.getInteger = jest.fn().mockReturnValue(100);
    await run({ interaction, client: interaction.client });
    expect(interaction.reply).toHaveBeenCalled();
  });

  it('avatar.run defers and replies with avatar embed', async () => {
    const { run } = require('../../../src/commands/misc/avatar');
    const interaction = mockInteraction();
    const targetUser = mockUser({ id: 'u1' });
    interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
    await run({ interaction, client: interaction.client });
    // Should either reply or deferReply
    expect(interaction.reply.mock.calls.length + interaction.deferReply.mock.calls.length).toBeGreaterThan(0);
  });

  it('wrozba.run defers reply', async () => {
    const { run } = require('../../../src/commands/misc/wrozba');
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('warnings.run defers reply', async () => {
    const { run } = require('../../../src/commands/misc/warnings');
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('serverinfo.run replies with guild info', async () => {
    const { run } = require('../../../src/commands/misc/serverinfo');
    const guild = mockGuild();
    const interaction = mockInteraction({ guild });
    await run({ interaction, client: interaction.client });
    expect(interaction.reply.mock.calls.length + interaction.deferReply.mock.calls.length).toBeGreaterThan(0);
  });
});
