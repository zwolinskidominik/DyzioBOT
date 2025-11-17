export {};

const mockLevelConfigModel = {
  findOneAndUpdate: jest.fn(),
  findOne: jest.fn(),
};

jest.mock('../../../../src/models/LevelConfig', () => ({
  LevelConfigModel: mockLevelConfigModel,
}));

import { run } from '../../../../src/commands/admin/configLevels';

describe('configLevels command', () => {
  let interaction: any;

  beforeEach(() => {
    jest.clearAllMocks();

    interaction = {
      guild: { id: 'guild-123' },
      options: {
        getSubcommand: jest.fn(),
        getChannel: jest.fn(),
        getInteger: jest.fn(),
        getString: jest.fn(),
      },
      reply: jest.fn(),
    };
  });

  describe('show subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('show');
    });

    it('should show warning when config does not exist', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      await run({ interaction });

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('System poziomów nie jest skonfigurowany'),
        flags: 64,
      });
    });

    it('should display basic configuration', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          notifyChannelId: 'channel-123',
          xpPerMsg: 5,
          xpPerMinVc: 10,
          cooldownSec: 0,
        }),
      });

      await run({ interaction });

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: '⚙️ Konfiguracja systemu poziomów',
              }),
            }),
          ]),
          flags: 64,
        })
      );
    });

    it('should display custom messages', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          notifyChannelId: 'channel-123',
          xpPerMsg: 5,
          xpPerMinVc: 10,
          cooldownSec: 0,
          levelUpMessage: 'Custom level up!',
          rewardMessage: 'Custom reward!',
        }),
      });

      await run({ interaction });

      const replyCall = interaction.reply.mock.calls[0][0];
      const embed = replyCall.embeds[0];

      expect(embed.data.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '🎊 Wiadomość level-up',
            value: expect.stringContaining('Custom level up!'),
          }),
          expect.objectContaining({
            name: '🎁 Wiadomość nagrody',
            value: expect.stringContaining('Custom reward!'),
          }),
        ])
      );
    });

    it('should display ignored channels and roles', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          notifyChannelId: 'channel-123',
          xpPerMsg: 5,
          xpPerMinVc: 10,
          cooldownSec: 0,
          ignoredChannels: ['channel1', 'channel2'],
          ignoredRoles: ['role1', 'role2'],
        }),
      });

      await run({ interaction });

      const replyCall = interaction.reply.mock.calls[0][0];
      const embed = replyCall.embeds[0];

      expect(embed.data.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '🚫 Ignorowane kanały',
          }),
          expect.objectContaining({
            name: '🚫 Ignorowane role',
          }),
        ])
      );
    });

    it('should display multipliers and role rewards', async () => {
      mockLevelConfigModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          notifyChannelId: 'channel-123',
          xpPerMsg: 5,
          xpPerMinVc: 10,
          cooldownSec: 0,
          roleMultipliers: [{ roleId: 'role1', multiplier: 2 }],
          channelMultipliers: [{ channelId: 'channel1', multiplier: 1.5 }],
          roleRewards: [{ level: 10, roleId: 'reward-role-1' }],
        }),
      });

      await run({ interaction });

      const replyCall = interaction.reply.mock.calls[0][0];
      const embed = replyCall.embeds[0];

      expect(embed.data.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: '✨ Mnożniki ról',
          }),
          expect.objectContaining({
            name: '✨ Mnożniki kanałów',
          }),
          expect.objectContaining({
            name: '🏆 Nagrody-role',
          }),
        ])
      );
    });
  });

  describe('set subcommand', () => {
    beforeEach(() => {
      interaction.options.getSubcommand.mockReturnValue('set');
      mockLevelConfigModel.findOneAndUpdate.mockResolvedValue({});
    });

    it('should save configuration with only required channel', async () => {
      interaction.options.getChannel.mockReturnValue({ id: 'channel-123' });
      interaction.options.getInteger.mockReturnValue(null);
      interaction.options.getString.mockReturnValue(null);

      await run({ interaction });

      expect(mockLevelConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123' },
        {
          $set: {
            notifyChannelId: 'channel-123',
          },
        },
        { upsert: true }
      );

      expect(interaction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Konfiguracja leveli zapisana'),
        flags: 64,
      });
    });

    it('should save configuration with all XP parameters', async () => {
      interaction.options.getChannel.mockReturnValue({ id: 'channel-123' });
      interaction.options.getInteger.mockImplementation((name: string) => {
        const values: Record<string, number> = {
          xp_per_msg: 15,
          xp_per_min_vc: 10,
          cooldown_sec: 60,
        };
        return values[name] ?? null;
      });
      interaction.options.getString.mockReturnValue(null);

      await run({ interaction });

      expect(mockLevelConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123' },
        {
          $set: {
            notifyChannelId: 'channel-123',
            xpPerMsg: 15,
            xpPerMinVc: 10,
            cooldownSec: 60,
          },
        },
        { upsert: true }
      );
    });

    it('should save configuration with custom messages', async () => {
      interaction.options.getChannel.mockReturnValue({ id: 'channel-123' });
      interaction.options.getInteger.mockReturnValue(null);
      interaction.options.getString.mockImplementation((name: string) => {
        const values: Record<string, string> = {
          level_msg: 'Gratulacje {user}, osiągnąłeś poziom {level}!',
          reward_msg: 'Otrzymałeś rolę {role} za poziom {level}!',
        };
        return values[name] ?? null;
      });

      await run({ interaction });

      expect(mockLevelConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123' },
        {
          $set: {
            notifyChannelId: 'channel-123',
            levelUpMessage: 'Gratulacje {user}, osiągnąłeś poziom {level}!',
            rewardMessage: 'Otrzymałeś rolę {role} za poziom {level}!',
          },
        },
        { upsert: true }
      );
    });

    it('should save complete configuration with all options', async () => {
      interaction.options.getChannel.mockReturnValue({ id: 'channel-123' });
      interaction.options.getInteger.mockImplementation((name: string) => {
        const values: Record<string, number> = {
          xp_per_msg: 20,
          xp_per_min_vc: 5,
          cooldown_sec: 30,
        };
        return values[name] ?? null;
      });
      interaction.options.getString.mockImplementation((name: string) => {
        const values: Record<string, string> = {
          level_msg: 'Level up!',
          reward_msg: 'New role!',
        };
        return values[name] ?? null;
      });

      await run({ interaction });

      expect(mockLevelConfigModel.findOneAndUpdate).toHaveBeenCalledWith(
        { guildId: 'guild-123' },
        {
          $set: {
            notifyChannelId: 'channel-123',
            xpPerMsg: 20,
            xpPerMinVc: 5,
            cooldownSec: 30,
            levelUpMessage: 'Level up!',
            rewardMessage: 'New role!',
          },
        },
        { upsert: true }
      );
    });

    it('should use upsert to create or update config', async () => {
      interaction.options.getChannel.mockReturnValue({ id: 'channel-123' });
      interaction.options.getInteger.mockReturnValue(null);
      interaction.options.getString.mockReturnValue(null);

      await run({ interaction });

      const call = mockLevelConfigModel.findOneAndUpdate.mock.calls[0];
      expect(call[2]).toEqual({ upsert: true });
    });
  });
});
