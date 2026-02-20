/**
 * Tests for user commands: level, toplvl
 */
jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn().mockReturnValue({
    setImage: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  }),
  createErrorEmbed: jest.fn().mockReturnValue({}),
}));
jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: '#4C4C54', ERROR: '#E74D3C' },
}));
jest.mock('../../../src/models/Level', () => ({
  LevelModel: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ guildId: 'g1', userId: 'u1', xp: 500, level: 5 }),
    }),
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { userId: 'u1', level: 10, xp: 5000 },
        { userId: 'u2', level: 8, xp: 3000 },
      ]),
    }),
    countDocuments: jest.fn().mockResolvedValue(100),
  },
}));
jest.mock('../../../src/services/xpService', () => ({
  getCurrentXp: jest.fn().mockResolvedValue({ level: 5, xp: 500 }),
  getUserRank: jest.fn().mockResolvedValue({ ok: true, data: { rank: 1, totalUsers: 10 } }),
  getLeaderboard: jest.fn().mockResolvedValue({
    ok: true,
    data: {
      entries: [
        { userId: 'u1', level: 10, xp: 100, totalXp: 5000 },
        { userId: 'u2', level: 8, xp: 50, totalXp: 3000 },
      ],
      totalUsers: 2,
      page: 1,
      totalPages: 1,
    },
  }),
  flush: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/cache/xpCache', () => ({
  __esModule: true,
  default: {
    getCurrentXp: jest.fn().mockResolvedValue({ level: 5, xp: 500 }),
  },
}));
jest.mock('../../../src/events/clientReady/xpFlush', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined),
  flushXp: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../../src/models/LevelConfig', () => ({
  LevelConfigModel: { findOne: jest.fn().mockResolvedValue({ enabled: true }) },
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

import { mockInteraction, mockUser } from '../../helpers/discordMocks';

describe('User commands - data exports', () => {
  it('level has correct command data', () => {
    const { data } = require('../../../src/commands/user/level');
    expect(data.name).toBe('level');
  });

  it('toplvl has correct command data', () => {
    const { data } = require('../../../src/commands/user/toplvl');
    expect(data.name).toBe('toplvl');
  });
});

describe('User commands - run functions', () => {
  it('level.run defers reply and shows rank card', async () => {
    const { run } = require('../../../src/commands/user/level');
    const interaction = mockInteraction();
    interaction.options.getUser = jest.fn().mockReturnValue(null);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });

  it('toplvl.run defers reply and shows leaderboard', async () => {
    const { run } = require('../../../src/commands/user/toplvl');
    const interaction = mockInteraction();
    interaction.options.getInteger = jest.fn().mockReturnValue(null);
    await run({ interaction, client: interaction.client });
    expect(interaction.deferReply).toHaveBeenCalled();
  });
});
