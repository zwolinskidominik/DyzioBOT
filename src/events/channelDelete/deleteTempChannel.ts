import { ChannelType, GuildChannel } from 'discord.js';
import { TempChannelConfigurationModel } from '../../models/TempChannelConfiguration';
import logger from '../../utils/logger';

export default async function run(channel: GuildChannel): Promise<void> {
  try {
    if (channel.type !== ChannelType.GuildVoice) {
      return;
    }

    const tempChannelConfig = await TempChannelConfigurationModel.findOne({
      channelId: channel.id,
    });

    if (tempChannelConfig) {
      logger.info(`Usuwanie konfiguracji kanału tymczasowego dla ${channel.name} (${channel.id})`);
      await TempChannelConfigurationModel.findOneAndDelete({ channelId: channel.id });
    }
  } catch (error) {
    logger.error(`Błąd podczas obsługi eventu channelDelete: ${error}`);
  }
}
