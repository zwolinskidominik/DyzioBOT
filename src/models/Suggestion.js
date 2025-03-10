const { Schema, model } = require("mongoose");
const { randomUUID } = require("crypto");

const suggestionSchema = new Schema(
  {
    suggestionId: {
      type: String,
      default: randomUUID,
    },
    authorId: {
      type: String,
      required: true,
    },
    guildId: {
      type: String,
      required: true,
    },
    messageId: {
      type: String,
      required: true,
      unique: true,
    },
    content: {
      type: String,
      required: true,
    },
    upvotes: {
      type: [String],
      default: [],
    },
    upvoteUsernames: {
      type: [String],
      default: [],
    },
    downvotes: {
      type: [String],
      default: [],
    },
    downvoteUsernames: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

suggestionSchema.index({ guildId: 1 });

module.exports = model("Suggestion", suggestionSchema);
