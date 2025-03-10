const mongoose = require("mongoose");

const clipSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
  },
  authorId: {
    type: String,
    required: true,
  },
  messageLink: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  votes: [
    {
      juryId: String,
      score: Number,
    },
  ],
});

clipSchema.methods.getAverageScore = function () {
  if (!this.votes.length) return 0;
  const sum = this.votes.reduce((acc, vote) => acc + vote.score, 0);
  return sum / this.votes.length;
};

clipSchema.statics.clearAll = async function () {
  await this.deleteMany({});
};

clipSchema.index({ authorId: 1 });

module.exports = mongoose.model("Clip", clipSchema);
