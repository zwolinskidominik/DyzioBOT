export {};
/**
 * Deep tests for remaining low-coverage commands:
 * faceit (full), help (full), meme (full), kalendarzAdwentowy (full),
 * cat, dog, voiceControl exports
 */

jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/config/constants/colors', () => ({
  COLORS: { DEFAULT: 0, ERROR: 0xff0000, FACEIT: 0xff5500, MEME: 0x00ff00, EMBED: 0x5865f2, GIVEAWAY: 0xff00ff },
}));

jest.mock('../../../src/config/bot', () => ({
  getBotConfig: jest.fn().mockReturnValue({
    emojis: {
      next: '▶️', previous: '◀️',
      faceit: {
        levels: { 1: '⬜', 2: '🟩', 3: '🟩', 4: '🟨', 5: '🟨', 6: '🟧', 7: '🟧', 8: '🟥', 9: '🟥', 10: '💎' },
        checkmark: '✅', crossmark: '❌',
      },
    },
  }),
}));

jest.mock('../../../src/config', () => ({
  env: jest.fn().mockReturnValue({ FACEIT_API_KEY: 'test-key' }),
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
});
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
  createErrorEmbed: jest.fn().mockReturnValue({ data: {} }),
  formatResults: jest.fn().mockReturnValue('formatted'),
}));

const mockRequest = jest.fn();
jest.mock('undici', () => ({
  request: mockRequest,
  fetch: jest.fn(),
}));

const mockFetchMeme = jest.fn();
jest.mock('../../../src/utils/memeHelpers', () => ({
  fetchMeme: mockFetchMeme,
  SITES: { kwejk: 'kwejk', demotywatory: 'demotywatory' },
}));

const mockAdventFind = jest.fn();
const mockAdventModel = jest.fn();
jest.mock('../../../src/models/AdventCalendar', () => ({
  AdventCalendarModel: Object.assign(mockAdventModel, {
    findOne: mockAdventFind,
  }),
}));

jest.mock('../../../src/services/xpService', () => ({
  modifyXp: jest.fn().mockResolvedValue(undefined),
  flush: jest.fn(),
  getConfig: jest.fn(),
}));

