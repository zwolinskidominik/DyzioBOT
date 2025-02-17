const { Schema, model } = require("mongoose");

const ticketConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  categoryId: { type: String, required: true },
});

module.exports = model("TicketConfig", ticketConfigSchema);
