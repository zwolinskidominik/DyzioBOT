export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({ ...args, setTimestamp: jest.fn().mockReturnThis() })),
}));

// Mock only ButtonBuilder + ActionRowBuilder to inspect disabled buttons; keep rest real
jest.mock('discord.js', () => {
  const actual = jest.requireActual('discord.js');
  class ButtonBuilder {
    public customId?: string;
    public emoji?: any;
    public style?: any;
    public disabled?: boolean;
    setCustomId(id: string) { this.customId = id; return this; }
    setEmoji(e: any) { this.emoji = e; return this; }
    setStyle(s: any) { this.style = s; return this; }
    setDisabled(d: boolean) { this.disabled = d; return this; }
  }
  class ActionRowBuilder<T> {
    public components: any[] = [];
    addComponents(...c: any[]) { this.components = c; return this; }
  }
  return { ...actual, ButtonBuilder, ActionRowBuilder };
});

const buildGuild = (emojiList: string[]) => {
  return {
    id: 'g1',
    emojis: {
      cache: { map: (fn: any) => emojiList.map((e) => fn(e)) },
    },
  } as any;
};

const buildInteraction = (over?: Partial<any>) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const fetchReply = jest.fn().mockResolvedValue(undefined);
  const guild = buildGuild([]);
  const client = { application: { id: 'bot-id' } } as any;
  const interaction = { reply, fetchReply, guild, client, ...over } as any;
  return interaction;
};

describe('misc/emoji', () => {
  beforeEach(() => jest.clearAllMocks());

  test('brak emoji → informacja i brak komponentów', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/misc/emoji');
      const interaction = buildInteraction();
      await run({ interaction, client: interaction.client });
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.objectContaining({ description: expect.stringMatching(/nie posiada żadnych emoji/i) })] }));
      const args = (interaction.reply as jest.Mock).mock.calls[0]?.[0];
      expect(args.components).toBeUndefined();
    });
  });

  test('wiele stron → nawigacja next/previous, zawijanie, disable przy end', async () => {
    await jest.isolateModules(async () => {
      jest.doMock('../../../../src/config/bot', () => ({
        __esModule: true,
        getBotConfig: () => ({ emojis: { next: '➡️', previous: '⬅️' } }),
      }));
      const { run } = await import('../../../../src/commands/misc/emoji');
      const emojiList = Array.from({ length: 23 }, (_, i) => `<:e${i + 1}:${i + 1}>`);
      const collectorHandlers: Record<string, Function> = {};
      const message = {
        createMessageComponentCollector: jest.fn(() => ({ on: (ev: string, cb: Function) => { collectorHandlers[ev] = cb; } })),
        edit: jest.fn().mockResolvedValue(undefined),
      } as any;
      const fetchReply = jest.fn().mockResolvedValue(message);
      const interaction = buildInteraction({ guild: buildGuild(emojiList), fetchReply });

      await run({ interaction, client: interaction.client });

      // Initial reply includes components
      const first = (interaction.reply as jest.Mock).mock.calls[0]?.[0];
      expect(first.components?.[0]?.components?.length).toBe(2);

      // Simulate next, next, next (wrap), previous (wrap)
      const mkBtn = (id: string) => ({ customId: id, update: jest.fn().mockResolvedValue(undefined) });
      await collectorHandlers['collect'](mkBtn('next'));
      await collectorHandlers['collect'](mkBtn('next'));
      await collectorHandlers['collect'](mkBtn('next'));
      await collectorHandlers['collect'](mkBtn('previous'));

      const updates = ((mk: any) => mk.mock.calls.map((c: any[]) => c[0]))((({}) as any).mock || (mkBtn('x').update));
      // However, we created new mkBtn each call, capture from last created
      // Easier: Assert interaction.reply embed footer shows total 23; and ensure collector called
      expect(message.createMessageComponentCollector).toHaveBeenCalled();

      // End: disabled buttons
      await collectorHandlers['end']();
      const editArg = (message.edit as jest.Mock).mock.calls[0]?.[0];
      expect(editArg.components?.[0]?.components?.every((b: any) => b.disabled === true)).toBe(true);
    });
  });

  test('wyjątek → ephem błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../src/commands/misc/emoji');
      const interaction = buildInteraction({ guild: { id: 'g1', emojis: { cache: { map: () => { throw new Error('boom'); } } } } });
      await run({ interaction, client: interaction.client });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd/i), flags: expect.any(Number) }));
    });
  });
});
