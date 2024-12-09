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
  userId: {
    type: String,
    required: true,
  },
  isLive: {
    type: Boolean,
    default: false,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

twitchStreamerSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model("TwitchStreamer", twitchStreamerSchema);
