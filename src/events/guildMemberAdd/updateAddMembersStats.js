const ChannelStats = require("../../models/ChannelStats");

module.exports = async (member) => {
  const channelStats = await ChannelStats.findOne({ guildId: member.guild.id });
  if (!channelStats) return;

  const { guild } = member;

  const peopleCount = guild.memberCount;

  const updateChannelName = async (type, value) => {
    const channelId = channelStats.channels[type]?.channelId;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (channel) {
      const newName = channelStats.channels[type].channelName.replace(
        /<>/g,
        value
      );
      if (channel.name !== newName) {
        await channel.setName(newName);
      }
    }
  };

  await updateChannelName("people", peopleCount);

  if (channelStats.channels.newest?.channelId) {
    await updateChannelName("newest", member.displayName);
    channelStats.channels.newest.member = member.id;
    await channelStats.save();
  }
};
