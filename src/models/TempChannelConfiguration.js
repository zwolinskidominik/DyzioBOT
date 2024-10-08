const { Schema, model } = require("mongoose");

const tempChannelConfigSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  channelId: {
    type: String,
    required: true,
  },
});

module.exports = model("TempChannelConfiguration", tempChannelConfigSchema);
