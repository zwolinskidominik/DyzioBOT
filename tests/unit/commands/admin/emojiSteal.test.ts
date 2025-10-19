export {};

// Mocks
jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ __embed: true, ...args })),
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const followUp = jest.fn().mockResolvedValue(undefined);
  const options = { getString: jest.fn() };
  const guild = {
    emojis: {
      cache: { size: 0 },
      create: jest.fn(),
    },
  };
  return {
    deferReply,
    editReply,
    followUp,
    options,
    guild,
  } as any;
};

// Helpers
const valid = (name: string, id: string, animated = false) => `<${animated ? 'a' : ''}:${name}:${id}>`;

describe('admin/emoji-steal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('limit reached immediately -> short-circuit', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      interaction.guild.emojis.cache.size = 150; // remaining = 0
      interaction.options.getString.mockImplementation((name: string) =>
        name === 'emojis' ? `${valid('ok', '1')}` : null
      );
      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith('Limit emoji (150) osiągnięty.');
      expect(interaction.guild.emojis.create).not.toHaveBeenCalled();
    });
  });

  test('parsing tokens: invalid tokens produce errors; partial successes', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      interaction.guild.emojis.cache.size = 10; // remaining = 140
      // mix of invalid and valid tokens
      const tokens = [
        'bad',
        valid('smile', '111'),
        'nope',
        valid('wave', '222'),
        valid('dance', '333', true),
        '!!',
      ];
      interaction.options.getString.mockImplementation((name: string) =>
        name === 'emojis' ? tokens.join(' ') : null
      );
      // emojis.create succeeds for each valid call
      interaction.guild.emojis.create.mockImplementation(async ({ name }: any) => ({ name, toString: () => `:${name}:` }));

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });

      // create should be called 3 times for 3 valid tokens
      expect(interaction.guild.emojis.create).toHaveBeenCalledTimes(3);

      // final embed should be sent with summary and failures section
      const finalCall = interaction.editReply.mock.calls.find((args: any[]) => args[0]?.embeds?.[0]?.title === 'Wynik dodawania emoji');
      expect(finalCall).toBeTruthy();
      expect(finalCall[0].embeds[0].description).toEqual(expect.stringContaining('Podsumowanie'));
      expect(finalCall[0].embeds[0].description).toEqual(expect.stringContaining('Niepowodzenia'));
    });
  });

  test('checkRemainingSlots warns and extra tokens report "Limit osiągnięty."', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      // remaining = 2
      interaction.guild.emojis.cache.size = 148;
      const tokens = [valid('one', '1'), valid('two', '2'), valid('three', '3')];
      interaction.options.getString.mockImplementation((name: string) => (name === 'emojis' ? tokens.join(' ') : null));
      interaction.guild.emojis.create.mockResolvedValue({ toString: () => ':x:' });

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });

      // Warning content call
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Dodam tylko pierwsze 2') })
      );

      // Final embed contains 'Limit osiągnięty.' text for overflow
      const finalCall = interaction.editReply.mock.calls.find((args: any[]) => args[0]?.embeds?.[0]?.title === 'Wynik dodawania emoji');
      expect(finalCall[0].embeds[0].description).toEqual(expect.stringContaining('Limit osiągnięty'));
    });
  });

  test('error mapping for known create() errors', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      interaction.guild.emojis.cache.size = 0;
      const tokens = [valid('max', '11'), valid('bad', '22'), valid('unknown', '33')];
      interaction.options.getString.mockImplementation((name: string) => (name === 'emojis' ? tokens.join(' ') : null));

      // Sequence of rejections with known messages
      const errors = [
        new Error('Maximum number of emojis reached'),
        new Error('Invalid Form Body: name'),
        new Error('Unknown Emoji'),
      ];
      let idx = 0;
      interaction.guild.emojis.create.mockImplementation(() => Promise.reject(errors[idx++]));

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });

      const finalCall = interaction.editReply.mock.calls.find((args: any[]) => args[0]?.embeds?.[0]?.title === 'Wynik dodawania emoji');
      const desc = finalCall[0].embeds[0].description as string;
      expect(desc).toEqual(expect.stringContaining('Osiągnięto maksymalną liczbę emoji.'));
      expect(desc).toEqual(expect.stringContaining('Niepoprawny format emoji.'));
      expect(desc).toEqual(expect.stringContaining('Nie znaleziono emoji.'));
    });
  });

  test('progress updates every 5 items and at the end', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      interaction.guild.emojis.cache.size = 0;
      // 11 invalid tokens (to avoid calling create)
      const tokens = Array.from({ length: 11 }).map((_, i) => `bad${i + 1}`);
      interaction.options.getString.mockImplementation((name: string) => (name === 'emojis' ? tokens.join(' ') : null));

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });

      // filter progress embed calls by title
      const progressCalls = interaction.editReply.mock.calls.filter((args: any[]) => args[0]?.embeds?.[0]?.title?.startsWith('Dodawanie emoji'));
      // Expected at processed 1/11, 6/11, 11/11 => 3 calls
      expect(progressCalls.length).toBe(3);
      const titles = progressCalls.map((c: any[]) => c[0].embeds[0].title);
      expect(titles).toEqual(expect.arrayContaining(['Dodawanie emoji (1/11)', 'Dodawanie emoji (6/11)', 'Dodawanie emoji (11/11)']))
    });
  });
});
