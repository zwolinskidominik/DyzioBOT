import mongoose from "mongoose";

export interface IMonthlyStatsConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  topCount: number;
}

const MonthlyStatsConfigSchema = new mongoose.Schema<IMonthlyStatsConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String },
    enabled: { type: Boolean, default: false },
    topCount: { type: Number, default: 10, min: 1, max: 25 },
  },
  { 
    collection: 'monthlystatsconfigs',
    timestamps: true 
  }
);

const MonthlyStatsConfigModel =
  mongoose.models.MonthlyStatsConfig ||
  mongoose.model<IMonthlyStatsConfig>("MonthlyStatsConfig", MonthlyStatsConfigSchema);

export default MonthlyStatsConfigModel;
