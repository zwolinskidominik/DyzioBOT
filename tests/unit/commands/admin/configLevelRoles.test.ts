export {};

const mockLevelConfigModel = {
  findOne: jest.fn(),
  save: jest.fn(),
};

const mockCreateBaseEmbed = jest.fn(() => ({
  setTitle: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
}));

const mockLogger = {
  error: jest.fn(),
};

jest.mock('../../../../src/models/LevelConfig', () => ({
  LevelConfigModel: class {
    guildId: string;
    roleRewards: Array<{ level: number; roleId: string }> = [];

    constructor(data: any) {
      this.guildId = data.guildId;
      this.roleRewards = data.roleRewards || [];
    }

    async save() {
      return mockLevelConfigModel.save(this);
    }

    static findOne = mockLevelConfigModel.findOne;
  },
}));

jest.mock('../../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
}));

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

import { run } from '../../../../src/commands/admin/configLevelRoles';

describe('configLevelRoles command', () => {
  let interaction: any;
  let guild: any;

  beforeEach(() => {
    jest.clearAllMocks();

    guild = {
      id: 'guild-123',
      name: 'Test Guild',
    };

    interaction = {
      guild,
      user: { id: 'user-123' },
      options: {
        getSubcommand: jest.fn(),
        getInteger: jest.fn(),
      },
      deferReply: jest.fn(),
      editReply: jest.fn(),
      fetchReply: jest.fn(),
    };

    mockLevelConfigModel.save.mockResolvedValue({});
  });

  describe('show subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('show');
    });

    it('should show message when no rewards configured', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await run({ interaction } as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Brak skonfigurowanych nagród-ról')
      );
    });

    it('should show message when rewards array is empty', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ guildId: 'guild-123', roleRewards: [] }),
      });

      await run({ interaction } as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Brak skonfigurowanych')
      );
    });

    it('should list all configured rewards sorted by level', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          guildId: 'guild-123',
          roleRewards: [
            { level: 10, roleId: 'role-1' },
            { level: 5, roleId: 'role-2' },
            { level: 15, roleId: 'role-3' },
          ],
        }),
      });

      await run({ interaction } as any);

      const reply = interaction.editReply.mock.calls[0][0];
      expect(reply).toContain('Poziom **5**');
      expect(reply).toContain('Poziom **10**');
      expect(reply).toContain('Poziom **15**');
      expect(reply).toContain('<@&role-2>');
      expect(reply).toContain('<@&role-1>');
      expect(reply).toContain('<@&role-3>');
    });
  });

  describe('remove subcommand', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      interaction.options.getSubcommand.mockReturnValue('remove');
    });

    it('should remove reward for specified level', async () => {
      interaction.options.getInteger.mockReturnValue(10);

      const mockConfig = {
        guildId: 'guild-123',
        roleRewards: [
          { level: 5, roleId: 'role-1' },
          { level: 10, roleId: 'role-2' },
          { level: 15, roleId: 'role-3' },
        ],
        save: jest.fn().mockResolvedValue({}),
      };

      mockLevelConfigModel.findOne.mockResolvedValue(mockConfig);

      await run({ interaction } as any);

      expect(mockConfig.roleRewards).toHaveLength(2);
      expect(mockConfig.roleRewards.find((r: any) => r.level === 10)).toBeUndefined();
      expect(mockConfig.save).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Usunięto rolę-nagrodę dla poziomu 10')
      );
    });

    it('should show warning when level not found', async () => {
      interaction.options.getInteger.mockReturnValue(999);

      const mockConfig = {
        guildId: 'guild-123',
        roleRewards: [{ level: 5, roleId: 'role-1' }],
        save: jest.fn().mockResolvedValue({}),
      };

      mockLevelConfigModel.findOne.mockResolvedValue(mockConfig);

      await run({ interaction } as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Nie znaleziono nagrody dla poziomu 999')
      );
    });

    it('should create new config if none exists', async () => {
      interaction.options.getInteger.mockReturnValue(10);
      mockLevelConfigModel.findOne.mockResolvedValue(null);

      await run({ interaction } as any);

      expect(mockLevelConfigModel.save).toHaveBeenCalled();
    });
  });

  describe('set subcommand', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      interaction.options.getSubcommand.mockReturnValue('set');
      interaction.options.getInteger.mockReturnValue(10);
    });

    it('should start role selection wizard', async () => {
      const mockMessage = {
        createMessageComponentCollector: jest.fn(() => {
          const collector: any = {
            on: jest.fn((event, handler) => {
              if (event === 'end') {
                setTimeout(() => handler(new Map(), 'time'), 10);
              }
              return collector;
            }),
            stop: jest.fn(),
          };
          return collector;
        }),
      };

      interaction.editReply.mockResolvedValue(mockMessage);

      await run({ interaction } as any);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('poziom 10'),
          components: expect.any(Array),
        })
      );
    });

    it('should handle timeout', async () => {
      const mockCollector: any = {
        on: jest.fn((event, handler) => {
          if (event === 'end') {
            handler(new Map(), 'time');
          }
          return mockCollector;
        }),
        stop: jest.fn(),
      };

      const mockMessage = {
        createMessageComponentCollector: jest.fn(() => mockCollector),
      };

      interaction.editReply.mockResolvedValue(mockMessage);

      await run({ interaction } as any);

      await new Promise(process.nextTick);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Czas na konfigurację minął'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should require guild context', async () => {
      interaction.guild = null;
      interaction.options.getSubcommand.mockReturnValue('show');

      await run({ interaction } as any);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Ta komenda musi być użyta na serwerze')
      );
    });
  });
});
