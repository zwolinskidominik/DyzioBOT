const { Schema, model } = require("mongoose");

const channelSchema = new Schema({
  channelName: { type: String, default: null },
  channelId: { type: String, default: null },
});

const channelstatsSchema = new Schema({
  guildId: { type: String, required: true },
  channels: {
    people: channelSchema,
    bots: channelSchema,
    bans: channelSchema,
    newest: { ...channelSchema.obj, member: { type: String, default: null } },
  },
});

module.exports = model("ChannelStats", channelstatsSchema);
