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

const embedInstance = () => {
  const inst = {
    addFields: jest.fn(function (this: any, fields: any) {
      (this as any)._fields = fields;
      return this;
    }),
    _fields: undefined as any,
  } as any;
  (global as any).__warnLastEmbed = inst;
  return inst;
};

jest.mock('../../../../src/utils/embedHelpers', () => ({
  __esModule: true,
  createBaseEmbed: jest.fn(() => embedInstance()),
  formatWarnBar: jest.fn(() => '[bar]'),
}));

jest.mock('../../../../src/utils/moderationHelpers', () => ({
  __esModule: true,
  checkModPermissions: jest.fn(() => true),
}));

// Mock WarnModel with ctor + static findOne
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

describe('commands/moderation/warn', () => {
  const buildInteraction = (overrides: Record<string, any> = {}) => {
    const reply = jest.fn();
    const deferReply = jest.fn().mockResolvedValue(undefined);
    const editReply = jest.fn().mockResolvedValue(undefined);
    const guild = {
      id: 'g1',
      name: 'Guild',
      iconURL: jest.fn(() => 'icon'),
      members: {
        fetch: jest.fn(),
        me: { id: 'botMember' },
      },
    } as any;
    const user = { id: 'moderator', tag: 'Mod#0001' } as any;
    const client = { user: { id: 'bot123' } } as any;
    const options = {
      getUser: jest.fn((name: string) => ({ id: 'target', tag: 'Target#0001' } as any)),
      getString: jest.fn(() => 'powod'),
    };
    return {
      reply,
      deferReply,
      editReply,
      guild,
      user,
      client,
      options,
      member: { id: 'moderatorMember' } as any,
      ...overrides,
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const helpers = require('../../../../src/utils/moderationHelpers') as any;
    if (helpers && helpers.checkModPermissions && typeof helpers.checkModPermissions.mock === 'object') {
      helpers.checkModPermissions.mockReturnValue(true);
    }
    (global as any).__warnLastEmbed = undefined;
  });

  test('brak użytkownika -> editReply z błędem', async () => {
    await jest.isolateModules(async () => {
      const interaction = buildInteraction({
        options: {
          getUser: jest.fn((name: string) => null),
          getString: jest.fn(() => 'powod'),
        },
      });
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });
      expect(interaction.editReply).toHaveBeenCalledWith('Nie podano użytkownika');
    });
  });

  test('brak powodu -> editReply z błędem', async () => {
    await jest.isolateModules(async () => {
      const interaction = buildInteraction({
        options: {
          getUser: jest.fn(() => ({ id: 'target', tag: 'Target#0001' })),
          getString: jest.fn(() => null),
        },
      });
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });
      expect(interaction.editReply).toHaveBeenCalledWith('Nie podano powodu');
    });
  });

  test('fetch członka rzuca -> błąd "nie znaleziono"', async () => {
    await jest.isolateModules(async () => {
      const interaction = buildInteraction();
      (interaction.guild.members.fetch as jest.Mock).mockRejectedValue(new Error('not found'));
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });
      expect(interaction.editReply).toHaveBeenCalledWith(
        'Nie udało się znaleźć użytkownika na serwerze.'
      );
    });
  });

  test('checkModPermissions false -> odmowa', async () => {
    await jest.isolateModules(async () => {
      const helpers = await import('../../../../src/utils/moderationHelpers');
      (helpers.checkModPermissions as unknown as jest.Mock).mockReturnValue(false);
      const interaction = buildInteraction();
      (interaction.guild.members.fetch as jest.Mock).mockResolvedValue({ id: 'targetMember' });
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });
      expect(interaction.editReply).toHaveBeenCalledWith(
        'Nie masz uprawnień do ostrzegania tego użytkownika.'
      );
    });
  });

  test('nowy rekord (count=1) -> embed z czasem oraz procentem 33%', async () => {
    await jest.isolateModules(async () => {
      warnCtor.findOne.mockResolvedValue(null);
      const interaction = buildInteraction();
      const member = { timeout: jest.fn().mockResolvedValue(undefined), id: 't1' };
      (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(member);
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      const embed = (global as any).__warnLastEmbed;
      expect(embed).toBeDefined();
      const fields = embed._fields;
      const czas = fields.find((f: any) => f.name === 'Czas trwania').value;
      expect(czas).toMatch(/^<t:\d+:F>$/);
      const suma = fields.find((f: any) => f.name === 'Suma punktów').value as string;
      expect(suma).toContain('Mute: 1p');
      expect(suma).toContain('[bar]');
      expect(suma).toContain('3p (33%)');

      const u = fields.find((f: any) => f.name === 'Użytkownik').value;
      const m = fields.find((f: any) => f.name === 'Moderator').value;
      const p = fields.find((f: any) => f.name === 'Powód').value;
      expect(u).toBe('<@!target>');
      expect(m).toBe('<@!moderator>');
      expect(p).toBe('powod');
    });
  });

  test('istniejący rekord (count=2) -> procent 67%', async () => {
    await jest.isolateModules(async () => {
      const existing = { warnings: [{ reason: 'a' }], save: jest.fn().mockResolvedValue(undefined) };
      warnCtor.findOne.mockResolvedValue(existing);
      const interaction = buildInteraction();
      const member = { timeout: jest.fn().mockResolvedValue(undefined), id: 't1' };
      (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(member);
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      const embed = (global as any).__warnLastEmbed;
      expect(embed).toBeDefined();
      const fields = embed._fields;
      const suma = fields.find((f: any) => f.name === 'Suma punktów').value as string;
      expect(suma).toContain('Mute: 2p');
      expect(suma).toContain('3p (67%)');
    });
  });

  test('istniejący rekord (count>=3) -> procent 100%', async () => {
    await jest.isolateModules(async () => {
      const existing = {
        warnings: [{ reason: 'a' }, { reason: 'b' }],
        save: jest.fn().mockResolvedValue(undefined),
      };
      warnCtor.findOne.mockResolvedValue(existing);
      const interaction = buildInteraction();
      const member = { timeout: jest.fn().mockResolvedValue(undefined), id: 't1' };
      (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(member);
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      const embed = (global as any).__warnLastEmbed;
      expect(embed).toBeDefined();
      const fields = embed._fields;
      const suma = fields.find((f: any) => f.name === 'Suma punktów').value as string;
      expect(suma).toContain('Mute: 3p');
      expect(suma).toContain('3p (100%)');
    });
  });

  test('member.timeout rzuca -> log i "Brak wyciszenia" w embedzie', async () => {
    await jest.isolateModules(async () => {
      const logger = (await import('../../../../src/utils/logger')).default as any;
      warnCtor.findOne.mockResolvedValue(null);
      const interaction = buildInteraction();
      const member = { timeout: jest.fn().mockRejectedValue(new Error('fail')), id: 't1' };
      (interaction.guild.members.fetch as jest.Mock).mockResolvedValue(member);
      const { run } = await import('../../../../src/commands/moderation/warn');
      await run({ interaction, client: interaction.client });

      expect(logger.error).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: [expect.any(Object)] })
      );
      const embed = (global as any).__warnLastEmbed;
      expect(embed).toBeDefined();
      const fields = embed._fields;
      const czas = fields.find((f: any) => f.name === 'Czas trwania').value;
      expect(czas).toBe('Brak wyciszenia');
    });
  });
});
