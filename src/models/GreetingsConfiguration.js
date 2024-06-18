const { Schema, model } = require("mongoose");

const greetingsConfigurationSchema = new Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
  },
  greetingsChannelId: {
    type: String,
    required: true,
  },
});

module.exports = model("GreetingsConfiguration", greetingsConfigurationSchema);
