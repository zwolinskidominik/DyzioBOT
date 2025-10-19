export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const embedFactory = jest.fn((args?: any) => ({
  __embed: true,
  addFields: jest.fn(function () {
    return this;
  }),
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const guild = {
    id: 'g1',
    name: 'Guild',
    ownerId: 'owner',
    memberCount: 10,
    roles: { cache: { size: 5 } },
    emojis: { cache: { size: 2 } },
    createdTimestamp: 1700000000000,
    premiumSubscriptionCount: 0,
    verificationLevel: 2,
    iconURL: jest.fn(() => 'http://icon'),
  };
  const member = { joinedAt: new Date(1701000000000) };
  const interaction: any = { reply, guild, member };
  return Object.assign(interaction, over);
};

describe('misc/serverinfo command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path: replies with embed including fields', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/serverinfo');
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
      );
      expect(embedFactory).toHaveBeenCalled();
    });
  });

  test('inner catch: missing joinedAt -> ephemeral error reply', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction({ member: { joinedAt: null } });
      const { run } = await import('../../../../src/commands/misc/serverinfo');
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.any(Number), content: expect.stringContaining('Nie udało się pobrać daty dołączenia') })
      );
    });
  });

  test('outer catch: throws before reply -> logs and replies ephemeral error', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      const interaction = buildInteraction();
      // Force outer try-catch by making interaction.reply throw synchronously
      interaction.reply = jest.fn().mockRejectedValue(new Error('network'));
      const { run } = await import('../../../../src/commands/misc/serverinfo');
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      // It attempts to reply with an error, but ignore .catch; ensure a call was attempted
      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
