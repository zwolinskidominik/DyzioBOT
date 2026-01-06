import mongoose from "mongoose";

export interface ITempChannelConfiguration {
  guildId: string;
  channelIds: string[];
}

if (mongoose.models.TempChannelConfiguration) {
  delete mongoose.models.TempChannelConfiguration;
}

const TempChannelConfigurationSchema = new mongoose.Schema<ITempChannelConfiguration>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channelIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

const TempChannelConfigurationModel = mongoose.model<ITempChannelConfiguration>(
  "TempChannelConfiguration",
  TempChannelConfigurationSchema
);

export default TempChannelConfigurationModel;
