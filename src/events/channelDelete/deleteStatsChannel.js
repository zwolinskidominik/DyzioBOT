const ChannelStats = require("../../models/ChannelStats");

module.exports = async (channel) => {
  if (channel.type !== "GUILD_VOICE" && channel.type !== "GUILD_TEXT") return;

  const channelStats = await ChannelStats.findOne({
    guildId: channel.guild.id,
  });
  if (!channelStats) return;

  const channelTypes = ["people", "bots", "bans", "newest"];
  for (const type of channelTypes) {
    if (channelStats.channels[type]?.channelId === channel.id) {
      channelStats.channels[type] = {
        channelId: null,
        channelName: null,
      };
    }
  }

  await channelStats.save();
};
