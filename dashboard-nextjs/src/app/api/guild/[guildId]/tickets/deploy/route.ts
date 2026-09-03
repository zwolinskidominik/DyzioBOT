import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import TicketConfigModel from "@/models/TicketConfig";
import { createAuditLog, diffFields } from "@/lib/auditLog";
import { getPanelBannerAttachment } from "@/lib/ticketPanelBanner";
import { requireGuildAccess } from "@/lib/requireGuildAccess";

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
  // Discord's component emoji validation (select menus, buttons) rejects the trailing
  // variation-selector-16 (U+FE0F, "render as emoji") that many pickers — including ours,
  // src/data/emoji-data.json — attach to ~1 in 4 unicode entries (e.g. "❓️" for ❓). It's
  // cosmetic/redundant for already-emoji-by-default codepoints and Discord's component `name`
  // matcher doesn't expect it, causing a 400 COMPONENT_INVALID_EMOJI even though the exact same
  // string renders fine everywhere else (embeds, message content, our own UI). Stripping it here
  // fixes it for every already-stored type, no DB migration needed — see EmojiPickerPanel.tsx for
  // the matching fix at pick-time, so newly-picked emoji are stored correctly from the start.
  return { name: raw.replace(/\uFE0F$/, "") };
}

/** Discord select-menu option description is capped at 100 chars. */
function truncate(text: string, max: number): string {
  const clean = text.replace(/\{user\}/g, "").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean || "Otwórz zgłoszenie";
}

/**
 * Discord validation errors for our single action row / single select menu look like
 * errors.components["0"].components["0"].options["<index>"].emoji.name._errors[...].
 * Returns the option indices whose emoji Discord rejected — most commonly because the
 * custom emoji was deleted from the server (or the bot lost access to it) after an admin
 * picked it, which the dashboard has no reliable way to detect ahead of time.
 */
function extractInvalidEmojiOptionIndices(errors: unknown): number[] {
  try {
    const root = errors as {
      components?: Record<string, { components?: Record<string, { options?: Record<string, { emoji?: unknown }> }> }>;
    };
    const options = root?.components?.["0"]?.components?.["0"]?.options;
    if (!options || typeof options !== "object") return [];
    return Object.keys(options)
      .filter((key) => Boolean(options[key]?.emoji))
      .map((key) => Number(key))
      .filter((n) => Number.isInteger(n));
  } catch {
    return [];
  }
}

