export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const embedFactory = jest.fn((args?: any) => ({ __embed: true, ...args }));
jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const fetchReply = jest.fn().mockResolvedValue({ createdTimestamp: 2000 });
  const editReply = jest.fn().mockResolvedValue(undefined);
  const interaction: any = {
    deferReply,
    fetchReply,
    editReply,
    createdTimestamp: 1000,
  };
  return Object.assign(interaction, over);
};

describe('misc/ping command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('happy: computes client and ws ping and edits reply', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      const client = { ws: { ping: 42 } } as any;
      const { run } = await import('../../../../src/commands/misc/ping');
      await run({ interaction, client });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.fetchReply).toHaveBeenCalled();
      expect(embedFactory).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringContaining('**Klient:** 1000ms') })
      );
      expect(embedFactory).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringContaining('**Websocket:** 42ms') })
      );
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
    });
  });

  test('error path: logs and attempts error embed', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      const interaction = buildInteraction({ deferReply: jest.fn().mockRejectedValue(new Error('fail')) });
      const client = { ws: { ping: 1 } } as any;
      const { run } = await import('../../../../src/commands/misc/ping');
      await run({ interaction, client });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });
});
