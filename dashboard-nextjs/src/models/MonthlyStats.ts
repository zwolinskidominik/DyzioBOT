import mongoose from "mongoose";

/**
 * Read-only mirror bota (src/models/MonthlyStats.ts, Typegoose) — ta sama kolekcja `monthlystats`.
 * Używane wyłącznie do agregacji na potrzeby dashboardowego rendera Wrapped.
 */
export interface IMonthlyStats {
  guildId: string;
  userId: string;
  month: string;
  messageCount: number;
  voiceMinutes: number;
  updatedAt: Date;
}

const MonthlyStatsSchema = new mongoose.Schema<IMonthlyStats>(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    month: { type: String, required: true },
    messageCount: { type: Number, default: 0 },
    voiceMinutes: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: "monthlystats" }
);

const MonthlyStatsModel =
  mongoose.models.MonthlyStats || mongoose.model<IMonthlyStats>("MonthlyStats", MonthlyStatsSchema);

export default MonthlyStatsModel;
