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
  const reply = jest.fn().mockResolvedValue(undefined);
  const guild = { name: 'G', iconURL: jest.fn(() => 'icon') };
  const user = { id: 'u', tag: 'User#0001', displayAvatarURL: jest.fn(() => 'http://avatar.png') };
  const options = { getUser: jest.fn(() => null) };
  const interaction: any = { reply, guild, user, options };
  return Object.assign(interaction, over);
};

describe('misc/avatar command', () => {
  beforeEach(() => jest.clearAllMocks());

  test('happy: builds embed with image and footer', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/avatar');
      await run({ interaction, client: {} as any });
      expect(embedFactory).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining('Avatar użytkownika'), image: 'http://avatar.png' })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
      );
    });
  });

  test('catch: throws -> ephemeral error reply', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      const interaction = buildInteraction({ options: { getUser: jest.fn(() => { throw new Error('X'); }) } });
      const { run } = await import('../../../../src/commands/misc/avatar');
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.any(Number), content: expect.stringContaining('Wystąpił błąd') })
      );
    });
  });
});
