export {};

const mockModifyXp = jest.fn();
const mockNotifyLevelUp = jest.fn();
const mockComputeLevelProgress = jest.fn();
const mockFlushXp = jest.fn();

const mockLevelModel = {
  findOneAndUpdate: jest.fn(),
};

const mockXpCache = {
  invalidateUser: jest.fn(),
};

jest.mock('../../../../src/services/xpService', () => ({
  modifyXp: mockModifyXp,
}));

jest.mock('../../../../src/models/Level', () => ({
  LevelModel: mockLevelModel,
}));

jest.mock('../../../../src/services/levelNotifier', () => ({
  notifyLevelUp: mockNotifyLevelUp,
}));

jest.mock('../../../../src/utils/levelMath', () => ({
  computeLevelProgress: mockComputeLevelProgress,
}));

jest.mock('../../../../src/cache/xpCache', () => ({
  __esModule: true,
  default: mockXpCache,
}));

jest.mock('../../../../src/events/ready/xpFlush', () => ({
  __esModule: true,
  default: mockFlushXp,
}));

import { run } from '../../../../src/commands/admin/xp';

describe('xp command', () => {
  let interaction: any;
  let client: any;

  beforeEach(() => {
    jest.clearAllMocks();

    client = { user: { id: 'bot-123' } };

    interaction = {
      client,
      guildId: 'guild-123',
      user: { id: 'admin-123' },
      inCachedGuild: jest.fn(() => true),
      options: {
        getSubcommand: jest.fn(),
        getUser: jest.fn(),
        getInteger: jest.fn(),
        getString: jest.fn(),
      },
      deferReply: jest.fn(),
      editReply: jest.fn(),
    };

    mockLevelModel.findOneAndUpdate.mockResolvedValue({});
    mockNotifyLevelUp.mockResolvedValue(undefined);
    mockFlushXp.mockResolvedValue(undefined);
  });

  describe('add subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('add');
      interaction.options.getUser.mockReturnValue({ id: 'user-123', username: 'TestUser' });
      interaction.options.getInteger.mockReturnValue(100);
    });

    it('should add XP to user', async () => {
      await run({ interaction });

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(mockModifyXp).toHaveBeenCalledWith(client, 'guild-123', 'user-123', 100);
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('+100 XP'),
      });
    });
  });

  describe('remove subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('remove');
      interaction.options.getUser.mockReturnValue({ id: 'user-123', username: 'TestUser' });
      interaction.options.getInteger.mockReturnValue(50);
    });

    it('should remove XP from user', async () => {
      await run({ interaction });

      expect(mockModifyXp).toHaveBeenCalledWith(client, 'guild-123', 'user-123', -50);
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('−50 XP'),
      });
    });
  });

  describe('set subcommand - level', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('set');
      interaction.options.getUser.mockReturnValue({ id: 'user-123', username: 'TestUser' });
    });

    it('should set specific level with L suffix', async () => {
      interaction.options.getString.mockReturnValue('10L');

      await run({ interaction });

      expect(mockLevelModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123', userId: 'user-123' },
        { level: 10, xp: 0 },
        { upsert: true }
      );
      expect(mockXpCache.invalidateUser).toHaveBeenCalledWith('guild-123', 'user-123');
      expect(mockFlushXp).toHaveBeenCalled();
      expect(mockNotifyLevelUp).toHaveBeenCalledWith(client, 'guild-123', 'user-123', 10);
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('poziom **10**'),
      });
    });

    it('should set specific level with lowercase l suffix', async () => {
      interaction.options.getString.mockReturnValue('5l');

      await run({ interaction });

      expect(mockLevelModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123', userId: 'user-123' },
        { level: 5, xp: 0 },
        { upsert: true }
      );
    });

    it('should reject level less than 1', async () => {
      interaction.options.getString.mockReturnValue('0L');

      await run({ interaction });

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Poziom musi być większy niż 0'),
      });
      expect(mockLevelModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('set subcommand - total XP', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('set');
      interaction.options.getUser.mockReturnValue({ id: 'user-123', username: 'TestUser' });
    });

    it('should set total XP and calculate level', async () => {
      interaction.options.getString.mockReturnValue('5000');
      mockComputeLevelProgress.mockReturnValue({ level: 7, xpIntoLevel: 234 });

      await run({ interaction });

      expect(mockComputeLevelProgress).toHaveBeenCalledWith(5000);
      expect(mockLevelModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123', userId: 'user-123' },
        { level: 7, xp: 234 },
        { upsert: true }
      );
      expect(mockXpCache.invalidateUser).toHaveBeenCalledWith('guild-123', 'user-123');
      expect(mockFlushXp).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('5000'),
      });
    });

    it('should reject invalid value', async () => {
      interaction.options.getString.mockReturnValue('invalid');

      await run({ interaction });

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Nieprawidłowa wartość'),
      });
      expect(mockLevelModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('should reject negative value', async () => {
      interaction.options.getString.mockReturnValue('-100');

      await run({ interaction });

      expect(interaction.editReply).toHaveBeenCalledWith({
        content: expect.stringContaining('Nieprawidłowa wartość'),
      });
    });
  });

  describe('edge cases', () => {
    it('should return early if not in cached guild', async () => {
      interaction.inCachedGuild.mockReturnValue(false);
      interaction.options.getSubcommand.mockReturnValue('add');

      await run({ interaction });

      expect(interaction.deferReply).not.toHaveBeenCalled();
      expect(mockModifyXp).not.toHaveBeenCalled();
    });
  });
});
