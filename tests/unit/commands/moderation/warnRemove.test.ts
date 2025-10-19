export {};

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

// Minimal embed capturing like in warn tests
const embedInstance = () => {
  const inst = {
    setDescription: jest.fn(function (this: any) { return this; }),
    setFooter: jest.fn(function (this: any) { return this; }),
    setThumbnail: jest.fn(function (this: any) { return this; }),
    _desc: '',
  } as any;
  const orig = inst.setDescription;
  inst.setDescription = jest.fn(function (this: any, desc: string) { this._desc = desc; return this; });
  (global as any).__warnRemoveLastEmbed = inst;
  return inst;
};

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((opts?: any) => {
    const inst = embedInstance();
    if (opts?.description) inst.setDescription(opts.description);
    if (opts?.footerText) inst.setFooter({ text: opts.footerText, iconURL: opts.footerIcon || undefined });
    if (opts?.thumbnail) inst.setThumbnail(opts.thumbnail);
    return inst;
  }),
}));

// Mock WarnModel
const warnCtor: any = jest.fn(function (this: any, props: any) {
  Object.assign(this, props);
  this.warnings = this.warnings || [];
  this.save = jest.fn().mockResolvedValue(undefined);
});
warnCtor.findOne = jest.fn();

jest.mock('../../../../src/models/Warn', () => ({
  __esModule: true,
  WarnModel: warnCtor,
}));

describe('commands/moderation/warnRemove', () => {
  const buildInteraction = (overrides: Record<string, any> = {}) => {
    const reply = jest.fn();
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const guild = { id: 'g1', name: 'Guild' } as any;
    const baseOptions = {
      getUser: jest.fn((name: string) => ({ id: 'target', displayAvatarURL: jest.fn(() => 'url') } as any)),
      getInteger: jest.fn((name: string) => 1),
    };
    const mergedOptions = { ...baseOptions, ...(overrides.options || {}) };
    const base = { reply, deferReply, editReply, guild, options: mergedOptions } as any;
    return { ...base, ...overrides, options: mergedOptions } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__warnRemoveLastEmbed = undefined;
  });

  test('brak rekordu → error embed', async () => {
    await jest.isolateModules(async () => {
      warnCtor.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const { run } = await import('../../../../src/commands/moderation/warnRemove');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
  const embed = (interaction.editReply as jest.Mock).mock.calls[0][0].embeds[0];
  expect(embed._desc).toMatch(/Użytkownik nie posiada żadnych ostrzeżeń\.|Wystąpił błąd podczas usuwania ostrzeżenia\./);
    });
  });

  test('id < 1 → error embed', async () => {
    await jest.isolateModules(async () => {
      const warn = { warnings: [{}, {}], save: jest.fn().mockResolvedValue(undefined) };
      warnCtor.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(warn) });
      const { run } = await import('../../../../src/commands/moderation/warnRemove');
      const interaction = buildInteraction();
      interaction.options.getUser = jest.fn(() => ({ id: 'target', displayAvatarURL: jest.fn(() => 'url') }));
      interaction.options.getInteger = jest.fn(() => 0);
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      const embed = (interaction.editReply as jest.Mock).mock.calls[0][0].embeds[0];
      expect(embed._desc).toMatch(/Nie znaleziono ostrzeżenia o ID: 0/);
    });
  });

  test('id > długości → error embed', async () => {
    await jest.isolateModules(async () => {
      const warn = { warnings: [{}, {}], save: jest.fn().mockResolvedValue(undefined) };
      warnCtor.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(warn) });
      const { run } = await import('../../../../src/commands/moderation/warnRemove');
      const interaction = buildInteraction();
      interaction.options.getUser = jest.fn(() => ({ id: 'target', displayAvatarURL: jest.fn(() => 'url') }));
      interaction.options.getInteger = jest.fn(() => 3);
      await run({ interaction, client: {} as any });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      const embed = (interaction.editReply as jest.Mock).mock.calls[0][0].embeds[0];
      expect(embed._desc).toMatch(/Nie znaleziono ostrzeżenia o ID: 3/);
    });
  });

  test('poprawne usunięcie i zapis → success embed', async () => {
    await jest.isolateModules(async () => {
  const warn = { warnings: [{ id: 1 }, { id: 2 }], save: jest.fn().mockResolvedValue(undefined) } as any;
  warnCtor.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(warn) });
      const { run } = await import('../../../../src/commands/moderation/warnRemove');
      const interaction = buildInteraction({ options: { getUser: jest.fn(() => ({ id: 'target', displayAvatarURL: jest.fn(() => 'url') })), getInteger: jest.fn(() => 2) } });
      await run({ interaction, client: {} as any });
      expect(warn.warnings.length).toBe(1);
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      const embed = (interaction.editReply as jest.Mock).mock.calls[0][0].embeds[0];
      expect(embed._desc).toContain('Ostrzeżenie o ID: 2 zostało usunięte');
    });
  });

  test('save rzuca → error embed + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
  const warn = { warnings: [{ id: 1 }, { id: 2 }], save: jest.fn().mockRejectedValue(new Error('fail')) } as any;
  warnCtor.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(warn) });
      const { run } = await import('../../../../src/commands/moderation/warnRemove');
      const interaction = buildInteraction({ options: { getUser: jest.fn(() => ({ id: 'target', displayAvatarURL: jest.fn(() => 'url') })), getInteger: jest.fn(() => 1) } });
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ embeds: [expect.any(Object)] }));
      const embed = (interaction.editReply as jest.Mock).mock.calls[0][0].embeds[0];
      expect(embed._desc).toContain('Wystąpił błąd podczas usuwania ostrzeżenia.');
    });
  });
});
