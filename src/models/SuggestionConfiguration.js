const { Schema, model } = require("mongoose");

const suggestionConfigurationSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  suggestionChannelId: {
    type: String,
    required: true,
  },
});

module.exports = model(
  "SuggestionConfiguration",
  suggestionConfigurationSchema
);
