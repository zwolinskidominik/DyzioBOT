import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';

const antiSpamIncidentSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    rule: { type: String, required: true },
    actionTaken: { type: String, required: true },
  },
  {
    collection: 'antispamincidents',
    timestamps: true,
  }
);

if (mongoose.models.AntiSpamIncident) {
  delete mongoose.models.AntiSpamIncident;
}

const AntiSpamIncident = mongoose.model('AntiSpamIncident', antiSpamIncidentSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje każdy
    // operator w ręcznie pisanym filtrze — bez tego rzuca CastError na $gte.
    const interventions7d = await AntiSpamIncident.countDocuments({
      guildId,
      createdAt: mongoose.trusted({ $gte: since }),
    });

    return NextResponse.json({ interventions7d });
  } catch (error) {
    console.error('Error fetching anti-spam stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
