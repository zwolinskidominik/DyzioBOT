const { Schema, model } = require("mongoose");

const channelstatsSchema = new Schema({
  guildId: { type: String, required: true },
  channels: {
    lastJoined: { channelId: String, template: String, member: String },
    users: { channelId: String, template: String },
    bots: { channelId: String, template: String },
    bans: { channelId: String, template: String },
  },
});

channelstatsSchema.index({ guildId: 1 });

module.exports = model("ChannelStats", channelstatsSchema);
