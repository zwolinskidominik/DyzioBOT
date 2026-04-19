import mongoose from 'mongoose';

const WordleWordSchema = new mongoose.Schema(
  {
    word:   { type: String, required: true, unique: true },
    length: { type: Number, required: true, min: 4, max: 11 },
  },
  { collection: 'wordlewords' },
);

/** Automatically sync `length` from `word` before save */
WordleWordSchema.pre('save', function () {
  this.length = (this.word as string).length;
});

export default mongoose.models.WordleWord ||
  mongoose.model('WordleWord', WordleWordSchema);
