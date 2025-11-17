export {};

const mockReactionRoleModel = {
  create: jest.fn(),
  findOne: jest.fn(),
  deleteOne: jest.fn(),
};

const mockLogger = {
  error: jest.fn(),
};

jest.mock('../../../../src/models/ReactionRole', () => ({
  ReactionRoleModel: mockReactionRoleModel,
}));

jest.mock('../../../../src/utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

import { run } from '../../../../src/commands/admin/reactionRole';

describe('reactionRole command', () => {
  let interaction: any;
  let guild: any;
  let channel: any;

  beforeEach(() => {
    jest.clearAllMocks();

    guild = {
      id: 'guild-123',
      name: 'Test Guild',
      roles: {
        cache: new Map([
          ['role-1', { id: 'role-1', name: 'Role 1' }],
          ['role-2', { id: 'role-2', name: 'Role 2' }],
        ]),
      },
      emojis: {
        cache: new Map([
          ['emoji-1', { id: 'emoji-1', name: 'custom1' }],
        ]),
      },
      channels: {
        cache: new Map(),
      },
    };

    channel = {
      id: 'channel-123',
      send: jest.fn(),
      messages: {
        delete: jest.fn(),
      },
      createMessageCollector: jest.fn(),
    };

    guild.channels.cache.set('channel-123', channel);

    interaction = {
      guild,
      guildId: 'guild-123',
      channel,
      user: { id: 'user-123' },
      options: {
        getSubcommand: jest.fn(),
        getString: jest.fn(),
      },
      reply: jest.fn(),
      editReply: jest.fn(),
      deferUpdate: jest.fn(),
      followUp: jest.fn(),
    };
  });

  describe('create subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('create');
      interaction.options.getString.mockImplementation((name: string) => {
        if (name === 'title') return 'Test Reaction Role';
        return null;
      });
    });

    it('should start creation wizard', async () => {
      const mockMessage = {
        createMessageComponentCollector: jest.fn(() => ({
          on: jest.fn().mockReturnThis(),
          stop: jest.fn(),
        })),
      };

      interaction.reply.mockResolvedValue({
        resource: { message: mockMessage },
      });

      await run({ interaction } as any);

      expect(interaction.reply).toHaveBeenCalled();
      expect(mockMessage.createMessageComponentCollector).toHaveBeenCalled();
    });

    it('should use default title when not provided', async () => {
      interaction.options.getString.mockReturnValue(null);

      const mockMessage = {
        createMessageComponentCollector: jest.fn(() => ({
          on: jest.fn().mockReturnThis(),
          stop: jest.fn(),
        })),
      };

      interaction.reply.mockResolvedValue({
        resource: { message: mockMessage },
      });

      await run({ interaction } as any);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
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

      interaction.reply.mockResolvedValue({
        resource: { message: mockMessage },
      });

      await run({ interaction } as any);

      await new Promise(process.nextTick);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Upłynął czas'),
        })
      );
    });
  });

  describe('delete subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('delete');
    });

    it('should delete reaction role message and database entry', async () => {
      const messageId = 'msg-123';
      interaction.options.getString.mockReturnValue(messageId);

      mockReactionRoleModel.findOne.mockResolvedValue({
        guildId: 'guild-123',
        channelId: 'channel-123',
        messageId,
        reactions: [],
      });

      channel.messages.delete.mockResolvedValue({});
      mockReactionRoleModel.deleteOne.mockResolvedValue({});

      await run({ interaction } as any);

      expect(mockReactionRoleModel.findOne).toHaveBeenCalledWith({
        guildId: 'guild-123',
        messageId,
      });
      expect(channel.messages.delete).toHaveBeenCalledWith(messageId);
      expect(mockReactionRoleModel.deleteOne).toHaveBeenCalledWith({ messageId });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('została usunięta'),
        })
      );
    });

    it('should show error when message not found', async () => {
      const messageId = 'invalid-msg';
      interaction.options.getString.mockReturnValue(messageId);

      mockReactionRoleModel.findOne.mockResolvedValue(null);

      await run({ interaction } as any);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Nie znaleziono wiadomości'),
        })
      );
    });

    it('should handle channel not found gracefully', async () => {
      const messageId = 'msg-123';
      interaction.options.getString.mockReturnValue(messageId);

      mockReactionRoleModel.findOne.mockResolvedValue({
        guildId: 'guild-123',
        channelId: 'invalid-channel',
        messageId,
        reactions: [],
      });

      mockReactionRoleModel.deleteOne.mockResolvedValue({});

      await run({ interaction } as any);
      expect(mockReactionRoleModel.deleteOne).toHaveBeenCalledWith({ messageId });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('została usunięta'),
        })
      );
    });

    it('should handle message deletion failure gracefully', async () => {
      const messageId = 'msg-123';
      interaction.options.getString.mockReturnValue(messageId);

      mockReactionRoleModel.findOne.mockResolvedValue({
        guildId: 'guild-123',
        channelId: 'channel-123',
        messageId,
        reactions: [],
      });

      channel.messages.delete.mockRejectedValue(new Error('Message not found'));
      mockReactionRoleModel.deleteOne.mockResolvedValue({});

      await run({ interaction } as any);
      expect(mockReactionRoleModel.deleteOne).toHaveBeenCalledWith({ messageId });
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('została usunięta'),
        })
      );
    });
  });

  describe('error handling', () => {
    it('should handle missing guild in delete subcommand', async () => {
      interaction.guild = null;
      interaction.guildId = null;
      interaction.options.getSubcommand.mockReturnValue('delete');
      interaction.options.getString.mockReturnValue('msg-123');

      mockReactionRoleModel.findOne.mockResolvedValue(null);

      await run({ interaction } as any);

      expect(interaction.reply).toHaveBeenCalled();
    });

    it('should handle missing reply message', async () => {
      interaction.options.getSubcommand.mockReturnValue('create');
      interaction.options.getString.mockReturnValue('Test');

      interaction.reply.mockResolvedValue({
        resource: { message: null },
      });

      await run({ interaction } as any);

      expect(interaction.reply).toHaveBeenCalled();
    });
  });
});
