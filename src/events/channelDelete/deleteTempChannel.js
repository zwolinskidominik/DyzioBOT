const { ChannelType } = require("discord.js");
const TempChannelConfig = require("../../models/TempChannelConfiguration");
const logger = require("../../utils/logger");

module.exports = async (channel) => {
  try {
    if (channel.type !== ChannelType.GuildVoice) return;

    const tempChannel = await TempChannelConfig.findOne({
      channelId: channel.id,
    });
    if (tempChannel) {
      await TempChannelConfig.findOneAndDelete({ channelId: channel.id });
    }
  } catch (error) {
    logger.error(`Błąd podczas obsługi eventu channelDelete: ${error}`);
  }
};
