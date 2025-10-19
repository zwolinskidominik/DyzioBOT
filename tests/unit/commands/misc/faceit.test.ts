export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../../src/config', () => ({
  __esModule: true,
  env: () => ({ FACEIT_API_KEY: 'key' }),
}));

jest.mock('../../../../src/config/bot', () => ({
  __esModule: true,
  getBotConfig: () => ({
    emojis: {
      faceit: {
        cry: ':(' ,
        checkmark: '✅',
        crossmark: '❌',
        levels: { 1: '<:l1:1>', 10: '<:l10:10>' },
      },
    },
  }),
}));

const embedFactory = jest.fn((args?: any) => ({
  __embed: true,
  addFields: jest.fn(function () { return this; }),
  setFooter: jest.fn(function () { return this; }),
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

const request = jest.fn();
jest.mock('undici', () => ({ request: (...args: any[]) => request(...args) }));

const ok = (json: any) => ({ statusCode: 200, body: { json: async () => json } });
const notFound = () => ({ statusCode: 404, body: { json: async () => ({}) } });
const notOk = (code = 500) => ({ statusCode: code, body: { json: async () => ({}) } });

const buildInteraction = () => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = { getString: jest.fn(() => 'nick') };
  const interaction: any = {
    deferReply,
    editReply,
    options,
    client: { application: { id: 'bot' } },
  };
  return interaction;
};

const samplePlayer = {
  nickname: 'nick',
  country: 'pl',
  avatar: 'a',
  activated_at: '2020-01-01T00:00:00Z',
  player_id: 'pid',
  games: { cs2: { skill_level: 10, faceit_elo: 2500 } },
  steam_id_64: '123',
};

const sampleStats = {
  lifetime: {
    'Total Kills with extended stats': '1000',
    'Total Matches': '100',
    Matches: '100',
    'Win Rate %': '55',
    'Recent Results': ['1', '0', '1'],
    'Longest Win Streak': '7',
    'Average Headshots %': '45',
    'Average K/D Ratio': '1.2',
  },
};

describe('misc/faceit command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('player 404 -> shows cry message', async () => {
    jest.isolateModules(async () => {
      request.mockResolvedValueOnce(notFound());
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/faceit');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono gracza'));
    });
  });

  test('stats 404 -> shows cry message', async () => {
    jest.isolateModules(async () => {
      request.mockResolvedValueOnce(ok(samplePlayer));
      request.mockResolvedValueOnce(notFound());
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/faceit');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Nie znaleziono statystyk'));
    });
  });

  test('non-200 from API -> throws and logs', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      request.mockResolvedValueOnce(notOk(500));
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/faceit');
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('Wystąpił błąd'));
    });
  });

  test('happy path 200->200 builds embed with emojis and fields', async () => {
    jest.isolateModules(async () => {
      request.mockResolvedValueOnce(ok(samplePlayer));
      request.mockResolvedValueOnce(ok(sampleStats));
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/faceit');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })], components: [expect.any(Object)] })
      );
      // Level emoji from config mapping
      expect(embedFactory).toHaveBeenCalledWith(expect.objectContaining({ color: expect.any(String) }));
    });
  });
});
