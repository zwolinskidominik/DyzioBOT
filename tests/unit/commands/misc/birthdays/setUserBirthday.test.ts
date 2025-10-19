export {};

jest.mock('../../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({
    ...args,
    setDescription(this: any, d: string) { this.description = d; return this; },
    addFields: jest.fn(function (this: any, ...f: any[]) { this._fields = [...(this._fields||[]), ...f]; return this; }),
    setTimestamp: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('../../../../../src/config/bot', () => ({
  __esModule: true,
  getBotConfig: () => ({ emojis: { birthday: '🎂' } }),
}));

const BirthdayModelMock: any = { findOneAndUpdate: jest.fn() };
jest.mock('../../../../../src/models/Birthday', () => ({
  __esModule: true,
  BirthdayModel: BirthdayModelMock,
}));

const buildInteraction = (over?: Partial<any>) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = { getString: jest.fn(), getUser: jest.fn(() => ({ id: 'u2', toString: () => '<@u2>' })) };
  const member = { permissions: { has: jest.fn(() => true) } } as any;
  const user = { id: 'u1', toString: () => '<@u1>' } as any;
  const client = { application: { id: 'bot-id' } } as any;
  return { reply, deferReply, editReply, options, member, user, client, ...over } as any;
};

describe('misc/birthdays: /birthday-set-user', () => {
  beforeEach(() => jest.clearAllMocks());

  test('brak guildId → ephem błąd', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../../src/commands/misc/birthdays/setUserBirthday');
      const interaction = buildInteraction({ guild: null });
      await run({ interaction, client: interaction.client });
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.any(Number) }));
    });
  });


  test('próba ustawienia sobie → błąd', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../../src/commands/misc/birthdays/setUserBirthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      interaction.options.getUser.mockReturnValue({ id: 'u1', toString: () => '<@u1>' });
      interaction.options.getString.mockReturnValue('01-01');
      await run({ interaction, client: interaction.client });
  const arg = (interaction.reply as jest.Mock).mock.calls[0][0];
  expect(arg.embeds?.[0]?.description || '').toMatch(/birthday-remember/i);
    });
  });

  test('walidacja: z rokiem i bez roku → upsert OK i komunikaty', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: () => Promise.resolve({}) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/setUserBirthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });

  interaction.options.getString.mockReturnValue('01-01-2000');
      await run({ interaction, client: interaction.client });
  let arg = (interaction.editReply as jest.Mock).mock.calls.pop()[0];
  const desc1 = arg.embeds?.[0]?.description || '';
  expect(desc1).toMatch(/Zanotowano/i);
  expect(desc1).toMatch(/\*\*\d+\*\* urodziny/);

      interaction.options.getString.mockReturnValue('01-01');
      await run({ interaction, client: interaction.client });
  arg = (interaction.editReply as jest.Mock).mock.calls.pop()[0];
  const desc2 = arg.embeds?.[0]?.description || '';
  expect(desc2).toMatch(/Zanotowano/i);
  expect(desc2).toMatch(/\*\*Następne\*\*/);
    });
  });

  test('nieprawidłowy format → komunikat błędu', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../../src/commands/misc/birthdays/setUserBirthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      interaction.options.getString.mockReturnValue('invalid');
      interaction.options.getUser.mockReturnValue({ id: 'u2', toString: () => '<@u2>' });
      await run({ interaction, client: interaction.client });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), flags: expect.any(Number) })
      );
    });
  });

  test('catch → błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../../src/utils/logger')).default as any;
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.findOneAndUpdate as jest.Mock).mockReturnValue({ exec: () => Promise.reject(new Error('db')) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/setUserBirthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      interaction.options.getString.mockReturnValue('01-01');
      await run({ interaction, client: interaction.client });
      expect(logger.error).toHaveBeenCalled();
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      expect(arg.embeds?.[0]?.description || '').toMatch(/Wystąpił błąd/i);
    });
  });
});
