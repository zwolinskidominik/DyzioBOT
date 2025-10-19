export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const embedFactory = jest.fn((args?: any) => ({
  ...args,
  addFields: jest.fn(function (this: any, ...f: any[]) {
    this._fields = [...(this._fields || []), ...f];
    return this;
  }),
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => embedFactory(args)),
}));

// Mock models
const FortuneModelMock: any = { find: jest.fn() };
const FortuneUsageModelCtor: any = jest.fn((data: any) => ({ ...data, save: jest.fn().mockResolvedValue(undefined) }));
FortuneUsageModelCtor.findOne = jest.fn();

jest.mock('../../../../src/models/Fortune', () => ({
  __esModule: true,
  FortuneModel: FortuneModelMock,
  FortuneUsageModel: FortuneUsageModelCtor,
}));

const buildInteraction = () => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const user = { id: 'u1' } as any;
  return { deferReply, editReply, user } as any;
};

describe('misc/wrozba', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('brak wróżb → warning log + komunikat', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      (FortuneModelMock.find as jest.Mock).mockReturnValue({ lean: () => ({ exec: () => Promise.resolve([]) }) });
      const { run } = await import('../../../../src/commands/misc/wrozba');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(logger.warn).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringMatching(/Brak wróżb/ ) })
      );
    });
  });

  test('limit dzienny = 2 → wyczerpanie limitu z czasem', async () => {
    await jest.isolateModules(async () => {
      (FortuneModelMock.find as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([{ content: 'X' }]) }),
      });
      (FortuneUsageModelCtor.findOne as jest.Mock).mockReturnValue({
        exec: () =>
          Promise.resolve({
            userId: 'u1',
            targetId: 'u1',
            lastUsedDay: new Date(),
            dailyUsageCount: 2,
            save: jest.fn(),
          }),
      });
      const { run } = await import('../../../../src/commands/misc/wrozba');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      expect(arg.content).toMatch(/Wykorzystałeś już limit wróżb/);
      expect(arg.content).toMatch(/\d+h i \d+ min\./);
    });
  });

  test('nowy dokument użycia → losowanie i embed z pozostałymi 1/2', async () => {
    await jest.isolateModules(async () => {
      (FortuneModelMock.find as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([{ content: 'A' }, { content: 'B' }]) }),
      });
      (FortuneUsageModelCtor.findOne as jest.Mock).mockReturnValue({ exec: () => Promise.resolve(null) });
      jest.spyOn(Math, 'random').mockReturnValue(0); // pick first fortune deterministically
      const { run } = await import('../../../../src/commands/misc/wrozba');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      const embed = arg.embeds?.[0] || {};
      const fields = embed._fields || [];
      const przep = fields.find((f: any) => f.name === 'Przepowiednia');
      const left = fields.find((f: any) => f.name === 'Pozostałe wróżby na dziś');
      expect(przep?.value).toBe('A');
      expect(left?.value).toBe('1/2');
      (Math.random as any).mockRestore?.();
    });
  });

  test('istniejący dokument z wczoraj → reset licznika i 1/2', async () => {
    await jest.isolateModules(async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      (FortuneModelMock.find as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([{ content: 'C' }]) }),
      });
      const save = jest.fn().mockResolvedValue(undefined);
      (FortuneUsageModelCtor.findOne as jest.Mock).mockReturnValue({
        exec: () =>
          Promise.resolve({
            userId: 'u1',
            targetId: 'u1',
            lastUsedDay: yesterday,
            dailyUsageCount: 2,
            save,
          }),
      });
      const { run } = await import('../../../../src/commands/misc/wrozba');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      const embed = arg.embeds?.[0] || {};
      const fields = embed._fields || [];
      const left = fields.find((f: any) => f.name === 'Pozostałe wróżby na dziś');
      expect(left?.value).toBe('1/2');
      expect(save).toHaveBeenCalled();
    });
  });

  test('save rzuca → błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      (FortuneModelMock.find as jest.Mock).mockReturnValue({
        lean: () => ({ exec: () => Promise.resolve([{ content: 'A' }]) }),
      });
      (FortuneUsageModelCtor.findOne as jest.Mock).mockReturnValue({
        exec: () =>
          Promise.resolve({
            userId: 'u1',
            targetId: 'u1',
            lastUsedDay: new Date(),
            dailyUsageCount: 0,
            save: jest.fn().mockRejectedValue(new Error('db')),
          }),
      });
      const { run } = await import('../../../../src/commands/misc/wrozba');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      const arg = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      expect(arg.content).toMatch(/Wystąpił błąd/);
    });
  });
});
