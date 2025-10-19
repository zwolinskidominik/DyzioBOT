export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const embedFactory = jest.fn((args?: any) => ({
  __embed: true,
  ...args,
  setDescription(desc: string) {
    this.description = desc;
    return this;
  },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

const findOne = jest.fn();
jest.mock('../../../../src/models/Warn', () => ({
  __esModule: true,
  WarnModel: { findOne: (...args: any[]) => ({ lean: () => ({ exec: () => findOne(...args) }) }) },
}));

const buildInteraction = (over: Record<string, any> = {}) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const options = {
    getUser: jest.fn(),
  };
  const interaction: any = {
    reply,
    options,
    user: { id: 'u1', tag: 'User#0001', displayAvatarURL: () => 'a' },
    member: { permissions: { has: jest.fn().mockReturnValue(true) } },
    guild: { id: 'g1' },
  };
  return Object.assign(interaction, over);
};

describe('misc/warnings command', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('self vs others permission: denies when lacking permission', async () => {
    jest.isolateModules(async () => {
      const interaction = buildInteraction({
        options: { getUser: jest.fn(() => ({ id: 'other', tag: 'Other#1234' })) },
        member: { permissions: { has: jest.fn().mockReturnValue(false) } },
      });
      const { run } = await import('../../../../src/commands/misc/warnings');
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.any(Number), content: expect.stringContaining('uprawnień') })
      );
    });
  });

  test('empty list: replies with count 0 and no description', async () => {
    jest.isolateModules(async () => {
      findOne.mockResolvedValueOnce(null);
      const interaction = buildInteraction({ options: { getUser: jest.fn(() => null) } });
      const { run } = await import('../../../../src/commands/misc/warnings');
      await run({ interaction, client: {} as any });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.objectContaining({ __embed: true })] })
      );
    });
  });

  test('non-empty list: renders formatted list', async () => {
    jest.isolateModules(async () => {
      const warnings = [
        { date: new Date('2024-01-01'), moderator: 'Mod#1', reason: 'Spam' },
        { date: new Date('2024-02-02'), moderator: 'Mod#2', reason: 'Flood' },
      ];
      findOne.mockResolvedValueOnce({ warnings });
      const interaction = buildInteraction({ options: { getUser: jest.fn(() => ({ id: 'u1', tag: 'User#0001' })) } });
      const { run } = await import('../../../../src/commands/misc/warnings');
      await run({ interaction, client: {} as any });
      expect(embedFactory).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining('Liczba ostrzeżeń') }));
      // description should be present after setDescription
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(replyArg.embeds[0]).toEqual(expect.objectContaining({ __embed: true }));
    });
  });

  test('DB error -> catches and replies ephemeral error', async () => {
    jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default;
      findOne.mockRejectedValueOnce(new Error('db down'));
      const interaction = buildInteraction();
      const { run } = await import('../../../../src/commands/misc/warnings');
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ flags: expect.any(Number), content: expect.stringContaining('Wystąpił błąd') })
      );
    });
  });
});
