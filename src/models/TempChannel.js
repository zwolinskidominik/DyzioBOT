const { Schema, model } = require("mongoose");

const tempChannelSchema = new Schema({
  guildId: { type: String, required: true },
  parentId: { type: String, required: true },
  channelId: { type: String, required: true },
  ownerId: { type: String, required: true },
});

module.exports = model("TempChannel", tempChannelSchema);
