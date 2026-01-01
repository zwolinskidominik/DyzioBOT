import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const reactionRoleMappingSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  roleId: { type: String, required: true },
  description: { type: String },
}, { _id: false });

const reactionRoleSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  messageId: { type: String, required: true },
  title: { type: String },
  reactions: { type: [reactionRoleMappingSchema], default: [] },
}, {
  collection: 'reactionroles'
});

if (mongoose.models.ReactionRole) {
  delete mongoose.models.ReactionRole;
}

const ReactionRole = mongoose.model('ReactionRole', reactionRoleSchema);

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
    
    const reactionRoles = await ReactionRole.find({ guildId }).sort({ _id: -1 });
    
    return NextResponse.json(reactionRoles.map(rr => rr.toObject()));
  } catch (error) {
    console.error('Error fetching reaction roles:', error);
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
    const { channelId, title, reactions } = body;

    if (!channelId || !reactions || reactions.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await connectDB();

    const embed = {
      title: title || 'Wybierz swoją rolę',
      description: reactions.map((r: any) => 
        `${r.emoji} - <@&${r.roleId}>${r.description ? ` • ${r.description}` : ''}`
      ).join('\n'),
      color: 0x5865F2,
      footer: { text: 'Kliknij reakcję, aby otrzymać rolę!' },
    };

    const messageResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [embed],
        }),
      }
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error('Failed to send message to Discord:', messageResponse.status, errorText);
      return NextResponse.json({ error: 'Failed to send message to Discord' }, { status: 500 });
    }

    const messageData = await messageResponse.json();
    const messageId = messageData.id;

    for (const reaction of reactions) {
      try {
        let emojiEncoded = reaction.emoji;
        
        const customEmojiMatch = reaction.emoji.match(/<a?:([^:]+):(\d+)>/);
        if (customEmojiMatch) {
          emojiEncoded = `${customEmojiMatch[1]}:${customEmojiMatch[2]}`;
        } else {
          emojiEncoded = encodeURIComponent(reaction.emoji);
        }
        
        const reactionResponse = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${emojiEncoded}/@me`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );
        
        if (!reactionResponse.ok) {
          console.error(`Failed to add reaction ${reaction.emoji}:`, reactionResponse.status);
        }
      } catch (error) {
        console.error('Failed to add reaction:', error);
      }
    }

    const reactionRole = await ReactionRole.create({
      guildId,
      channelId,
      messageId,
      title: title || undefined,
      reactions,
    });

    return NextResponse.json(reactionRole.toObject());
  } catch (error) {
    console.error('Error creating reaction role:', error);
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

    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');

    if (!messageId) {
      return NextResponse.json({ error: 'Missing messageId' }, { status: 400 });
    }

    await connectDB();
    
    const reactionRole = await ReactionRole.findOne({ messageId });
    
    if (reactionRole) {
      try {
        await fetch(
          `https://discord.com/api/v10/channels/${reactionRole.channelId}/messages/${messageId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );
      } catch (error) {
        console.warn('Failed to delete message from Discord:', error);
      }
    }

    await ReactionRole.deleteOne({ messageId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting reaction role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
