export {};

const mockXpForLevel = jest.fn();
const mockFlushXp = jest.fn();
const mockLevelModel = {
  find: jest.fn(),
};

jest.mock('../../../../src/utils/levelMath', () => ({
  xpForLevel: mockXpForLevel,
}));

jest.mock('../../../../src/models/Level', () => ({
  LevelModel: mockLevelModel,
}));

jest.mock('../../../../src/events/ready/xpFlush', () => ({
  __esModule: true,
  default: mockFlushXp,
}));

const mockBuild = jest.fn();
jest.mock('../../../../src/utils/canvasLeaderboardCard', () => ({
  CanvasLeaderboardCard: jest.fn().mockImplementation(() => ({
    build: mockBuild,
  })),
}));

import { run } from '../../../../src/commands/user/toplvl';

describe('toplvl command', () => {
  let interaction: any;
  let client: any;
  let guild: any;

  beforeEach(() => {
    jest.clearAllMocks();

    client = {
      users: {
        fetch: jest.fn(),
      },
      user: {
        id: 'test-bot-123',
      },
      application: {
        id: 'test-bot-123',
      },
    };

    guild = {
      name: 'Test Guild',
      id: 'guild-123',
    };

    interaction = {
      client,
      guild,
      guildId: 'guild-123',
      inCachedGuild: jest.fn(() => true),
      options: {
        getInteger: jest.fn(() => null),
      },
      deferReply: jest.fn(),
      editReply: jest.fn(),
      reply: jest.fn(),
    };

    mockFlushXp.mockResolvedValue(undefined);
    mockBuild.mockResolvedValue(Buffer.from('fake-image'));
    mockXpForLevel.mockImplementation((level: number) => level * 100);

    client.users.fetch.mockImplementation((userId: string) =>
      Promise.resolve({
        username: `User${userId}`,
        displayAvatarURL: jest.fn(() => `https://example.com/avatar-${userId}.png`),
      })
    );
  });

  it('should display top 10 users on page 1', async () => {
    const mockUsers = [
      { userId: 'user1', level: 10, xp: 50 },
      { userId: 'user2', level: 8, xp: 30 },
      { userId: 'user3', level: 5, xp: 20 },
    ];

    mockLevelModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockUsers),
    });

    await run({ interaction });

    expect(mockFlushXp).toHaveBeenCalled();
    expect(mockLevelModel.find).toHaveBeenCalledWith({ guildId: 'guild-123' });
    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      files: expect.arrayContaining([
        expect.objectContaining({
          name: 'leaderboard.png',
        }),
      ]),
      content: undefined,
    });
  });

  it('should display users on page 2', async () => {
    interaction.options.getInteger.mockReturnValue(2);

    const mockUsers = Array.from({ length: 15 }, (_, i) => ({
      userId: `user${i}`,
      level: 15 - i,
      xp: 50,
    }));

    mockLevelModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockUsers),
    });

    await run({ interaction });

    expect(interaction.editReply).toHaveBeenCalledWith({
      files: expect.any(Array),
      content: expect.stringContaining('Strona 2'),
    });
  });

  it('should show error when no users exist', async () => {
    mockLevelModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });

    await run({ interaction });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('Brak użytkowników z poziomami'),
      flags: expect.any(Number),
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('should show error when page does not exist', async () => {
    interaction.options.getInteger.mockReturnValue(5);

    mockLevelModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { userId: 'user1', level: 10, xp: 50 },
        { userId: 'user2', level: 8, xp: 30 },
      ]),
    });

    await run({ interaction });

    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('Strona 5 nie istnieje'),
      flags: expect.any(Number),
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('should handle user fetch errors gracefully', async () => {
    const mockUsers = [
      { userId: 'user1', level: 10, xp: 50 },
      { userId: 'deleted-user', level: 8, xp: 30 },
    ];

    mockLevelModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockUsers),
    });

    client.users.fetch.mockImplementation((userId: string) => {
      if (userId === 'deleted-user') {
        return Promise.reject(new Error('User not found'));
      }
      return Promise.resolve({
        username: `User${userId}`,
        displayAvatarURL: jest.fn(() => `https://example.com/avatar-${userId}.png`),
      });
    });

    await run({ interaction });

    expect(interaction.editReply).toHaveBeenCalled();
  });

  it('should sort users by total XP correctly', async () => {
    const mockUsers = [
      { userId: 'user1', level: 5, xp: 90 },
      { userId: 'user2', level: 10, xp: 10 },
      { userId: 'user3', level: 7, xp: 50 },
    ];

    mockLevelModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue(mockUsers),
    });

    await run({ interaction });

    expect(mockBuild).toHaveBeenCalled();
  });

  it('should return early if not in cached guild', async () => {
    interaction.inCachedGuild.mockReturnValue(false);

    await run({ interaction });

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(mockLevelModel.find).not.toHaveBeenCalled();
  });
});
