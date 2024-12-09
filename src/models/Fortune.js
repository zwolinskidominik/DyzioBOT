const mongoose = require("mongoose");

const fortuneSchema = new mongoose.Schema({
  content: { type: String, required: true },
  addedBy: { type: String, required: false },
});

const fortuneUsageSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  targetId: { type: String, required: true },
  lastUsed: { type: Date, default: Date.now },
  lastUsedDay: { type: Date, default: Date.now },
  dailyUsageCount: { type: Number, default: 0 },
});

fortuneUsageSchema.index({ userId: 1, targetId: 1 });

module.exports = {
  Fortune: mongoose.model("Fortune", fortuneSchema),
  FortuneUsage: mongoose.model("FortuneUsage", fortuneUsageSchema),
};
