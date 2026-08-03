import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import TicketConfigModel from "@/models/TicketConfig";
import { createAuditLog } from "@/lib/auditLog";
import { getPanelBannerAttachment } from "@/lib/ticketPanelBanner";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

interface DiscordSelectEmoji {
  name: string;
  id?: string;
  animated?: boolean;
}

/** Parse "<a:name:id>" / "<:name:id>" into Discord's select-option emoji shape, or treat as a plain unicode emoji. */
function parseEmoji(raw: string): DiscordSelectEmoji {
  const match = raw.match(/^<(a)?:([^:]+):(\d+)>$/);
  if (match) {
    const [, animated, name, id] = match;
    return { name, id, animated: Boolean(animated) };
  }
  return { name: raw };
}

/** Discord select-menu option description is capped at 100 chars. */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\{user\}/g, "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || "Otwórz zgłoszenie";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    await connectDB();

    const config = await TicketConfigModel.findOne({ guildId });
    if (!config) {
      return NextResponse.json({ error: "Brak zapisanej konfiguracji ticketów" }, { status: 400 });
    }
    if (!config.panelChannelId) {
      return NextResponse.json({ error: "Wybierz najpierw kanał panelu" }, { status: 400 });
    }
    if (!config.types || config.types.length === 0) {
      return NextResponse.json({ error: "Dodaj przynajmniej jeden typ ticketa" }, { status: 400 });
    }

    // Remove the previous panel message, if any, before sending the new one.
    if (config.panelMessageId && config.panelChannelId) {
      try {
        const deleteResponse = await fetch(
          `https://discord.com/api/v10/channels/${config.panelChannelId}/messages/${config.panelMessageId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
          }
        );
        if (!deleteResponse.ok) {
          console.warn("Failed to delete previous panel message:", deleteResponse.status);
        }
      } catch (error) {
        console.warn("Error deleting previous panel message:", error);
      }
    }

    let guildIconUrl: string | undefined;
    try {
      const guildResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      });
      if (guildResponse.ok) {
        const guildData = await guildResponse.json();
        if (guildData.icon) {
          guildIconUrl = `https://cdn.discordapp.com/icons/${guildId}/${guildData.icon}.png`;
        }
      }
    } catch (error) {
      console.warn("Error fetching guild icon:", error);
    }

    const panelMessage = config.panelMessage ?? {
      title: "Kontakt z Administracją",
      description: "Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:",
      color: "#5865F2",
      placeholder: "Wybierz odpowiednią kategorię",
      banner: { mode: "preset" as const, presetId: "ticketBanner.png" },
    };

    const bannerAttachment = await getPanelBannerAttachment(panelMessage.banner);

    const embedColor = /^#[0-9a-fA-F]{6}$/.test(panelMessage.color)
      ? parseInt(panelMessage.color.slice(1), 16)
      : 0x5865f2;

    const embedTitle = panelMessage.emoji ? `${panelMessage.emoji} ${panelMessage.title}` : panelMessage.title;

    const ticketEmbed = {
      title: embedTitle.slice(0, 256),
      description: panelMessage.description.slice(0, 4000),
      color: embedColor,
      timestamp: new Date().toISOString(),
      thumbnail: guildIconUrl ? { url: guildIconUrl } : undefined,
      ...(bannerAttachment ? { image: { url: `attachment://${bannerAttachment.filename}` } } : {}),
    };

    const selectMenu = {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: "ticket-menu",
          placeholder: panelMessage.placeholder.slice(0, 150),
          options: config.types.slice(0, 25).map((type) => ({
            label: type.name.slice(0, 100),
            description: truncate(type.description, 100),
            value: type.id,
            ...(type.emoji ? { emoji: parseEmoji(type.emoji) } : {}),
          })),
        },
      ],
    };

    const formData = new FormData();
    formData.append("payload_json", JSON.stringify({ embeds: [ticketEmbed], components: [selectMenu] }));
    if (bannerAttachment) {
      formData.append(
        "files[0]",
        new Blob([new Uint8Array(bannerAttachment.buffer)], { type: "image/png" }),
        bannerAttachment.filename
      );
    }

    const messageResponse = await fetch(
      `https://discord.com/api/v10/channels/${config.panelChannelId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        body: formData,
      }
    );

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      console.error("Failed to send panel message:", messageResponse.status, errorText);
      return NextResponse.json({ error: "Nie udało się wysłać panelu na Discord" }, { status: 502 });
    }

    const messageData = await messageResponse.json();

    const result = await TicketConfigModel.findOneAndUpdate(
      { guildId },
      { enabled: true, panelMessageId: messageData.id },
      { new: true }
    );

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "tickets.deploy",
      module: "tickets",
      description: `Wdrożono panel ticketów na Discord (${config.types.length} typów)`,
      metadata: { panelChannelId: config.panelChannelId, typeCount: config.types.length },
    });

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error("Error deploying ticket panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
