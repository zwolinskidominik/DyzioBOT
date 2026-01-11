import mongoose, { Schema, Document } from 'mongoose';

export interface ICS2Investment extends Document {
  userId: string;
  name: string;
  buyPrice: number;
  quantity: number;
  currentPrice: number;
  addedAt: Date;
  priceHistory: {
    date: Date;
    price: number;
  }[];
  imageUrl?: string;
}

const CS2InvestmentSchema = new Schema<ICS2Investment>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  buyPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, default: 1 },
  currentPrice: { type: Number, required: true },
  addedAt: { type: Date, default: Date.now },
  priceHistory: [{
    date: { type: Date, default: Date.now },
    price: { type: Number, required: true }
  }],
  imageUrl: { type: String },
}, {
  timestamps: true,
});

// Compound index for faster queries
CS2InvestmentSchema.index({ userId: 1, name: 1 });

export default mongoose.models.CS2Investment || mongoose.model<ICS2Investment>('CS2Investment', CS2InvestmentSchema);
