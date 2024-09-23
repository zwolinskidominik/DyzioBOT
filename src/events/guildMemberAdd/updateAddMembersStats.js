const ChannelStats = require("../../models/ChannelStats");

module.exports = async (member) => {
  const channelStats = await ChannelStats.findOne({ guildId: member.guild.id });
  if (!channelStats) return;

  const { guild } = member;

  const updateChannelName = async (type, value) => {
    const channelData = channelStats.channels[type];
    if (!channelData || !channelData.channelId) return;

    const channel = guild.channels.cache.get(channelData.channelId);
    if (channel) {
      const newName = channelData.channelName.replace(/<>/g, value);
      if (channel.name !== newName) {
        await channel.setName(newName);
      }
    }
  };

  const peopleCount = guild.members.cache.filter((m) => !m.user.bot).size;
  await updateChannelName("people_channel", peopleCount);

  const botsCount = guild.members.cache.filter((m) => m.user.bot).size;
  await updateChannelName("bots_channel", botsCount);

  if (channelStats.channels.newest_channel) {
    await updateChannelName("newest_channel", member.user.username);
    channelStats.channels.newest_channel.member = member.id;
    await channelStats.save();
  }

  console.log(`Updated channels for new member: ${member.user.tag}`);
};
