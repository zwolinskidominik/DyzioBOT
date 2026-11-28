import mongoose from 'mongoose';

/**
 * Pula wróżb /fortune - ta sama kolekcja co w bocie (src/models/Fortune.ts, typegoose → „fortunes”).
 * Bot po wylosowaniu usuwa wróżbę z puli, więc liczba w panelu maleje z każdym użyciem.
 */
const FortuneSchema = new mongoose.Schema(
  {
    content: { type: String, required: true, unique: true },
    addedBy: { type: String },
  },
  { collection: 'fortunes' },
);

export default mongoose.models.Fortune || mongoose.model('Fortune', FortuneSchema);