jest.mock('../../../src/utils/animalHelpers', () => ({
  fetchRandomAnimalImage: jest.fn().mockResolvedValue({ url: 'https://example.com/animal.jpg', source: 'test' }),
  createAnimalEmbed: jest.fn().mockReturnValue({ data: { title: 'Animal' } }),
  handleAnimalError: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('fs/promises', () => ({
  access: jest.fn().mockRejectedValue(new Error('Not found')),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function makeInteraction(overrides: any = {}) {
  return {
    commandName: 'test',
    options: {
      getString: jest.fn().mockReturnValue(null),
      getSubcommand: jest.fn().mockReturnValue('default'),
      getChannel: jest.fn().mockReturnValue(null),
      getBoolean: jest.fn().mockReturnValue(false),
      getAttachment: jest.fn().mockReturnValue(null),
      getInteger: jest.fn().mockReturnValue(null),
      getUser: jest.fn().mockReturnValue(null),
    },
    guild: {
      id: 'g1', name: 'TestGuild',
      iconURL: () => 'https://example.com/icon.png',
    },
    guildId: 'g1',
    user: { id: 'u1', username: 'testuser', displayAvatarURL: () => 'https://example.com/avatar.png' },
    client: { application: { id: 'app1' } },
    member: { permissions: { has: () => true } },
    channel: { id: 'ch1', send: jest.fn().mockResolvedValue(undefined) },
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    fetchReply: jest.fn().mockResolvedValue({
      createMessageComponentCollector: jest.fn().mockReturnValue({
        on: jest.fn(), once: jest.fn(),
      }),
    }),
    replied: false, deferred: false,
    ...overrides,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   faceit command (FULL)
   ═══════════════════════════════════════════════════════════════════ */
describe('faceit command (deep)', () => {
  const faceitCmd = require('../../../src/commands/misc/faceit');

  const mockPlayerData = {
    player_id: 'p1',
    nickname: 'testplayer',
    country: 'PL',
    avatar: 'https://example.com/avatar.png',
    games: { cs2: { faceit_elo: 1500, skill_level: 7 } },
    faceit_url: 'https://faceit.com/testplayer',
    activated_at: '2020-01-01T00:00:00Z',
    steam_id_64: '76561198000000001',
  };

  const mockStatsData = {
    lifetime: {
      'Matches': '500',
      'Win Rate %': '55',
      'Average K/D Ratio': '1.15',
      'Average Headshots %': '45',
      'Longest Win Streak': '10',
      'Recent Results': ['1', '0', '1', '1', '0'],
      'Total Kills with extended stats': '10000',
      'Total Matches': '500',
    },
  };

  it('fetches and displays player stats', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('testplayer');

    mockRequest
      .mockResolvedValueOnce({ statusCode: 200, body: { json: jest.fn().mockResolvedValue(mockPlayerData) } })
      .mockResolvedValueOnce({ statusCode: 200, body: { json: jest.fn().mockResolvedValue(mockStatsData) } });

    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles player not found (404)', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('unknown');
    mockRequest.mockResolvedValueOnce({ statusCode: 404, body: { json: jest.fn() } });
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles stats not found', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('testplayer');
    mockRequest
      .mockResolvedValueOnce({ statusCode: 200, body: { json: jest.fn().mockResolvedValue(mockPlayerData) } })
      .mockResolvedValueOnce({ statusCode: 404, body: { json: jest.fn() } });
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles network error', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('test');
    mockRequest.mockRejectedValueOnce(new Error('Network error'));
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles empty nick', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue(null);
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles non-200 status code', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('test');
    mockRequest.mockResolvedValueOnce({ statusCode: 500, body: { json: jest.fn() } });
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles csgo fallback when cs2 missing', async () => {
    const interaction = makeInteraction();
    interaction.options.getString.mockReturnValue('testplayer');
    const csgoPlayer = { ...mockPlayerData, games: { csgo: { faceit_elo: 1200, skill_level: 5 } } };
    mockRequest
      .mockResolvedValueOnce({ statusCode: 200, body: { json: jest.fn().mockResolvedValue(csgoPlayer) } })
      .mockResolvedValueOnce({ statusCode: 200, body: { json: jest.fn().mockResolvedValue(mockStatsData) } });
    await faceitCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   help command (FULL)
   ═══════════════════════════════════════════════════════════════════ */
describe('help command (deep)', () => {
  const helpCmd = require('../../../src/commands/misc/help');

  it('shows first page of commands', async () => {
    const interaction = makeInteraction();
    await helpCmd.run({ interaction, client: {} });
    expect(interaction.reply).toHaveBeenCalled();
    expect(interaction.fetchReply).toHaveBeenCalled();
  });

  it('handles error gracefully', async () => {
    const interaction = makeInteraction();
    interaction.reply.mockRejectedValueOnce(new Error('Error'));
    interaction.replied = false;
    interaction.deferred = false;
    await helpCmd.run({ interaction, client: {} });
  });

  it('handles error when already replied', async () => {
    const interaction = makeInteraction();
    interaction.reply.mockRejectedValueOnce(new Error('Error'));
    interaction.replied = true;
    await helpCmd.run({ interaction, client: {} });
  });
});

/* ═══════════════════════════════════════════════════════════════════
   meme command (FULL)
   ═══════════════════════════════════════════════════════════════════ */
describe('meme command (deep)', () => {
  const memeCmd = require('../../../src/commands/fun/meme');

  it('sends a meme', async () => {
    mockFetchMeme.mockResolvedValue({ title: 'Funny', url: 'https://example.com/meme.jpg', source: 'kwejk', isVideo: false });
    const interaction = makeInteraction();
    await memeCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('sends a video meme', async () => {
    mockFetchMeme.mockResolvedValue({ title: 'Video', url: 'https://example.com/video.mp4', source: 'kwejk', isVideo: true });
    const interaction = makeInteraction();
    await memeCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('tries alternative sites on error', async () => {
    mockFetchMeme
      .mockRejectedValueOnce(new Error('Primary failed'))
      .mockResolvedValueOnce({ title: 'Backup', url: 'https://example.com/backup.jpg', source: 'demotywatory', isVideo: false });
    const interaction = makeInteraction();
    await memeCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('shows error when all sites fail', async () => {
    mockFetchMeme.mockRejectedValue(new Error('All failed'));
    const interaction = makeInteraction();
    await memeCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   kalendarzAdwentowy command (FULL)
   ═══════════════════════════════════════════════════════════════════ */
describe('kalendarzAdwentowy command (deep)', () => {
  const adventCmd = require('../../../src/commands/misc/kalendarzAdwentowy');

  it('returns error outside december 2025', async () => {
    const interaction = makeInteraction();
    await adventCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('handles already opened day', async () => {
    // Mock Date to be December 2025
    const realDate = Date;
    const mockDate = new Date('2025-12-15T12:00:00+01:00');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockDate;
      return new (realDate as any)(...args);
    });
    (Date as any).now = realDate.now;

    mockAdventFind.mockResolvedValue({
      openedDays: [{ day: 15, xp: 250, openedAt: new Date() }],
      totalXP: 250,
    });

    const interaction = makeInteraction();
    await adventCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('opens new calendar day with reward', async () => {
    const realDate = Date;
    const mockDate = new Date('2025-12-10T12:00:00+01:00');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockDate;
      return new (realDate as any)(...args);
    });
    (Date as any).now = realDate.now;

    // Mock Math.random to return value ensuring XP reward
    jest.spyOn(Math, 'random').mockReturnValue(0.6);

    const saveFn = jest.fn().mockResolvedValue(undefined);
    mockAdventFind.mockResolvedValue(null);
    mockAdventModel.mockImplementation(function(this: any, data: any) {
      this.guildId = data.guildId;
      this.userId = data.userId;
      this.openedDays = data.openedDays || [];
      this.totalXP = data.totalXP || 0;
      this.save = saveFn;
      return this;
    });

    const interaction = makeInteraction();
    await adventCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it('handles error', async () => {
    const realDate = Date;
    const mockDate = new Date('2025-12-05T12:00:00+01:00');
    jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
      if (args.length === 0) return mockDate;
      return new (realDate as any)(...args);
    });
    (Date as any).now = realDate.now;

    mockAdventFind.mockRejectedValue(new Error('DB error'));
    const interaction = makeInteraction();
    await adventCmd.run({ interaction, client: {} });
    expect(interaction.editReply).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   cat command
   ═══════════════════════════════════════════════════════════════════ */
describe('cat command', () => {
  const catCmd = require('../../../src/commands/fun/cat');

  it('sends cat image', async () => {
    const interaction = makeInteraction();
    await catCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalled();
  });

  it('handles null response', async () => {
    const { fetchRandomAnimalImage } = require('../../../src/utils/animalHelpers');
    fetchRandomAnimalImage.mockResolvedValueOnce(null);
    const interaction = makeInteraction();
    await catCmd.run({ interaction, client: {} });
    const { handleAnimalError } = require('../../../src/utils/animalHelpers');
    expect(handleAnimalError).toHaveBeenCalled();
  });

  it('handles API error', async () => {
    const { fetchRandomAnimalImage } = require('../../../src/utils/animalHelpers');
    fetchRandomAnimalImage.mockRejectedValueOnce(new Error('API fail'));
    const interaction = makeInteraction();
    await catCmd.run({ interaction, client: {} });
    const { handleAnimalError } = require('../../../src/utils/animalHelpers');
    expect(handleAnimalError).toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════════════════════
   dog command
   ═══════════════════════════════════════════════════════════════════ */
describe('dog command', () => {
  const dogCmd = require('../../../src/commands/fun/dog');

  it('sends dog image', async () => {
    const interaction = makeInteraction();
    await dogCmd.run({ interaction, client: {} });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.followUp).toHaveBeenCalled();
  });

  it('handles null response', async () => {
    const { fetchRandomAnimalImage } = require('../../../src/utils/animalHelpers');
    fetchRandomAnimalImage.mockResolvedValueOnce(null);
    const interaction = makeInteraction();
    await dogCmd.run({ interaction, client: {} });
    const { handleAnimalError } = require('../../../src/utils/animalHelpers');
    expect(handleAnimalError).toHaveBeenCalled();
  });

  it('handles API error', async () => {
    const { fetchRandomAnimalImage } = require('../../../src/utils/animalHelpers');
    fetchRandomAnimalImage.mockRejectedValueOnce(new Error('API fail'));
    const interaction = makeInteraction();
    await dogCmd.run({ interaction, client: {} });
    const { handleAnimalError } = require('../../../src/utils/animalHelpers');
    expect(handleAnimalError).toHaveBeenCalled();
  });
});
