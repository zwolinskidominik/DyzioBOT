const { Schema, model } = require("mongoose");

const StreamConfigurationSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  channelId: {
    type: String,
    required: true,
  },
});

module.exports = model("StreamConfiguration", StreamConfigurationSchema);
