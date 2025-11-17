export {};

const mockModel = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  deleteOne: jest.fn(),
};

jest.mock('../../../../src/models/GreetingsConfiguration', () => ({
  GreetingsConfigurationModel: mockModel,
}));

const mockLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};
jest.mock('../../../../src/utils/logger', () => ({ __esModule: true, default: mockLogger }));

const mockCreateBaseEmbed = jest.fn((opts?: any) => ({
  addFields: jest.fn().mockReturnThis(),
  setTitle: jest.fn().mockReturnThis(),
  setDescription: jest.fn().mockReturnThis(),
  ...opts,
}));
jest.mock('../../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: mockCreateBaseEmbed,
}));

import { run } from '../../../../src/commands/admin/configLobby';

describe('configLobby command', () => {
  let interaction: any;
  let guild: any;

  beforeEach(() => {
    jest.clearAllMocks();

    guild = {
      id: 'guild-123',
      name: 'Test Guild',
      iconURL: jest.fn(() => 'https://example.com/icon.png'),
      channels: {
        cache: new Map([
          ['greet-channel', { id: 'greet-channel', type: 0 }],
          ['rules-channel', { id: 'rules-channel', type: 0 }],
          ['chat-channel', { id: 'chat-channel', type: 0 }],
        ]),
      },
    };

    interaction = {
      guild,
      user: { id: 'user-123' },
      options: {
        getSubcommand: jest.fn(),
      },
      deferReply: jest.fn(),
      editReply: jest.fn(),
      fetchReply: jest.fn(),
    };

    mockModel.findOne.mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      }),
    });
  });

  describe('show subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('show');
    });

    it('should show error when no configuration exists', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await run({ interaction } as any);

      expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
          description: expect.stringContaining('Brak skonfigurowanego kanału powitań'),
        })
      );
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('should show error when configured channel does not exist', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            guildId: 'guild-123',
            greetingsChannelId: 'non-existent-channel',
          }),
        }),
      });

      await run({ interaction } as any);

      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
          description: expect.stringContaining('Skonfigurowany kanał nie istnieje'),
        })
      );
    });

    it('should display current configuration with all channels', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            guildId: 'guild-123',
            greetingsChannelId: 'greet-channel',
            rulesChannelId: 'rules-channel',
            chatChannelId: 'chat-channel',
            rolesChannelId: 'customize-community',
          }),
        }),
      });

      await run({ interaction } as any);

      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎮 Konfiguracja Lobby',
          description: 'Aktualna konfiguracja systemu powitań:',
        })
      );
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('should display configuration with only required channel', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            guildId: 'guild-123',
            greetingsChannelId: 'greet-channel',
            rolesChannelId: 'customize-community',
          }),
        }),
      });

      await run({ interaction } as any);

      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎮 Konfiguracja Lobby',
        })
      );
    });
  });

  describe('remove subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('remove');
    });

    it('should show error when no configuration to remove', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      await run({ interaction } as any);

      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
          description: expect.stringContaining('Brak skonfigurowanego kanału powitań'),
        })
      );
      expect(mockModel.deleteOne).not.toHaveBeenCalled();
    });

    it('should successfully remove configuration', async () => {
      mockModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue({
            guildId: 'guild-123',
            greetingsChannelId: 'greet-channel',
          }),
        }),
      });
      mockModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await run({ interaction } as any);

      expect(mockModel.deleteOne).toHaveBeenCalledWith({ guildId: 'guild-123' });
      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('Kanał powitań został wyłączony'),
        })
      );
    });
  });

  describe('set subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('set');
    });

    it('should start configuration wizard', async () => {
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
      interaction.fetchReply.mockResolvedValue(mockMessage);

      await run({ interaction } as any);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎮 Konfiguracja Lobby',
        })
      );
      expect(interaction.editReply).toHaveBeenCalled();
    });

    it('should handle timeout during configuration', async () => {
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
      interaction.fetchReply.mockResolvedValue(mockMessage);

      await run({ interaction } as any);
      await new Promise(process.nextTick);

      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
          description: expect.stringContaining('Czas na konfigurację minął'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      interaction.options.getSubcommand.mockReturnValue('show');
      mockModel.findOne.mockImplementation(() => {
        throw new Error('Database error');
      });

      await run({ interaction } as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Błąd podczas konfiguracji kanału powitań')
      );
      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
          description: expect.stringContaining('Wystąpił błąd'),
        })
      );
    });

    it('should handle missing guild', async () => {
      interaction.guild = null;
      interaction.options.getSubcommand.mockReturnValue('show');

      await run({ interaction } as any);

      expect(mockCreateBaseEmbed).toHaveBeenCalledWith(
        expect.objectContaining({
          isError: true,
          description: expect.stringContaining('Ta komenda może być używana tylko na serwerze'),
        })
      );
    });
  });
});
