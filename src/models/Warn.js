const { Schema, model } = require("mongoose");

const warnSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  count: {
    type: Number,
    required: true,
    default: 0,
  },
  warnings: [
    {
      reason: { type: String, required: true },
      date: { type: Date, default: Date.now },
      moderator: { type: String, required: true },
    },
  ],
  banUntil: {
    type: Date,
    default: null,
  },
});

warnSchema.index({ userId: 1, guildId: 1 });

module.exports = model("Warn", warnSchema);
