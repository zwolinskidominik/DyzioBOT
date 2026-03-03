import mongoose from 'mongoose';

const TournamentConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  channelId: { type: String, default: null },
  messageTemplate: { type: String, default: '' },
  cronSchedule: { type: String, default: '25 20 * * 1' },
  reactionEmoji: { type: String, default: '🎮' },
}, { collection: 'tournamentconfigs' });

export default mongoose.models.TournamentConfig || 
  mongoose.model('TournamentConfig', TournamentConfigSchema);
