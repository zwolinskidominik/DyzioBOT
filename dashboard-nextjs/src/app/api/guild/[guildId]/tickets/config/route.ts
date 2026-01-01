import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth.config';
import mongoose from 'mongoose';

const ticketConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  categoryId: { type: String, required: true },
  panelChannelId: { type: String },
  panelMessageId: { type: String },
}, {
  collection: 'ticketconfigs'
});

if (mongoose.models.TicketConfig) {
  delete mongoose.models.TicketConfig;
}

const TicketConfig = mongoose.model('TicketConfig', ticketConfigSchema);

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
    
    const config = await TicketConfig.findOne({ guildId });
    
    return NextResponse.json(config ? config.toObject() : { guildId, enabled: true, categoryId: '', panelChannelId: '', panelMessageId: '' });
  } catch (error) {
    console.error('Error fetching ticket config:', error);
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
    const { enabled, categoryId, panelChannelId } = body;

    await connectDB();
    
    // Get existing config to check for previous panel message
    const existingConfig = await TicketConfig.findOne({ guildId });
    
    // Delete previous panel message if it exists
    if (existingConfig?.panelMessageId && existingConfig?.panelChannelId) {
      try {
        const deleteResponse = await fetch(
          `https://discord.com/api/v10/channels/${existingConfig.panelChannelId}/messages/${existingConfig.panelMessageId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
            },
          }
        );
        
        if (!deleteResponse.ok) {
          console.warn('Failed to delete previous panel message:', deleteResponse.status);
        }
      } catch (error) {
        console.warn('Error deleting previous panel message:', error);
      }
    }

    // Send new panel message to Discord
    let newMessageId: string | undefined;
    if (panelChannelId && enabled) {
      try {
        const ticketEmbed = {
          title: 'Kontakt z Administracj\u0105',
          description: 'Aby skontaktowa\u0107 si\u0119 z wybranym dzia\u0142em administracji, wybierz odpowiedni\u0105 kategori\u0119 poni\u017cej:',
          color: 0x5865F2,
          timestamp: new Date().toISOString(),
        };

        const selectMenu = {
          type: 1,
          components: [{
            type: 3,
            custom_id: 'ticket-menu',
            placeholder: 'Wybierz odpowiedni\u0105 kategori\u0119',
            options: [
              { label: 'Pomoc', description: 'Potrzebujesz pomocy? Wybierz t\u0119 opcj\u0119!', value: 'help', emoji: { name: '\u2753' } },
              { label: 'Zg\u0142oszenie', description: 'Chcesz co\u015b zg\u0142osi\u0107? Kliknij tutaj!', value: 'report', emoji: { name: '\ud83c\udfab' } },
              { label: 'Partnerstwa', description: 'Zainteresowany partnerstwem? Wybierz t\u0119 opcj\u0119!', value: 'partnership', emoji: { name: '\ud83e\udd1d' } },
              { label: 'Mam pomys\u0142', description: 'Masz pomys\u0142 na ulepszenie serwera? Podziel si\u0119 nim!', value: 'idea', emoji: { name: '\ud83d\udca1' } },
              { label: 'Odbi\u00f3r nagr\u00f3d', description: 'Chcesz odebra\u0107 nagrod\u0119? Kliknij tutaj!', value: 'rewards', emoji: { name: '\ud83c\udf89' } },
            ],
          }],
        };

        const messageResponse = await fetch(
          `https://discord.com/api/v10/channels/${panelChannelId}/messages`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              embeds: [ticketEmbed],
              components: [selectMenu],
            }),
          }
        );

        if (messageResponse.ok) {
          const messageData = await messageResponse.json();
          newMessageId = messageData.id;
        } else {
          console.error('Failed to send panel message:', messageResponse.status, await messageResponse.text());
        }
      } catch (error) {
        console.error('Error sending panel message to Discord:', error);
      }
    }
    
    const result = await TicketConfig.findOneAndUpdate(
      { guildId },
      { 
        guildId,
        enabled: enabled !== undefined ? enabled : true,
        categoryId,
        panelChannelId,
        panelMessageId: newMessageId,
      },
      { upsert: true, new: true }
    );

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error('Error updating ticket config:', error);
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
    
    await TicketConfig.findOneAndDelete({ guildId });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
