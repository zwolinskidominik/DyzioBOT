import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const logConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  logChannels: { type: Object, default: {} },
  enabledEvents: { type: Object, default: {} },
  ignoredChannels: { type: [String], default: [] },
  ignoredRoles: { type: [String], default: [] },
  ignoredUsers: { type: [String], default: [] },
  colorOverrides: { type: Object, default: {} },
}, {
  collection: 'logconfigurations',
  timestamps: true,
});

if (mongoose.models.LogConfiguration) {
  delete mongoose.models.LogConfiguration;
}

const LogConfiguration = mongoose.model('LogConfiguration', logConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    await connectDB();
    
    const config = await LogConfiguration.findOne({ guildId });
    
    return NextResponse.json(config ? config.toObject() : {
      guildId,
      logChannels: {},
      enabledEvents: {},
      ignoredChannels: [],
      ignoredRoles: [],
      ignoredUsers: [],
      colorOverrides: {},
    });
  } catch (error) {
    console.error('Error fetching log config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    const body = await request.json();

    await connectDB();
    
    const result = await LogConfiguration.findOneAndUpdate(
      { guildId },
      { 
        guildId,
        ...body,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating log config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guildId } = await params;
    await connectDB();
    
    await LogConfiguration.findOneAndDelete({ guildId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting log config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
