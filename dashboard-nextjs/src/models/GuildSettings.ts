import mongoose from "mongoose";

// Kształt musi odzwierciedlać bot/src/models/GuildSettings.ts (osobny projekt npm —
// bez cross-project importu, zgodnie z konwencją reszty dashboardu).
const GuildSettingsSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true },
    language: { type: String, default: "pl" },
    systemNotifyChannelId: { type: String },
  },
  { collection: "guildsettings" }
);

export default mongoose.models.GuildSettings ||
  mongoose.model("GuildSettings", GuildSettingsSchema);
