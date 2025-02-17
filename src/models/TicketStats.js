const { Schema, model } = require("mongoose");

const ticketStatsSchema = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  count: { type: Number, default: 0 },
});

// Unikalny indeks na kombinację guildId i userId
ticketStatsSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = model("TicketStats", ticketStatsSchema);
