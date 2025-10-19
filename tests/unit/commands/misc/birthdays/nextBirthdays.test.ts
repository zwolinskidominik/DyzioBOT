export {};

jest.mock('../../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => ({
    ...args,
    setTitle: jest.fn(function (this: any, t: string) { this.title = t; return this; }),
    setDescription(this: any, d: string) { this.description = d; return this; },
    addFields: jest.fn(function (this: any, ...f: any[]) { this._fields = [...(this._fields||[]), ...f]; return this; }),
    setFooter: jest.fn(function (this: any, f: any) { this.footer = f; return this; }),
    setTimestamp: jest.fn().mockReturnThis(),
  })),
}));

jest.mock('../../../../../src/config/bot', () => ({
  __esModule: true,
  getBotConfig: () => ({ emojis: { birthday: '🎂' } }),
}));

const BirthdayModelMock: any = { find: jest.fn() };
jest.mock('../../../../../src/models/Birthday', () => ({
  __esModule: true,
  BirthdayModel: BirthdayModelMock,
}));

const buildInteraction = (over?: Partial<any>) => {
  const reply = jest.fn().mockResolvedValue(undefined);
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const user = { id: 'u1' } as any;
  const client = { users: { fetch: jest.fn() }, application: { id: 'bot-id' } } as any;
  return { reply, deferReply, editReply, user, client, ...over } as any;
};

describe('misc/birthdays: /birthdays-next', () => {
  beforeEach(() => jest.clearAllMocks());

  test('brak guildId → błąd po defer + editReply', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../../src/commands/misc/birthdays/nextBirthdays');
      const interaction = buildInteraction({ guild: null });
      await run({ interaction, client: interaction.client });
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalled();
    });
  });

  test('brak wpisów → pozytywny komunikat', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.find as jest.Mock).mockReturnValue({ sort: () => ({ exec: () => Promise.resolve([]) }) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/nextBirthdays');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      await run({ interaction, client: interaction.client });
  const arg = (interaction.editReply as jest.Mock).mock.calls[0][0];
  expect(arg.embeds?.[0]?.description || '').toMatch(/Brak zapisanych urodzin/i);
    });
  });

  test('poprawne sortowanie, limit 10, i "Dzisiaj!"', async () => {
    await jest.isolateModules(async () => {
      const today = new Date();
      const toLocaleSpy = jest
        .spyOn(Date.prototype as any, 'toLocaleDateString')
        .mockImplementation(function (this: Date) {
          const y = this.getFullYear();
          const m = String(this.getMonth() + 1).padStart(2, '0');
          const d = String(this.getDate()).padStart(2, '0');
          return `${d}.${m}.${y}`;
        });
      const mk = (i: number, daysFromToday: number) => {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysFromToday);
        return { userId: 'u'+i, guildId: 'g1', date: new Date(`${today.getFullYear()-20}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`), yearSpecified: true, active: true };
      };
      const entries = [0,1,2,3,4,5,6,7,8,9,10,11].map(i => mk(i, i===0?0:i));
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.find as jest.Mock).mockReturnValue({ sort: () => ({ exec: () => Promise.resolve(entries) }) });
      const { run } = await import('../../../../../src/commands/misc/birthdays/nextBirthdays');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
  (interaction.client.users.fetch as jest.Mock).mockImplementation(async (id: string) => ({ id, toString: () => `<@${id}>` }));
      await run({ interaction, client: interaction.client });
    const arg = (interaction.editReply as jest.Mock).mock.calls.pop()[0];
  const desc = arg.embeds?.[0]?.description || '';
  // Ensure the first 10 users are listed
  for (let i = 0; i < 10; i++) {
    expect(desc).toContain(`<@u${i}>`);
  }
      expect(desc).toMatch(/Dzisiaj!/);
  expect(arg.embeds?.[0]?.footer?.text).toMatch(/Łącznie zapisanych urodzin: 12/);
      toLocaleSpy.mockRestore();
    });
  });

  test('users.fetch rzuca -> pominięcie i warn', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.find as jest.Mock).mockReturnValue({ sort: () => ({ exec: () => Promise.resolve([{ userId: 'bad', guildId: 'g1', date: new Date(), yearSpecified: false }]) }) });
      const logger = (await import('../../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../../src/commands/misc/birthdays/nextBirthdays');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      (interaction.client.users.fetch as jest.Mock).mockRejectedValue(new Error('not found'));
      await run({ interaction, client: interaction.client });
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()[0];
  expect(arg.embeds?.[0]?.description || '').toMatch(/Nie udało się znaleźć żadnych nadchodzących urodzin/i);
    });
  });

  test('catch → błąd + log', async () => {
    await jest.isolateModules(async () => {
      const { BirthdayModel } = await import('../../../../../src/models/Birthday');
      (BirthdayModel.find as jest.Mock).mockReturnValue({ sort: () => ({ exec: () => Promise.reject(new Error('db')) }) });
      const logger = (await import('../../../../../src/utils/logger')).default as any;
      const { run } = await import('../../../../../src/commands/misc/birthdays/nextBirthdays');
      const interaction = buildInteraction({ guild: { id: 'g1' } });
      await run({ interaction, client: interaction.client });
      expect(logger.error).toHaveBeenCalled();
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      expect(arg.embeds?.[0]?.description || '').toMatch(/Wystąpił błąd/i);
    });
  });
});
