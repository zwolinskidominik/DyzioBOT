const { Schema, model } = require("mongoose");

const channelSchema = new Schema({
  channelName: { type: String, default: null },
  channelId: { type: String, default: null },
});

const channelstatsSchema = new Schema({
  guildId: String,
  channels: {
    lastJoined: { channelId: String, template: String, member: String },
    users: { channelId: String, template: String },
    bots: { channelId: String, template: String },
    bans: { channelId: String, template: String },
  },
});

module.exports = model("ChannelStats", channelstatsSchema);