/** Discord's structured error body: {message, code, errors}. Formats it into a short, human-readable string. */
function formatDiscordError(errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as { message?: string; errors?: unknown };
    if (!parsed.message) return errorText.slice(0, 300);
    const detail = parsed.errors ? ` — ${JSON.stringify(parsed.errors).slice(0, 300)}` : "";
    return `${parsed.message}${detail}`;
  } catch {
    return errorText.slice(0, 300);
  }
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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

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

    const types = config.types.slice(0, 25);
    const panelChannelId = config.panelChannelId;

    function buildSelectMenu(skipEmojiForIndices: ReadonlySet<number>) {
      return {
        type: 1,
        components: [
          {
            type: 3,
            custom_id: "ticket-menu",
            placeholder: panelMessage.placeholder.slice(0, 150),
            options: types.map((type, index) => ({
              label: type.name.slice(0, 100),
              description: type.dropdownDescription?.trim()
                ? truncate(type.dropdownDescription, 100)
                : truncate(type.description, 100),
              value: type.id,
              ...(type.emoji && !skipEmojiForIndices.has(index) ? { emoji: parseEmoji(type.emoji) } : {}),
            })),
          },
        ],
      };
    }

    async function sendPanel(skipEmojiForIndices: ReadonlySet<number>) {
      const formData = new FormData();
      formData.append(
        "payload_json",
        JSON.stringify({ embeds: [ticketEmbed], components: [buildSelectMenu(skipEmojiForIndices)] })
      );
      if (bannerAttachment) {
        formData.append(
          "files[0]",
          new Blob([new Uint8Array(bannerAttachment.buffer)], { type: "image/png" }),
          bannerAttachment.filename
        );
      }
      return fetch(`https://discord.com/api/v10/channels/${panelChannelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        body: formData,
      });
    }

    let messageResponse = await sendPanel(new Set());
    let strippedEmojiTypeNames: string[] = [];

    if (!messageResponse.ok) {
      const errorText = await messageResponse.text();
      let parsedErrors: unknown;
      try {
        parsedErrors = (JSON.parse(errorText) as { errors?: unknown }).errors;
      } catch {
        parsedErrors = undefined;
      }

      const invalidEmojiIndices = extractInvalidEmojiOptionIndices(parsedErrors);

      if (invalidEmojiIndices.length > 0) {
        // Diagnostyka: pokaż DOKŁADNIE co jest zapisane w bazie dla wadliwego emoji —
        // gołym okiem string potrafi wyglądać jak poprawne, wbudowane emoji Discorda
        // (np. ❓), a mimo to być zepsuty na poziomie bajtów (zła sekwencja unicode,
        // brakujący/dodatkowy selektor wariantu U+FE0F, itp.) albo mieć postać
        // "<:nazwa:id>" (custom/bot emoji), którą trudno odróżnić na pierwszy rzut oka.
        for (const i of invalidEmojiIndices) {
          const raw = types[i]?.emoji ?? "";
          const codepoints = Array.from(raw).map((ch) => `U+${(ch.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`);
          console.warn(
            `Invalid emoji on type "${types[i]?.name}" (option index ${i}):`,
            "raw =",
            JSON.stringify(raw),
            "| codepoints =",
            codepoints.join(" "),
            "| looks like custom/bot emoji format =",
            /^<a?:[^:]+:\d+>$/.test(raw)
          );
        }

        // Niezależnie od przyczyny (usunięte custom emoji vs zepsuty string) — nie blokujemy
        // całego deployu przez jeden wadliwy typ, tylko wysyłamy ponownie bez tych emoji.
        strippedEmojiTypeNames = invalidEmojiIndices
          .map((i) => types[i]?.name)
          .filter((n): n is string => Boolean(n));
        messageResponse = await sendPanel(new Set(invalidEmojiIndices));
      } else {
        console.error("Failed to send panel message:", messageResponse.status, errorText);
        return NextResponse.json(
          { error: `Discord odrzucił panel (${messageResponse.status}): ${formatDiscordError(errorText)}` },
          { status: 502 }
        );
      }
    }

    if (!messageResponse.ok) {
      const retryErrorText = await messageResponse.text();
      console.error("Failed to send panel message (after emoji retry):", messageResponse.status, retryErrorText);
      return NextResponse.json(
        { error: `Discord odrzucił panel (${messageResponse.status}): ${formatDiscordError(retryErrorText)}` },
        { status: 502 }
      );
    }

    const messageData = await messageResponse.json();

    const result = await TicketConfigModel.findOneAndUpdate(
      { guildId },
      { enabled: true, panelMessageId: messageData.id },
      { new: true }
    );

    const changes = diffFields<{ enabled: boolean; panelMessageId?: string }>(
      config.toObject ? config.toObject() : config,
      { enabled: true, panelMessageId: messageData.id },
      [
        { field: "enabled", label: "Włączony" },
        { field: "panelMessageId", label: "ID wiadomości panelu" },
      ]
    );

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "tickets.deploy",
      module: "tickets",
      description: `Wdrożono panel ticketów na Discord (${config.types.length} typów)`,
      metadata: { panelChannelId: config.panelChannelId, typeCount: config.types.length, strippedEmojiTypeNames },
      changes,
    });

    const warning =
      strippedEmojiTypeNames.length > 0
        ? `Panel wdrożony, ale usunięto nieprawidłowe emoji (prawdopodobnie skasowane z serwera) z: ${strippedEmojiTypeNames.join(", ")}. Wybierz nowe emoji dla ${strippedEmojiTypeNames.length === 1 ? "tego typu" : "tych typów"} w edycji.`
        : undefined;

    const responseBody = result ? { ...result.toObject(), ...(warning ? { warning } : {}) } : { warning };
    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("Error deploying ticket panel:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
