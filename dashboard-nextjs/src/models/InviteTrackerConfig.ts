import mongoose from 'mongoose';

const InviteTrackerConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  logChannelId: { type: String, default: null },
  joinMessage: { type: String, default: '' },
  joinMessageUnknown: { type: String, default: '' },
  joinMessageVanity: { type: String, default: '' },
  leaveMessage: { type: String, default: '' },
}, { collection: 'invitetrackerconfigs' });

export default mongoose.models.InviteTrackerConfig ||
  mongoose.model('InviteTrackerConfig', InviteTrackerConfigSchema);
