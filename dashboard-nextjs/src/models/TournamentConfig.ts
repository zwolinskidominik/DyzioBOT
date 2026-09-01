import mongoose from 'mongoose';

const TournamentConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String, default: null },
  messageTemplate: { type: String, default: '' },
  cronSchedule: { type: String, default: '25 20 * * 1' },
  reactionEmoji: { type: String, default: '🎮' },
  messageMode: { type: String, default: 'text' },
  embedColor: { type: String, default: '#3b82f6' },
  titleText: { type: String, default: '🏆 Turniej CS2' },
  footerText: { type: String, default: '' },
  participantRoleId: { type: String, default: null },
  organizerRoleId: { type: String, default: null },
  organizerUserIds: { type: [String], default: [] },
  voiceChannelId: { type: String, default: null },
}, { collection: 'tournamentconfigs' });

export default mongoose.models.TournamentConfig || 
  mongoose.model('TournamentConfig', TournamentConfigSchema);
