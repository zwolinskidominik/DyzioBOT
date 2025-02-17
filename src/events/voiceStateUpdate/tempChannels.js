const TempChannel = require("../../models/TempChannel");
const TempChannelConfiguration = require("../../models/TempChannelConfiguration");
const { ChannelType } = require("discord.js");
const logger = require("../../utils/logger");

/**
 *
 * @param {Function} operation
 * @param {number} attempts
 * @param {number} delayMs
 * @returns {Promise<any>}
 */
async function retryOperation(operation, attempts = 3, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      logger.warn(
        `Próba ${i + 1} nie powiodła się: ${
          error.message
        }. Ponawiam za ${delayMs}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

/**
 *
 * @param {Object} obj
 * @returns {Object}
 */
function removeUndefinedFields(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

module.exports = async (oldState, newState) => {
  try {
    const monitoredChannels = await TempChannelConfiguration.find({
      guildId: newState.guild.id,
    });
    const targetChannels = monitoredChannels.map((config) => config.channelId);

    if (
      targetChannels.includes(newState.channelId) &&
      oldState.channelId !== newState.channelId
    ) {
      const guild = newState.guild;
      const parentChannel = newState.channel.parent;

      if (!guild || !guild.channels) {
        logger.warn("Guild lub guild.channels jest undefined.");
        return;
      }

      const channelOptions = removeUndefinedFields({
        name: newState.channel.name,
        type: ChannelType.GuildVoice,
        parent: parentChannel,
        userLimit: newState.channel.userLimit,
        permissionOverwrites: newState.channel.permissionOverwrites.cache.map(
          (permission) => ({
            id: permission.id,
            allow: permission.allow,
            deny: permission.deny,
            type: permission.type,
          })
        ),
      });

      const newChannel = await retryOperation(
        () => guild.channels.create(channelOptions),
        3,
        1000
      );

      const tempChannel = new TempChannel({
        guildId: guild.id,
        parentId: parentChannel.id,
        channelId: newChannel.id,
        ownerId: newState.member.id,
      });
      await tempChannel.save();

      await retryOperation(() => newState.setChannel(newChannel), 3, 1000);
    }

    if (oldState.channel && oldState.channel.members.size === 0) {
      const tempChannel = await TempChannel.findOne({
        channelId: oldState.channelId,
      });
      if (tempChannel) {
        await retryOperation(() => oldState.channel.delete(), 3, 1000);
        await TempChannel.findOneAndDelete({ channelId: oldState.channelId });
      }
    }
  } catch (error) {
    logger.error(`Error handling voiceStateUpdate event: ${error}`);
  }
};
