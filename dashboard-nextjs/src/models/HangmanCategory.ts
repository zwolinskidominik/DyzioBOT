import mongoose from 'mongoose';

const HangmanCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  emoji: { type: String, required: true },
  words: { type: [String], default: [] },
  // Kolejność wyświetlania w panelu — nie wpływa na grę, /wisielec losuje kategorię niezależnie.
  order: { type: Number, default: 0 },
}, { collection: 'hangmancategories' });

export default mongoose.models.HangmanCategory ||
  mongoose.model('HangmanCategory', HangmanCategorySchema);
