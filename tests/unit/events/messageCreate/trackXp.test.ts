import trackXp from '../../../../src/events/messageCreate/trackXp';
import { Message, Guild, GuildMember, User, TextChannel } from 'discord.js';
import { LevelConfigModel } from '../../../../src/models/LevelConfig';
import { LevelModel } from '../../../../src/models/Level';
import xpCache from '../../../../src/cache/xpCache';
import monthlyStatsCache from '../../../../src/cache/monthlyStatsCache';
import * as xpMultiplier from '../../../../src/utils/xpMultiplier';

jest.mock('../../../../src/models/LevelConfig');
jest.mock('../../../../src/models/Level');
jest.mock('../../../../src/cache/xpCache');
jest.mock('../../../../src/cache/monthlyStatsCache');
jest.mock('../../../../src/utils/xpMultiplier');

describe('events/messageCreate/trackXp', () => {
  let mockMessage: any;
  let mockMember: any;
  let mockGuild: any;
  let mockUser: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUser = {
      id: 'user123',
      bot: false,
    };

    mockGuild = {
      id: 'guild123',
    };

    mockMember = {
      guild: mockGuild,
      roles: {
        cache: new Map([['role1', { id: 'role1' }]]),
      },
    };

    mockMessage = {
      author: mockUser,
      guild: mockGuild,
      member: mockMember,
      channelId: 'channel123',
      channel: { id: 'channel123' },
    };

    (LevelConfigModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        xpPerMsg: 5,
        cooldownSec: 0,
        ignoredChannels: [],
        ignoredRoles: [],
      }),
    });

    (LevelModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });
    (xpMultiplier.getUserXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(1.0);
    (xpMultiplier.getChannelXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(1.0);
    (xpCache.addMsg as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (monthlyStatsCache.addMessage as jest.Mock) = jest.fn();
  });

  it('ignores bot messages', async () => {
    mockMessage.author.bot = true;

    await trackXp(mockMessage);

    expect(xpCache.addMsg).not.toHaveBeenCalled();
  });

  it('ignores messages without guild', async () => {
    mockMessage.guild = null;

    await trackXp(mockMessage);

    expect(xpCache.addMsg).not.toHaveBeenCalled();
  });

  it('ignores messages without member', async () => {
    mockMessage.member = null;

    await trackXp(mockMessage);

    expect(xpCache.addMsg).not.toHaveBeenCalled();
  });

  it('ignores messages in ignored channels', async () => {
    (LevelConfigModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        xpPerMsg: 5,
        cooldownSec: 0,
        ignoredChannels: ['channel123'],
        ignoredRoles: [],
      }),
    });

    await trackXp(mockMessage);

    expect(xpCache.addMsg).not.toHaveBeenCalled();
  });

  it('ignores messages from users with ignored roles', async () => {
    (LevelConfigModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        xpPerMsg: 5,
        cooldownSec: 0,
        ignoredChannels: [],
        ignoredRoles: ['role1'],
      }),
    });

    await trackXp(mockMessage);

    expect(xpCache.addMsg).not.toHaveBeenCalled();
  });

  it('respects cooldown period', async () => {
    const now = Date.now();
    (LevelConfigModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        xpPerMsg: 5,
        cooldownSec: 60,
        ignoredChannels: [],
        ignoredRoles: [],
      }),
    });

    (LevelModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        lastMessageTs: new Date(now - 30000),
      }),
    });

    await trackXp(mockMessage);

    expect(xpCache.addMsg).not.toHaveBeenCalled();
  });

  it('awards XP after cooldown expires', async () => {
    const now = Date.now();
    (LevelConfigModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        xpPerMsg: 5,
        cooldownSec: 60,
        ignoredChannels: [],
        ignoredRoles: [],
      }),
    });

    (LevelModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({
        lastMessageTs: new Date(now - 70000),
      }),
    });

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 5);
  });

  it('applies role multiplier correctly', async () => {
    (xpMultiplier.getUserXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(2.0);

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 10);
  });

  it('applies channel multiplier correctly', async () => {
    (xpMultiplier.getChannelXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(1.5);

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 8);
  });

  it('combines role and channel multipliers', async () => {
    (xpMultiplier.getUserXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(2.0);
    (xpMultiplier.getChannelXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(1.5);

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 15);
  });

  it('rounds final XP to integer', async () => {
    (xpMultiplier.getUserXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(1.3);

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 7);
  });

  it('uses default XP value when config missing', async () => {
    (LevelConfigModel.findOne as jest.Mock) = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 5);
  });

  it('updates monthly stats cache', async () => {
    await trackXp(mockMessage);

    const currentMonth = new Date().toISOString().slice(0, 7);
    expect(monthlyStatsCache.addMessage).toHaveBeenCalledWith('guild123', 'user123', currentMonth);
  });

  it('applies reduced multiplier correctly', async () => {
    (xpMultiplier.getChannelXpMultiplier as jest.Mock) = jest.fn().mockResolvedValue(0.5);

    await trackXp(mockMessage);

    expect(xpCache.addMsg).toHaveBeenCalledWith('guild123', 'user123', 3);
  });
});
