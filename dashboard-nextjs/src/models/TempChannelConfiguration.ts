import mongoose from "mongoose";

export type TempChannelType = "panel" | "standard";

export interface ITempChannelCreator {
  channelId: string;
  type: TempChannelType;
}

export interface ITempChannelConfiguration {
  guildId: string;
  enabled: boolean;
  /** @deprecated legacy field kept for backward compatibility — derived from `creators` on every save. */
  channelIds: string[];
  creators: ITempChannelCreator[];
}

if (mongoose.models.TempChannelConfiguration) {
  delete mongoose.models.TempChannelConfiguration;
}

const TempChannelCreatorSchema = new mongoose.Schema<ITempChannelCreator>(
  {
    channelId: { type: String, required: true },
    type: { type: String, enum: ["panel", "standard"], default: "panel", required: true },
  },
  { _id: false }
);

const TempChannelConfigurationSchema = new mongoose.Schema<ITempChannelConfiguration>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true },
    channelIds: { type: [String], default: [] },
    creators: { type: [TempChannelCreatorSchema], default: [] },
  },
  { timestamps: true }
);

const TempChannelConfigurationModel = mongoose.model<ITempChannelConfiguration>(
  "TempChannelConfiguration",
  TempChannelConfigurationSchema
);

export default TempChannelConfigurationModel;
