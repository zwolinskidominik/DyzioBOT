export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const embedBuilder = () => ({ __embed: true, addFields: jest.fn(function(){ return this; }) });
const embedFactory = jest.fn((args?: any) => Object.assign(embedBuilder(), args));
jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const guild = { name: 'G', iconURL: jest.fn(() => 'icon') };
  const options = {
    getString: jest.fn((name: string) => {
      const map: Record<string, string | null> = {
        tytul: 'T', opis: 'O', kolor: '#123456', tytul2: 'T2', opis2: 'O2', tytul3: 'T3', opis3: 'O3',
      };
      return map[name] ?? null;
    }),
  };
  const interaction: any = { deferReply, editReply, guild, options };
  return Object.assign(interaction, over);
};

describe('misc/embed command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('builds embed with custom color and adds 2 fields', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/embed');
      await run({ interaction, client: {} as any });
      expect(embedFactory).toHaveBeenCalledWith(expect.objectContaining({ color: '#123456', title: 'T', description: 'O' }));
      const embed = (interaction.editReply as jest.Mock).mock.calls[0][0].embeds[0];
      expect(embed).toEqual(expect.objectContaining({ __embed: true }));
    });
  });

  test('guild check: no guild -> early message', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction({ guild: null });
      const { run } = await import('../../../../src/commands/misc/embed');
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('tylko na serwerze') }));
    });
  });
});
