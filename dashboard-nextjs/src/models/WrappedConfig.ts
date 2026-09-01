import mongoose from "mongoose";
import { DEFAULT_WRAPPED_THEME, WrappedTheme, WRAPPED_THEMES } from "@/lib/wrappedThemes";

export interface IWrappedConfig {
  guildId: string;
  channelId?: string;
  enabled: boolean;
  colorTheme: WrappedTheme;
}

const WrappedConfigSchema = new mongoose.Schema<IWrappedConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String },
    enabled: { type: Boolean, default: false },
    colorTheme: { type: String, enum: WRAPPED_THEMES, default: DEFAULT_WRAPPED_THEME },
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
