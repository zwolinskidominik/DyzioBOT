export {};

import { MessageFlags } from 'discord.js';

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn((args?: any) => {
    const obj: any = { ...args, addFields: jest.fn(function (this: any, ...f: any[]) {
      this._fields = [...(this._fields || []), ...f];
      return this;
    }), setTimestamp: jest.fn().mockReturnThis() };
    return obj;
  }),
}));

const FortuneModelMock: any = { create: jest.fn() };
jest.mock('../../../../src/models/Fortune', () => ({
  __esModule: true,
  FortuneModel: FortuneModelMock,
}));

const buildInteraction = (over?: Partial<any>) => {
  const deferReply = jest.fn().mockResolvedValue(undefined);
  const editReply = jest.fn().mockResolvedValue(undefined);
  const options = {
    getString: jest.fn((name: string) => (name === 'tekst' ? 'Nowa wróżba' : null)),
  };
  const user = { id: 'u1', tag: 'user#0001', displayAvatarURL: () => 'http://a' } as any;
  return { deferReply, editReply, options, user, ...over } as any;
};

describe('admin/fortuneAdd', () => {
  beforeEach(() => jest.clearAllMocks());

  test('brak tekstu → błąd', async () => {
    await jest.isolateModules(async () => {
      const { run } = await import('../../../../src/commands/admin/fortuneAdd');
      const interaction = buildInteraction({ options: { getString: jest.fn(() => '') } });
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Nie podano/i) }));
      expect(FortuneModelMock.create).not.toHaveBeenCalled();
    });
  });

  test('create OK → embed z treścią', async () => {
    await jest.isolateModules(async () => {
      const { FortuneModel } = await import('../../../../src/models/Fortune');
      (FortuneModel.create as jest.Mock).mockResolvedValue({ content: 'Nowa wróżba', addedBy: 'u1' });
      const { run } = await import('../../../../src/commands/admin/fortuneAdd');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
      const call = (interaction.editReply as jest.Mock).mock.calls.pop()?.[0];
      expect(call.embeds?.[0]).toBeDefined();
      const fields = (call.embeds[0] as any)._fields || [];
      expect(fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Treść', value: 'Nowa wróżba' })]));
    });
  });

  test('create rzuca → editReply błąd + log', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      const { FortuneModel } = await import('../../../../src/models/Fortune');
      (FortuneModel.create as jest.Mock).mockRejectedValue(new Error('db'));
      const { run } = await import('../../../../src/commands/admin/fortuneAdd');
      const interaction = buildInteraction();
      await run({ interaction, client: {} as any });
      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringMatching(/Wystąpił błąd/i) }));
    });
  });
});
