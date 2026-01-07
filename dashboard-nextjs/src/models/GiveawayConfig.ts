import mongoose from 'mongoose';

const RoleMultiplierSchema = new mongoose.Schema({
  roleId: { type: String, required: true },
  multiplier: { type: Number, required: true, min: 1 },
}, { _id: false });

const GiveawayConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  additionalNote: { type: String },
  roleMultipliers: { type: [RoleMultiplierSchema], default: [] },
}, { collection: 'giveawayconfigs' });

export default mongoose.models.GiveawayConfig || 
  mongoose.model('GiveawayConfig', GiveawayConfigSchema);
