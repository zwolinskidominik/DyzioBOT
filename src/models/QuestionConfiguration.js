const { Schema, model } = require("mongoose");

const questionConfigurationSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  questionChannelId: {
    type: String,
    required: true,
  },
  pingRoleId: {
    type: String,
    required: false,
  },
});

module.exports = model("QuestionConfiguration", questionConfigurationSchema);
