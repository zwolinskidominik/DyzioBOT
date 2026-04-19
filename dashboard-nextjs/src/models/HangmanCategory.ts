import mongoose from 'mongoose';

const HangmanCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  emoji: { type: String, required: true },
  words: { type: [String], default: [] },
}, { collection: 'hangmancategories' });

export default mongoose.models.HangmanCategory ||
  mongoose.model('HangmanCategory', HangmanCategorySchema);
