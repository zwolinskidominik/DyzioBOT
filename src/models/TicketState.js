const { Schema, model } = require("mongoose");

const ticketStateSchema = new Schema({
  channelId: { type: String, required: true, unique: true },
  assignedTo: { type: String, default: null },
});

module.exports = model("TicketState", ticketStateSchema);
