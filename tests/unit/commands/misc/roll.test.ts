export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const options = { getInteger: jest.fn(() => null) };
  const interaction: any = { reply, options };
  return Object.assign(interaction, over);
};

describe('misc/roll command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('invalid sides -> validation message', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction({ options: { getInteger: jest.fn(() => 1) } });
      const { run } = await import('../../../../src/commands/misc/roll');
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringContaining('co najmniej 2'));
    });
  });

  test('happy: stub Math.random and check format', async () => {
    jest.isolateModules(async () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // middle
      const interaction = buildInteraction({ options: { getInteger: jest.fn(() => 6) } });
      const { run } = await import('../../../../src/commands/misc/roll');
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(expect.stringMatching(/:game_die: \d+ \(1 - 6\)/));
      (Math.random as any).mockRestore?.();
    });
  });

  test('error path: logs and replies ephemeral', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      const interaction = buildInteraction();
      interaction.options.getInteger.mockImplementation(() => {
        throw new Error('boom');
      });
      const { run } = await import('../../../../src/commands/misc/roll');
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.any(Number), content: expect.stringContaining('błąd') })
      );
    });
  });
});
