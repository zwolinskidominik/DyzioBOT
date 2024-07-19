const { Schema, model } = require("mongoose");

const pollSchema = new Schema({
  authorId: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  answers: [
    {
      text: String,
      emoji: String,
    },
  ],
  allowMultiselect: {
    type: Boolean,
    required: true,
  },
});

module.exports = model("Poll", pollSchema);
