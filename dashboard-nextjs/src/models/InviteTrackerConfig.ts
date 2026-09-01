import mongoose from 'mongoose';

/**
 * Invite Tracker: join/leave to osobne sekcje — własny kanał, własny przełącznik,
 * własny tryb embed i osobne szablony wiadomości per sytuacja. 1:1 z
 * src/models/InviteTrackerConfig.ts (bot).
 */
const JoinMessagesSchema = new mongoose.Schema(
  {
    normal: { type: String, default: '' },
    selfInvite: { type: String, default: '' },
    unknown: { type: String, default: '' },
    vanity: { type: String, default: '' },
    botAdd: { type: String, default: '' },
  },
  { _id: false },
);

const LeaveMessagesSchema = new mongoose.Schema(
  {
    normal: { type: String, default: '' },
    unknown: { type: String, default: '' },
    vanity: { type: String, default: '' },
    botRemove: { type: String, default: '' },
  },
  { _id: false },
);

const JoinSectionSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    logChannelId: { type: String, default: null },
    embed: { type: Boolean, default: false },
    embedColor: { type: String, default: '' },
    messages: { type: JoinMessagesSchema, default: () => ({}) },
  },
  { _id: false },
);

const LeaveSectionSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    logChannelId: { type: String, default: null },
    embed: { type: Boolean, default: false },
    embedColor: { type: String, default: '' },
    messages: { type: LeaveMessagesSchema, default: () => ({}) },
  },
  { _id: false },
);

const InviteTrackerConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  join: { type: JoinSectionSchema, default: () => ({}) },
  leave: { type: LeaveSectionSchema, default: () => ({}) },
}, { collection: 'invitetrackerconfigs' });

export default mongoose.models.InviteTrackerConfig ||
  mongoose.model('InviteTrackerConfig', InviteTrackerConfigSchema);
