const { Schema, model } = require('mongoose');

const birthdaySchema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
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
});

module.exports = model('Birthday', birthdaySchema);
