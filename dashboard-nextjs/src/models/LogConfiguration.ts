import mongoose from "mongoose";

export interface ILogConfiguration {
  guildId: string;
  enabled: boolean;
  logChannels: Record<string, string>;
  enabledEvents: Record<string, boolean>;
  ignoredChannels?: string[];
  ignoredRoles?: string[];
  ignoredUsers?: string[];
  colorOverrides?: Record<string, string>;
}

const LogConfigurationSchema = new mongoose.Schema<ILogConfiguration>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    logChannels: { type: Object, default: {} },
    enabledEvents: { type: Object, default: {} },
    ignoredChannels: { type: [String], default: [] },
    ignoredRoles: { type: [String], default: [] },
    ignoredUsers: { type: [String], default: [] },
    colorOverrides: { type: Object, default: {} },
  },
  { timestamps: true }
);

const LogConfigurationModel =
  mongoose.models.LogConfiguration ||
  mongoose.model<ILogConfiguration>("LogConfiguration", LogConfigurationSchema);

export default LogConfigurationModel;
