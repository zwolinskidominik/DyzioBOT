const TempChannel = require("../../models/TempChannel");
const TempChannelConfiguration = require("../../models/TempChannelConfiguration");
const { ChannelType } = require("discord.js");

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
        console.error("Guild or guild.channels is undefined");
        return;
      }

      const newChannel = await guild.channels.create({
        name: `${newState.channel.name}`,
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

      const tempChannel = new TempChannel({
        guildId: guild.id,
        parentId: parentChannel.id,
        channelId: newChannel.id,
        ownerId: newState.member.id,
      });
      await tempChannel.save();

      await newState.setChannel(newChannel);
    }

    if (oldState.channel && oldState.channel.members.size === 0) {
      const tempChannel = await TempChannel.findOne({
        channelId: oldState.channelId,
      });

      if (tempChannel) {
        await oldState.channel.delete();
        await TempChannel.findOneAndDelete({ channelId: oldState.channelId });
      }
    }
  } catch (error) {
    console.error("Error handling voiceStateUpdate event", error);
  }
};
