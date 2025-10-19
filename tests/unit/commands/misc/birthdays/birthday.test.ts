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

const BirthdayModelMock: any = { findOne: jest.fn() };
jest.mock('../../../../../src/models/Birthday', () => ({
  __esModule: true,
  BirthdayModel: BirthdayModelMock,
}));

const buildInteraction = (over?: Partial<any>) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = { getUser: jest.fn(() => null) };
  const user = { id: 'u1', toString: () => '<@u1>' } as any;
  const client = { application: { id: 'bot-id' } } as any;
  return { reply, deferReply, editReply, options, user, client, ...over } as any;
};

describe('misc/birthdays: /birthday', () => {
  beforeEach(() => jest.clearAllMocks());

  test('brak guildId → ephem błąd', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../../src/commands/misc/birthdays/birthday');
      const interaction = buildInteraction({ guild: null });
      await run({ interaction, client: interaction.client });
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: expect.any(Number) }));
      const arg = (interaction.reply as jest.Mock).mock.calls[0][0];
      expect(arg.embeds?.[0]?.description || '').toMatch(/tylko na serwerze/i);
    });
  });

  test('brak wpisu → komunikat z odnośnikami do komend', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/birthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      await run({ interaction, client: interaction.client });
      expect(interaction.deferReply).toHaveBeenCalled();
      const arg = (interaction.editReply as jest.Mock).mock.calls[0][0];
      const desc = arg.embeds?.[0]?.description || '';
      expect(desc).toMatch(/birthday-remember/i);
      expect(desc).toMatch(/birthday-set-user/i);
      const fields = arg.embeds?.[0]?._fields || [];
      expect(fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: expect.stringMatching(/Przykłady/i) })]));
    });
  });

  test('istnieje wpis: dzisiaj (yearSpecified=true vs false)', async () => {
    await jest.isolateModules(async () => {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const makeDoc = (yearSpecified: boolean) => ({ userId: 'u1', guildId: 'g1', date: new Date(dateStr), yearSpecified });
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.findOne as jest.Mock)
        .mockReturnValueOnce({ exec: () => Promise.resolve(makeDoc(true)) })
        .mockReturnValueOnce({ exec: () => Promise.resolve(makeDoc(false)) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/birthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      await run({ interaction, client: interaction.client });
      let arg = (interaction.editReply as jest.Mock).mock.calls.pop()[0];
      expect(arg.embeds?.[0]?.description || '').toMatch(/są dziś/i);
      expect(arg.embeds?.[0]?.description || '').toMatch(/\*\*\d+\*\*/); // age bold
      await run({ interaction, client: interaction.client });
      arg = (interaction.editReply as jest.Mock).mock.calls.pop()[0];
      expect(arg.embeds?.[0]?.description || '').toMatch(/są dziś/i);
      expect(arg.embeds?.[0]?.description || '').toMatch(/Urodziny/); // without age prefix
    });
  });

  test('istnieje wpis: przyszłość (1 dzień): yearSpecified true -> liczba lat; false -> "Następne"', async () => {
    await jest.isolateModules(async () => {
      const today = new Date();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate()+1);
      const base = `${String(tomorrow.getMonth()+1).padStart(2,'0')}-${String(tomorrow.getDate()).padStart(2,'0')}`;
      const withYear = new Date(`${today.getFullYear()-20}-${base}`);
      const withoutYear = new Date(`1970-${base}`);
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.findOne as jest.Mock)
        .mockReturnValueOnce({ exec: () => Promise.resolve({ userId: 'u1', guildId: 'g1', date: withYear, yearSpecified: true }) })
        .mockReturnValueOnce({ exec: () => Promise.resolve({ userId: 'u1', guildId: 'g1', date: withoutYear, yearSpecified: false }) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/birthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      await run({ interaction, client: interaction.client });
      let desc = ((interaction.editReply as jest.Mock).mock.calls.pop()[0].embeds[0].description) as string;
      expect(desc).toMatch(/za \*\*1\*\* dzień/);
      expect(desc).toMatch(/\*\*\d+\*\* urodziny/);
      await run({ interaction, client: interaction.client });
      desc = ((interaction.editReply as jest.Mock).mock.calls.pop()[0].embeds[0].description) as string;
      expect(desc).toMatch(/za \*\*1\*\* dzień/);
      expect(desc).toMatch(/\*\*Następne\*\*/);
    });
  });

  test('catch → błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../../src/utils/logger')).default as any;
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.reject(new Error('db')) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/birthday');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      await run({ interaction, client: interaction.client });
      expect(logger.error).toHaveBeenCalled();
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      expect(arg.embeds?.[0]?.description || '').toMatch(/Wystąpił błąd/i);
    });
  });
});
