import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

/**
 * Wykrywa moduły, które są WŁĄCZONE, ale brakuje im pola wymaganego do faktycznego
 * działania (np. enabled=true, ale brak kanału ogłoszeń) — w odróżnieniu od modułów
 * po prostu wyłączonych (to nie błąd, tylko świadomy wybór admina, nie pokazujemy ich tu).
 * Nazwy modeli mają unikalny sufiks "IssueCheck", żeby nie kolidować z modelami
 * rejestrowanymi pod tą samą kolekcją w innych trasach (patrz modules-status/route.ts).
 */

const birthdaySchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, birthdayChannelId: String },
  { collection: "birthdayconfigurations", strict: false }
);
const Birthday = mongoose.models.BirthdayIssueCheck || mongoose.model("BirthdayIssueCheck", birthdaySchema);

const greetingsSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, greetingsChannelId: String },
  { collection: "greetingsconfigurations", strict: false }
);
const Greetings = mongoose.models.GreetingsIssueCheck || mongoose.model("GreetingsIssueCheck", greetingsSchema);

const qotdSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, questionChannelId: String },
  { collection: "questionconfigurations", strict: false }
);
const Qotd = mongoose.models.QotdIssueCheck || mongoose.model("QotdIssueCheck", qotdSchema);

const monthlyStatsSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, channelId: String },
  { collection: "monthlystatsconfigs", strict: false }
);
const MonthlyStats = mongoose.models.MonthlyStatsIssueCheck || mongoose.model("MonthlyStatsIssueCheck", monthlyStatsSchema);

const autoRoleSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, userRoleIds: [String], botRoleIds: [String] },
  { collection: "autoroles", strict: false }
);
const AutoRole = mongoose.models.AutoRoleIssueCheck || mongoose.model("AutoRoleIssueCheck", autoRoleSchema);

const suggestionSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, suggestionChannelId: String },
  { collection: "suggestionconfigurations", strict: false }
);
const Suggestion = mongoose.models.SuggestionIssueCheck || mongoose.model("SuggestionIssueCheck", suggestionSchema);

const ticketSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, categoryId: String },
  { collection: "ticketconfigs", strict: false }
);
const Ticket = mongoose.models.TicketIssueCheck || mongoose.model("TicketIssueCheck", ticketSchema);

const wrappedSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, channelId: String },
  { collection: "wrappedconfigs", strict: false }
);
const Wrapped = mongoose.models.WrappedIssueCheck || mongoose.model("WrappedIssueCheck", wrappedSchema);

const disboardSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, channelId: String },
  { collection: "disboardconfigs", strict: false }
);
const Disboard = mongoose.models.DisboardIssueCheck || mongoose.model("DisboardIssueCheck", disboardSchema);

const streamSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, channelId: String },
  { collection: "streamconfigurations", strict: false }
);
const Stream = mongoose.models.StreamIssueCheck || mongoose.model("StreamIssueCheck", streamSchema);

const logSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean, logChannels: Object },
  { collection: "logconfigurations", strict: false }
);
const Log = mongoose.models.LogIssueCheck || mongoose.model("LogIssueCheck", logSchema);

const reactionRoleConfigSchema = new mongoose.Schema(
  { guildId: String, enabled: Boolean },
  { collection: "reactionroleconfigs", strict: false }
);
const ReactionRoleConfig = mongoose.models.ReactionRoleConfigIssueCheck || mongoose.model("ReactionRoleConfigIssueCheck", reactionRoleConfigSchema);

const reactionRoleSchema = new mongoose.Schema(
  { guildId: String },
  { collection: "reactionroles", strict: false }
);
const ReactionRole = mongoose.models.ReactionRoleIssueCheck || mongoose.model("ReactionRoleIssueCheck", reactionRoleSchema);

interface Issue {
  key: string;
  reason: string;
}

