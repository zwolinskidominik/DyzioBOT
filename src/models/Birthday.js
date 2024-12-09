// src/models/Birthday.js

const { Schema, model } = require("mongoose");

const birthdaySchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  guildId: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  yearSpecified: {
    type: Boolean,
    required: true,
    default: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
});

birthdaySchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = model("Birthday", birthdaySchema);
