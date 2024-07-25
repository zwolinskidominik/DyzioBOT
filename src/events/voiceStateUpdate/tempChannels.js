const TempChannel = require("../../models/TempChannel");
const { ChannelType } = require("discord.js");

module.exports = async (oldState, newState) => {
  try {
    const targetChannels = [
      "1247683631246217227", // Kanał Pogadanki
      "1195819702170157147", // Kanał Randka
      "1213825666722832425", // Kanał Trójkącik
      "1204791810325618718", // Kanał Kwadracik
      "1195819357457105017", // Kanał Granko
      "1204513868421009469", // Kanał CS 2 Team
      "1196285106042720376", // Kanał Valo Team
      "1196287248635793468", // Kanał Sala kinowa
    ];

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
