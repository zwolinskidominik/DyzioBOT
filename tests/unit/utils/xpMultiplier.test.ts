import { getUserXpMultiplier, getChannelXpMultiplier } from '../../../src/utils/xpMultiplier';
import { LevelConfigModel } from '../../../src/models/LevelConfig';
import { GuildMember } from 'discord.js';

jest.mock('../../../src/models/LevelConfig');

describe('utils/xpMultiplier', () => {
  const mockLevelConfigModel = LevelConfigModel as jest.Mocked<typeof LevelConfigModel>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserXpMultiplier', () => {
    it('returns 1.0 when no config exists', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const mockMember = {
        guild: { id: 'guild1' },
        roles: { cache: new Map() },
      } as unknown as GuildMember;

      const multiplier = await getUserXpMultiplier(mockMember);
      expect(multiplier).toBe(1.0);
    });

    it('returns 1.0 when no role multipliers configured', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ roleMultipliers: [] }),
      } as any);

      const mockMember = {
        guild: { id: 'guild1' },
        roles: { cache: new Map() },
      } as unknown as GuildMember;

      const multiplier = await getUserXpMultiplier(mockMember);
      expect(multiplier).toBe(1.0);
    });

    it('returns correct multiplier for single role', async () => {
      const roleCache = new Map();
      roleCache.set('role1', { id: 'role1' });

      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          roleMultipliers: [{ roleId: 'role1', multiplier: 1.5 }],
        }),
      } as any);

      const mockMember = {
        guild: { id: 'guild1' },
        roles: { cache: roleCache },
      } as unknown as GuildMember;

      const multiplier = await getUserXpMultiplier(mockMember);
      expect(multiplier).toBe(1.5);
    });

    it('returns highest multiplier when user has multiple roles', async () => {
      const roleCache = new Map();
      roleCache.set('role1', { id: 'role1' });
      roleCache.set('role2', { id: 'role2' });
      roleCache.set('role3', { id: 'role3' });

      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          roleMultipliers: [
            { roleId: 'role1', multiplier: 1.5 },
            { roleId: 'role2', multiplier: 2.5 },
            { roleId: 'role3', multiplier: 2.0 },
          ],
        }),
      } as any);

      const mockMember = {
        guild: { id: 'guild1' },
        roles: { cache: roleCache },
      } as unknown as GuildMember;

      const multiplier = await getUserXpMultiplier(mockMember);
      expect(multiplier).toBe(2.5);
    });

    it('returns 1.0 when user has no matching roles', async () => {
      const roleCache = new Map();
      roleCache.set('roleX', { id: 'roleX' });

      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          roleMultipliers: [
            { roleId: 'role1', multiplier: 1.5 },
            { roleId: 'role2', multiplier: 2.5 },
          ],
        }),
      } as any);

      const mockMember = {
        guild: { id: 'guild1' },
        roles: { cache: roleCache },
      } as unknown as GuildMember;

      const multiplier = await getUserXpMultiplier(mockMember);
      expect(multiplier).toBe(1.0);
    });
  });

  describe('getChannelXpMultiplier', () => {
    it('returns 1.0 when no config exists', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      } as any);

      const multiplier = await getChannelXpMultiplier('guild1', 'channel1');
      expect(multiplier).toBe(1.0);
    });

    it('returns 1.0 when no channel multipliers configured', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ channelMultipliers: [] }),
      } as any);

      const multiplier = await getChannelXpMultiplier('guild1', 'channel1');
      expect(multiplier).toBe(1.0);
    });

    it('returns correct multiplier for configured channel', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          channelMultipliers: [
            { channelId: 'channel1', multiplier: 1.5 },
            { channelId: 'channel2', multiplier: 0.5 },
          ],
        }),
      } as any);

      const multiplier = await getChannelXpMultiplier('guild1', 'channel1');
      expect(multiplier).toBe(1.5);
    });

    it('returns 1.0 for channel without multiplier', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          channelMultipliers: [
            { channelId: 'channel1', multiplier: 1.5 },
            { channelId: 'channel2', multiplier: 0.5 },
          ],
        }),
      } as any);

      const multiplier = await getChannelXpMultiplier('guild1', 'channelX');
      expect(multiplier).toBe(1.0);
    });

    it('handles edge case multipliers (0.1 and 10)', async () => {
      mockLevelConfigModel.findOne = jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          channelMultipliers: [
            { channelId: 'spam', multiplier: 0.1 },
            { channelId: 'premium', multiplier: 10 },
          ],
        }),
      } as any);

      const spamMultiplier = await getChannelXpMultiplier('guild1', 'spam');
      const premiumMultiplier = await getChannelXpMultiplier('guild1', 'premium');

      expect(spamMultiplier).toBe(0.1);
      expect(premiumMultiplier).toBe(10);
    });
  });
});