export async function GET(
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

    const [birthday, greetings, qotd, monthlyStats, autoRole, suggestion, ticket, wrapped, disboard, stream, log, rrConfig, rrCount] =
      await Promise.all([
        Birthday.findOne({ guildId }).lean<{ enabled?: boolean; birthdayChannelId?: string } | null>(),
        Greetings.findOne({ guildId }).lean<{ enabled?: boolean; greetingsChannelId?: string } | null>(),
        Qotd.findOne({ guildId }).lean<{ enabled?: boolean; questionChannelId?: string } | null>(),
        MonthlyStats.findOne({ guildId }).lean<{ enabled?: boolean; channelId?: string } | null>(),
        AutoRole.findOne({ guildId }).lean<{ enabled?: boolean; userRoleIds?: string[]; botRoleIds?: string[] } | null>(),
        Suggestion.findOne({ guildId }).lean<{ enabled?: boolean; suggestionChannelId?: string } | null>(),
        Ticket.findOne({ guildId }).lean<{ enabled?: boolean; categoryId?: string } | null>(),
        Wrapped.findOne({ guildId }).lean<{ enabled?: boolean; channelId?: string } | null>(),
        Disboard.findOne({ guildId }).lean<{ enabled?: boolean; channelId?: string } | null>(),
        Stream.findOne({ guildId }).lean<{ enabled?: boolean; channelId?: string } | null>(),
        Log.findOne({ guildId }).lean<{ enabled?: boolean; logChannels?: Record<string, string> } | null>(),
        ReactionRoleConfig.findOne({ guildId }).lean<{ enabled?: boolean } | null>(),
        ReactionRole.countDocuments({ guildId }),
      ]);

    const issues: Issue[] = [];

    if (birthday?.enabled && !birthday.birthdayChannelId) {
      issues.push({ key: "birthdays", reason: "Brak wybranego kanału na ogłoszenia urodzin" });
    }
    if (greetings?.enabled && !greetings.greetingsChannelId) {
      issues.push({ key: "greetings", reason: "Brak wybranego kanału powitań" });
    }
    if (qotd?.enabled && !qotd.questionChannelId) {
      issues.push({ key: "qotd", reason: "Brak wybranego kanału na pytanie dnia" });
    }
    if (monthlyStats?.enabled && !monthlyStats.channelId) {
      issues.push({ key: "monthly-stats", reason: "Brak wybranego kanału na publikację rankingu" });
    }
    if (autoRole?.enabled && !(autoRole.userRoleIds?.length || autoRole.botRoleIds?.length)) {
      issues.push({ key: "autoroles", reason: "Brak wybranych ról do nadawania" });
    }
    if (suggestion?.enabled && !suggestion.suggestionChannelId) {
      issues.push({ key: "suggestions", reason: "Brak wybranego kanału na sugestie" });
    }
    if (ticket?.enabled && !ticket.categoryId) {
      issues.push({ key: "tickets", reason: "Brak wybranej kategorii na tickety" });
    }
    if (wrapped?.enabled && !wrapped.channelId) {
      issues.push({ key: "wrapped", reason: "Brak wybranego kanału na Server Wrapped" });
    }
    if (disboard?.enabled && !disboard.channelId) {
      issues.push({ key: "disboard", reason: "Brak wybranego kanału na przypomnienia" });
    }
    if (stream?.enabled && !stream.channelId) {
      issues.push({ key: "stream-config", reason: "Brak wybranego kanału powiadomień" });
    }
    if (log?.enabled && !Object.values(log.logChannels || {}).some(Boolean)) {
      issues.push({ key: "logs", reason: "Brak wybranego kanału dla jakiegokolwiek zdarzenia" });
    }
    // Opt-out semantics (default true) — brak configu traktujemy jako "enabled".
    if (rrConfig?.enabled !== false && rrCount === 0) {
      issues.push({ key: "reaction-roles", reason: "Brak żadnego panelu ról za reakcje" });
    }

    return NextResponse.json({ issues });
  } catch (error) {
    console.error("Error checking module issues:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
