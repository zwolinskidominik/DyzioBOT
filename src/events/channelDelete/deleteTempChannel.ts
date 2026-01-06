import { ChannelType, GuildChannel } from 'discord.js';
import { TempChannelConfigurationModel } from '../../models/TempChannelConfiguration';
import logger from '../../utils/logger';

export default async function run(channel: GuildChannel): Promise<void> {
  try {
    if (channel.type !== ChannelType.GuildVoice) {
      return;
    }

    const tempChannelConfig = await TempChannelConfigurationModel.findOne({
      guildId: channel.guild.id,
      channelIds: channel.id,
    });

    if (tempChannelConfig) {
      logger.info(`Usuwanie kanału kreatora z konfiguracji: ${channel.name} (${channel.id})`);
      await TempChannelConfigurationModel.findOneAndUpdate(
        { guildId: channel.guild.id },
        { $pull: { channelIds: channel.id } }
      );
    }
  } catch (error) {
    logger.error(`Błąd podczas obsługi eventu channelDelete: ${error}`);
  }
}
