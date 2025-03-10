const { Schema, model } = require("mongoose");

const giveawaySchema = new Schema({
  giveawayId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  prize: { type: String, required: true },
  description: { type: String, required: true },
  winnersCount: { type: Number, required: true },
  endTime: { type: Date, required: true },
  pingRoleId: { type: String },
  active: { type: Boolean, default: true },
  participants: { type: [String], default: [] },
  hostId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

giveawaySchema.index({ guildId: 1 });

module.exports = model("Giveaway", giveawaySchema);
