import mongoose from "mongoose";

export interface IWrappedConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
}

const WrappedConfigSchema = new mongoose.Schema<IWrappedConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String },
    enabled: { type: Boolean, default: false },
  },
  {
    collection: 'wrappedconfigs',
    timestamps: true,
  }
);

const WrappedConfigModel =
  mongoose.models.WrappedConfig ||
  mongoose.model<IWrappedConfig>("WrappedConfig", WrappedConfigSchema);

export default WrappedConfigModel;
