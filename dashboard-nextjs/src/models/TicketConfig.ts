import mongoose from "mongoose";

export type TicketBannerMode = "preset" | "text" | "none";

export interface ITicketTypeBanner {
  mode: TicketBannerMode;
  presetId?: string;
  text?: string;
}

export interface ITicketType {
  id: string;
  emoji: string;
  name: string;
  description: string;
  roleIds: string[];
  color: string;
  banner: ITicketTypeBanner;
}

export interface ITicketAutomation {
  maxOpenPerUser: number;
  autoCloseHours: number;
  transcriptEnabled: boolean;
  transcriptChannelId?: string;
}

export interface ITicketPanelMessage {
  emoji?: string;
  title: string;
  description: string;
  color: string;
  placeholder: string;
  banner: ITicketTypeBanner;
}

export interface ITicketConfig {
  guildId: string;
  enabled: boolean;
  categoryId: string;
  panelChannelId?: string;
  panelMessageId?: string;
  types: ITicketType[];
  automation: ITicketAutomation;
  panelMessage: ITicketPanelMessage;
}

if (mongoose.models.TicketConfig) {
  delete mongoose.models.TicketConfig;
}

const TicketTypeBannerSchema = new mongoose.Schema<ITicketTypeBanner>(
  {
    mode: { type: String, enum: ["preset", "text", "none"], default: "preset", required: true },
    presetId: { type: String },
    text: { type: String },
  },
  { _id: false }
);

const TicketTypeSchema = new mongoose.Schema<ITicketType>(
  {
    id: { type: String, required: true },
    emoji: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    roleIds: { type: [String], default: [] },
    color: { type: String, default: "#5865F2" },
    banner: { type: TicketTypeBannerSchema, default: () => ({ mode: "preset" }) },
  },
  { _id: false }
);

const TicketAutomationSchema = new mongoose.Schema<ITicketAutomation>(
  {
    maxOpenPerUser: { type: Number, default: 0 },
    autoCloseHours: { type: Number, default: 0 },
    transcriptEnabled: { type: Boolean, default: false },
    transcriptChannelId: { type: String },
  },
  { _id: false }
);

const TicketPanelMessageSchema = new mongoose.Schema<ITicketPanelMessage>(
  {
    emoji: { type: String, default: "" },
    title: { type: String, default: "Kontakt z Administracją" },
    description: {
      type: String,
      default: "Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:",
    },
    color: { type: String, default: "#5865F2" },
    placeholder: { type: String, default: "Wybierz odpowiednią kategorię" },
    banner: { type: TicketTypeBannerSchema, default: () => ({ mode: "preset", presetId: "ticketBanner.png" }) },
  },
  { _id: false }
);

const TicketConfigSchema = new mongoose.Schema<ITicketConfig>(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    categoryId: { type: String, required: true },
    panelChannelId: { type: String },
    panelMessageId: { type: String },
    types: { type: [TicketTypeSchema], default: [] },
    automation: { type: TicketAutomationSchema, default: () => ({}) },
    panelMessage: { type: TicketPanelMessageSchema, default: () => ({}) },
  },
  { collection: "ticketconfigs" }
);

const TicketConfigModel = mongoose.model<ITicketConfig>("TicketConfig", TicketConfigSchema);

export default TicketConfigModel;
