const { Schema, model } = require("mongoose");

const twitchStreamerSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  twitchChannel: {
    type: String,
    required: true,
  },
  isLive: {
    type: Boolean,
    default: false,
  },
});

module.exports = model("TwitchStreamer", twitchStreamerSchema);
