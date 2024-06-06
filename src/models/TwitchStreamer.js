const mongoose = require("mongoose");

const twitchStreamerSchema = new mongoose.Schema({
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

module.exports = mongoose.model("TwitchStreamer", twitchStreamerSchema);
