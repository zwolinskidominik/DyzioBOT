import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from "mongoose";
import TicketConfigModel, {
  ITicketConfig,
  ITicketType,
  ITicketAutomation,
  ITicketPanelMessage,
  TicketBannerMode,
} from "@/models/TicketConfig";
import { createAuditLog, diffFields } from "@/lib/auditLog";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import { z } from "zod";
import { optionalSnowflake, parseJsonBody, snowflake } from "@/lib/apiValidation";
import { requireChannelsInGuild } from "@/lib/guildChannels";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function sanitizeBanner(input: unknown, defaultPresetId = "ticketBanner.png"): ITicketType["banner"] {
  const raw = (input ?? {}) as Record<string, unknown>;
  const mode: TicketBannerMode = raw.mode === "text" ? "text" : raw.mode === "none" ? "none" : "preset";
  if (mode === "none") return { mode: "none" };
  return {
    mode,
    ...(typeof raw.presetId === "string" ? { presetId: raw.presetId } : mode === "preset" ? { presetId: defaultPresetId } : {}),
    ...(typeof raw.text === "string" ? { text: raw.text.slice(0, 100) } : {}),
  };
}

function sanitizeColor(input: unknown, fallback: string): string {
  return typeof input === "string" && HEX_COLOR_PATTERN.test(input) ? input : fallback;
}

/** Duży thumbnail (prawy górny róg embeda) — tylko http(s) URL, brak/niepoprawny → undefined (fallback na ikonę serwera). */
function sanitizeThumbnail(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const trimmed = input.trim().slice(0, 500);
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

function sanitizeTypes(input: unknown): ITicketType[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => {
      const thumbnail = sanitizeThumbnail(t.thumbnail);
      const type: ITicketType = {
        id: String(t.id ?? "").slice(0, 50),
        emoji: String(t.emoji ?? "").slice(0, 100),
        name: String(t.name ?? "").slice(0, 100),
        description: String(t.description ?? "").slice(0, 4000),
        roleIds: Array.isArray(t.roleIds)
          ? t.roleIds.map(String).filter((id) => snowflake.safeParse(id).success).slice(0, 25)
          : [],
        color: sanitizeColor(t.color, "#5865F2"),
        banner: sanitizeBanner(t.banner),
        ...(thumbnail ? { thumbnail } : {}),
        dropdownDescription: typeof t.dropdownDescription === "string" ? t.dropdownDescription.trim().slice(0, 100) : "",
      };
      return type;
    })
    .filter((t) => t.id && t.name);
}

function sanitizePanelMessage(input: unknown): ITicketPanelMessage {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    emoji: typeof raw.emoji === "string" ? raw.emoji : "",
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim().slice(0, 256) : "Kontakt z Administracją",
    description:
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim().slice(0, 4000)
        : "Aby skontaktować się z wybranym działem administracji, wybierz odpowiednią kategorię poniżej:",
    color: sanitizeColor(raw.color, "#5865F2"),
    placeholder:
      typeof raw.placeholder === "string" && raw.placeholder.trim()
        ? raw.placeholder.trim().slice(0, 150)
        : "Wybierz odpowiednią kategorię",
    banner: sanitizeBanner(raw.banner),
  };
}

function sanitizeAutomation(input: unknown): ITicketAutomation {
  const raw = (input ?? {}) as Record<string, unknown>;
  const maxOpenPerUser = Math.max(0, Math.floor(Number(raw.maxOpenPerUser) || 0));
  const autoCloseHours = Math.max(0, Math.floor(Number(raw.autoCloseHours) || 0));
  const transcriptEnabled = Boolean(raw.transcriptEnabled);

  const automation: ITicketAutomation = { maxOpenPerUser, autoCloseHours, transcriptEnabled };
  if (typeof raw.transcriptChannelId === "string" && snowflake.safeParse(raw.transcriptChannelId).success) {
    automation.transcriptChannelId = raw.transcriptChannelId;
  }
  return automation;
}

const ticketConfigBody = z.object({
  enabled: z.boolean().optional(),
  categoryId: optionalSnowflake,
  panelChannelId: optionalSnowflake,
  // Discord pozwala na maks. 25 opcji w menu wyboru panelu.
  types: z.array(z.unknown()).max(25).optional(),
  automation: z.unknown().optional(),
  panelMessage: z.unknown().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    await connectDB();

    const config = await TicketConfigModel.findOne({ guildId });

    return NextResponse.json(
      config
        ? config.toObject()
        : {
            guildId,
            enabled: false,
            categoryId: "",
            panelChannelId: "",
            panelMessageId: "",
            types: [],
            automation: { maxOpenPerUser: 0, autoCloseHours: 0, transcriptEnabled: false },
            panelMessage: sanitizePanelMessage(undefined),
          }
    );
  } catch (error) {
    console.error("Error fetching ticket config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * Persists the ticket configuration only — it does NOT touch the live
 * Discord panel message. Use POST /tickets/deploy to (re)send the panel.
 */
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

    const parsed = await parseJsonBody(request, ticketConfigBody);
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const { enabled, categoryId, panelChannelId } = body;
    // Zagnieżdżone pola mają własne sanitizery (whitelist pól, limity długości) poniżej.
    const types = sanitizeTypes(body.types);
    const automation = sanitizeAutomation(body.automation);
    const panelMessage = sanitizePanelMessage(body.panelMessage);

    // Panel i transkrypty wysyła bot (deploy) - kanały muszą należeć do tego serwera.
    const channelError = await requireChannelsInGuild(guildId, [categoryId, panelChannelId, automation.transcriptChannelId]);
    if (channelError) return channelError;

    await connectDB();

    const oldConfig = await TicketConfigModel.findOne({ guildId }).lean();

    const nextConfig: ITicketConfig = {
      guildId,
      enabled: enabled !== undefined ? enabled : false,
      categoryId: categoryId ?? "",
      panelChannelId: panelChannelId ?? "",
      types,
      automation,
      panelMessage,
    };

    const result = await TicketConfigModel.findOneAndUpdate(
      { guildId },
      nextConfig,
      { upsert: true, returnDocument: "after" }
    );

    const changes = diffFields(oldConfig, nextConfig, [
      { field: "enabled", labelKey: 'enabled' },
      { field: "categoryId", labelKey: 'category' },
      { field: "panelChannelId", labelKey: 'panelChannel' },
      { field: "types", labelKey: 'ticketTypeCount' },
    ]);

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || "unknown",
      username: session.user.name || session.user.email || "Unknown User",
      action: "tickets.update",
      module: "tickets",
      descriptionKey: 'ticketsUpdated',
      descriptionParams: { count: types.length },
      metadata: { categoryId, panelChannelId, typeCount: types.length, automation },
      changes,
    });

    return NextResponse.json(result ? result.toObject() : null);
  } catch (error) {
    console.error("Error updating ticket config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
