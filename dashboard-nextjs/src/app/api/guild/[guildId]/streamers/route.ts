import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import { requireGuildAccess } from '@/lib/requireGuildAccess';
import mongoose from 'mongoose';
import { validateTwitchUser } from '@/lib/twitchApi';

const twitchStreamerSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  twitchChannel: { type: String, required: true, lowercase: true, trim: true },
  userId: { type: String, required: true },
  isLive: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  // Cache z ostatniego sprawdzenia bota (co ok. 1 minutę) — dashboard czyta tylko z Mongo,
  // bez własnych zapytań do Twitch API.
  title: { type: String },
  game: { type: String },
  viewerCount: { type: Number },
  liveSince: { type: Date },
  thumbnailUrl: { type: String },
  // URL avatara streamera z Twitcha (profile_image_url) — pobierany przy walidacji kanału,
  // bez żadnych dodatkowych zapytań do API.
  avatarUrl: { type: String },
}, {
  collection: 'twitchstreamers'
});

if (mongoose.models.TwitchStreamer) {
  delete mongoose.models.TwitchStreamer;
}

const TwitchStreamer = mongoose.model('TwitchStreamer', twitchStreamerSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  req: NextRequest,
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
    const streamers = await TwitchStreamer.find({ guildId, active: true }).lean();

    return NextResponse.json(streamers);
  } catch (error) {
    console.error('Error fetching streamers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
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

    const { twitchChannel, userId } = await req.json();

    if (!twitchChannel || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate Twitch user exists before saving
    let avatarUrl: string | undefined;
    try {
      const twitchUser = await validateTwitchUser(twitchChannel);
      if (!twitchUser) {
        return NextResponse.json(
          { error: `Użytkownik Twitch „${twitchChannel}" nie istnieje.` },
          { status: 404 },
        );
      }
      avatarUrl = twitchUser.profile_image_url;
    } catch (err) {
      console.error('Twitch validation error:', err);
      // Graceful degradation: allow save if Twitch API is unavailable
    }

    await connectDB();

    const normalizedChannel = twitchChannel.toLowerCase().trim();
    // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje każdy
    // operator w ręcznie pisanym filtrze — bez tego rzuca CastError na $ne.
    const duplicateChannel = await TwitchStreamer.findOne({
      guildId,
      twitchChannel: normalizedChannel,
      userId: mongoose.trusted({ $ne: userId }),
    });
    if (duplicateChannel) {
      return NextResponse.json(
        { error: `Kanał „${normalizedChannel}" jest już na liście.` },
        { status: 409 },
      );
    }

    const existing = await TwitchStreamer.findOne({ guildId, userId });

    if (existing) {
      existing.twitchChannel = normalizedChannel;
      existing.active = true;
      if (avatarUrl) existing.avatarUrl = avatarUrl;
      await existing.save();
      return NextResponse.json(existing.toObject());
    }

    const streamer = await TwitchStreamer.create({
      guildId,
      twitchChannel: twitchChannel.toLowerCase().trim(),
      userId,
      isLive: false,
      active: true,
      avatarUrl,
    });

    return NextResponse.json(streamer.toObject());
  } catch (error) {
    console.error('Error creating streamer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
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

    const { streamerId, twitchChannel, userId } = await req.json();

    if (!streamerId || !twitchChannel || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate Twitch user exists before saving
    let avatarUrl: string | undefined;
    try {
      const twitchUser = await validateTwitchUser(twitchChannel);
      if (!twitchUser) {
        return NextResponse.json(
          { error: `Użytkownik Twitch „${twitchChannel}" nie istnieje.` },
          { status: 404 },
        );
      }
      avatarUrl = twitchUser.profile_image_url;
    } catch (err) {
      console.error('Twitch validation error:', err);
    }

    await connectDB();

    const normalizedChannel = twitchChannel.toLowerCase().trim();
    // mongoose.trusted(): sanitizeFilter (instrumentation.ts) sanityzuje każdy
    // operator w ręcznie pisanym filtrze — bez tego rzuca CastError na $ne.
    const duplicateChannel = await TwitchStreamer.findOne({
      guildId,
      twitchChannel: normalizedChannel,
      _id: mongoose.trusted({ $ne: streamerId }),
    });
    if (duplicateChannel) {
      return NextResponse.json(
        { error: `Kanał „${normalizedChannel}" jest już na liście.` },
        { status: 409 },
      );
    }

    const streamer = await TwitchStreamer.findOneAndUpdate(
      { _id: streamerId, guildId },
      {
        twitchChannel: normalizedChannel,
        userId,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
      { new: true }
    );

    if (!streamer) {
      return NextResponse.json({ error: 'Streamer not found' }, { status: 404 });
    }

    return NextResponse.json(streamer.toObject());
  } catch (error) {
    console.error('Error updating streamer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
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

    const { searchParams } = new URL(req.url);
    const streamerId = searchParams.get('streamerId');

    if (!streamerId) {
      return NextResponse.json({ error: 'Missing streamerId' }, { status: 400 });
    }

    await connectDB();

    await TwitchStreamer.findOneAndDelete({ _id: streamerId, guildId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting streamer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
