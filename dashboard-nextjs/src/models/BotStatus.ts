import mongoose from "mongoose";

/**
 * Odbicie 1:1 modelu src/models/BotStatus.ts po stronie bota — jeden dokument (key='main'),
 * który bot nadpisuje co ~20 s w src/events/clientReady/botStatusHeartbeat.ts.
 */
const BotStatusSchema = new mongoose.Schema(
  {
    key: String,
    ping: Number,
    updatedAt: Date,
  },
  { collection: "botstatus", strict: false }
);

export interface BotStatusDoc {
  ping: number;
  updatedAt: Date;
}

/** Heartbeat starszy niż to = bot offline (rozłączony, zawieszony albo wyłączony). */
export const BOT_HEARTBEAT_STALE_MS = 90_000;

export default mongoose.models.BotStatus || mongoose.model("BotStatus", BotStatusSchema);
