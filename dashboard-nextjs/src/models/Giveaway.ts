import mongoose from "mongoose";

/**
 * Read-only mirror bota (src/models/Giveaway.ts, Typegoose) — ta sama kolekcja `giveaways`.
 * Nie mylić z GiveawayConfig.ts (konfiguracja mnożników dashboardu) — to są realne wpisy giveawayów.
 * Używane wyłącznie do agregacji na potrzeby dashboardowego rendera Wrapped.
 */
export interface IGiveaway {
  giveawayId: string;
  guildId: string;
  channelId: string;
  messageId: string;
  prize: string;
  description: string;
  winnersCount: number;
  endTime: Date;
  pingRoleId?: string;
  imageUrl?: string;
  active: boolean;
  participants: string[];
  hostId: string;
  createdAt: Date;
  finalized: boolean;
  winners: string[];
}

const GiveawaySchema = new mongoose.Schema<IGiveaway>(
  {
    giveawayId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    prize: { type: String, required: true },
    description: { type: String, required: true },
    winnersCount: { type: Number, required: true },
    endTime: { type: Date, required: true },
    pingRoleId: { type: String },
    imageUrl: { type: String },
    active: { type: Boolean, default: true },
    participants: { type: [String], default: [] },
    hostId: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    finalized: { type: Boolean, default: false },
    winners: { type: [String], default: [] },
  },
  { collection: "giveaways", timestamps: false }
);

const GiveawayModel = mongoose.models.Giveaway || mongoose.model<IGiveaway>("Giveaway", GiveawaySchema);

export default GiveawayModel;
