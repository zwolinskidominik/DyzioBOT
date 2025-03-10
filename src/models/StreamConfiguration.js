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

StreamConfigurationSchema.index({ guildId: 1 });

module.exports = model("StreamConfiguration", StreamConfigurationSchema);
