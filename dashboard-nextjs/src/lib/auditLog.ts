import mongoose from "mongoose";
import AuditLogModel from "@/models/AuditLog";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface CreateAuditLogParams {
  guildId: string;
  userId: string;
  username: string;
  action: string;
  module: string;
  description?: string;
  metadata?: Record<string, any>;
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    await connectDB();
    await AuditLogModel.create({
      ...params,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
