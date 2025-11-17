export {};

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

const valid = (name: string, id: string, animated = false) => `<${animated ? 'a' : ''}:${name}:${id}>`;

describe('admin/emoji-steal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('limit reached immediately -> short-circuit', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      interaction.guild.emojis.cache.size = 150;
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
      interaction.guild.emojis.cache.size = 10;
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
      interaction.guild.emojis.create.mockImplementation(async ({ name }: any) => ({ name, toString: () => `:${name}:` }));

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });
      expect(interaction.guild.emojis.create).toHaveBeenCalledTimes(3);
      const finalCall = interaction.editReply.mock.calls.find((args: any[]) => args[0]?.embeds?.[0]?.title === 'Wynik dodawania emoji');
      expect(finalCall).toBeTruthy();
      expect(finalCall[0].embeds[0].description).toEqual(expect.stringContaining('Podsumowanie'));
      expect(finalCall[0].embeds[0].description).toEqual(expect.stringContaining('Niepowodzenia'));
    });
  });

  test('checkRemainingSlots warns and extra tokens report "Limit osiągnięty."', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      interaction.guild.emojis.cache.size = 148;
      const tokens = [valid('one', '1'), valid('two', '2'), valid('three', '3')];
      interaction.options.getString.mockImplementation((name: string) => (name === 'emojis' ? tokens.join(' ') : null));
      interaction.guild.emojis.create.mockResolvedValue({ toString: () => ':x:' });

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('Dodam tylko pierwsze 2') })
      );
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
      const tokens = Array.from({ length: 11 }).map((_, i) => `bad${i + 1}`);
      interaction.options.getString.mockImplementation((name: string) => (name === 'emojis' ? tokens.join(' ') : null));

      const { run } = await import('../../../../src/commands/admin/emojiSteal');
      await run({ interaction, client: {} as any });

      const progressCalls = interaction.editReply.mock.calls.filter((args: any[]) => args[0]?.embeds?.[0]?.title?.startsWith('Dodawanie emoji'));
      expect(progressCalls.length).toBe(3);
      const titles = progressCalls.map((c: any[]) => c[0].embeds[0].title);
      expect(titles).toEqual(expect.arrayContaining(['Dodawanie emoji (1/11)', 'Dodawanie emoji (6/11)', 'Dodawanie emoji (11/11)']))
    });
  });
});
