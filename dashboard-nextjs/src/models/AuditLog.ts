import mongoose from "mongoose";

export interface IAuditLog {
  guildId: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AuditLogSchema = new mongoose.Schema<IAuditLog>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true },
    action: { type: String, required: true },
    module: { type: String, required: true },
    description: { type: String },
    metadata: { type: Object },
    createdAt: { type: Date, required: true, default: Date.now, index: true },
  },
  { timestamps: false }
);

AuditLogSchema.index({ guildId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });

const AuditLogModel =
  mongoose.models.AuditLog ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLogModel;
