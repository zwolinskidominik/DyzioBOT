const { Schema, model } = require("mongoose");

const birthdayConfigurationSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  birthdayChannelId: {
    type: String,
    required: true,
  },
});

module.exports = model("BirthdayConfiguration", birthdayConfigurationSchema);
