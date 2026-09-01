import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from "mongoose";

async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI!);
}

const BirthdayConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'birthdayconfigurations', strict: false });
const BirthdayConfig = mongoose.models.BirthdayConfig || mongoose.model('BirthdayConfig', BirthdayConfigSchema);

const GreetingsConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'greetingsconfigurations', strict: false });
const GreetingsConfig = mongoose.models.GreetingsConfig || mongoose.model('GreetingsConfig', GreetingsConfigSchema);

const LevelConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'levelconfigs', strict: false });
const LevelConfig = mongoose.models.LevelConfig || mongoose.model('LevelConfig', LevelConfigSchema);

const MonthlyStatsConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'monthlystatsconfigs', strict: false });
const MonthlyStatsConfig = mongoose.models.MonthlyStatsConfig || mongoose.model('MonthlyStatsConfig', MonthlyStatsConfigSchema);

const ChannelStatsSchema = new mongoose.Schema({
  guildId: String,
  channels: Object,
}, { collection: 'channelstats', strict: false });
const ChannelStats = mongoose.models.ChannelStats || mongoose.model('ChannelStats', ChannelStatsSchema);

const TempChannelConfigSchema = new mongoose.Schema({
  guildId: String,
  channelIds: [String],
}, { collection: 'tempchannelconfigurations', strict: false });
const TempChannelConfig = mongoose.models.TempChannelConfig || mongoose.model('TempChannelConfig', TempChannelConfigSchema);

const AutoRoleSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'autoroles', strict: false });
const AutoRole = mongoose.models.AutoRole || mongoose.model('AutoRole', AutoRoleSchema);

const QuestionConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'questionconfigurations', strict: false });
const QuestionConfig = mongoose.models.QuestionConfig || mongoose.model('QuestionConfig', QuestionConfigSchema);

const SuggestionConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'suggestionconfigurations', strict: false });
const SuggestionConfig = mongoose.models.SuggestionConfig || mongoose.model('SuggestionConfig', SuggestionConfigSchema);

const TicketConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'ticketconfigs', strict: false });
const TicketConfig = mongoose.models.TicketConfig || mongoose.model('TicketConfig', TicketConfigSchema);

const StreamConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'streamconfigurations', strict: false });
const StreamConfig = mongoose.models.StreamConfig || mongoose.model('StreamConfig', StreamConfigSchema);

const ReactionRoleSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'reactionroles', strict: false });
const ReactionRole = mongoose.models.ReactionRole || mongoose.model('ReactionRole', ReactionRoleSchema);

// Master on/off switch, separate from the per-panel `enabled` above — lives in its
// own singleton-per-guild collection (see /api/guild/[guildId]/reaction-roles/config).
const ReactionRoleConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'reactionroleconfigs', strict: false });
const ReactionRoleConfig = mongoose.models.ReactionRoleConfigStatus || mongoose.model('ReactionRoleConfigStatus', ReactionRoleConfigSchema);

const LogConfigurationSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'logconfigurations', strict: false });
const LogConfiguration = mongoose.models.LogConfiguration || mongoose.model('LogConfiguration', LogConfigurationSchema);

const TournamentConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'tournamentconfigs', strict: false });
const TournamentConfig = mongoose.models.TournamentConfig || mongoose.model('TournamentConfig', TournamentConfigSchema);

const GiveawayConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'giveawayconfigs', strict: false });
const GiveawayConfig = mongoose.models.GiveawayConfig || mongoose.model('GiveawayConfig', GiveawayConfigSchema);

const AntiSpamConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'antispamconfigs', strict: false });
const AntiSpamModuleConfig = mongoose.models.AntiSpamModuleConfig || mongoose.model('AntiSpamModuleConfig', AntiSpamConfigSchema);

const DisboardConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'disboardconfigs', strict: false });
const DisboardModuleConfig = mongoose.models.DisboardModuleConfig || mongoose.model('DisboardModuleConfig', DisboardConfigSchema);

const InviteTrackerConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'invitetrackerconfigs', strict: false });
const InviteTrackerModuleConfig = mongoose.models.InviteTrackerModuleConfig || mongoose.model('InviteTrackerModuleConfig', InviteTrackerConfigSchema);

const WrappedConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'wrappedconfigs', strict: false });
const WrappedModuleConfig = mongoose.models.WrappedModuleConfig || mongoose.model('WrappedModuleConfig', WrappedConfigSchema);

const CommandConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'commandconfigs', strict: false });
const CommandModuleConfig = mongoose.models.CommandModuleConfig || mongoose.model('CommandModuleConfig', CommandConfigSchema);

const ModerationConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'moderationconfigs', strict: false });
const ModerationModuleConfig = mongoose.models.ModerationModuleConfig || mongoose.model('ModerationModuleConfig', ModerationConfigSchema);

export async function GET(
  req: NextRequest,
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

    const [
      birthday,
      greetings,
      levels,
      monthlyStats,
      channelStats,
      tempChannels,
      autoRole,
      qotd,
      suggestions,
      tickets,
      stream,
      reactionRoles,
      logs,
      tournament,
      giveaway,
      antiSpam,
      wrapped,
    ] = await Promise.all([
      BirthdayConfig.findOne({ guildId }).lean(),
      GreetingsConfig.findOne({ guildId }).lean(),
      LevelConfig.findOne({ guildId }).lean(),
      MonthlyStatsConfig.findOne({ guildId }).lean(),
      ChannelStats.findOne({ guildId }).lean(),
      TempChannelConfig.findOne({ guildId }).lean(),
      AutoRole.findOne({ guildId }).lean(),
      QuestionConfig.findOne({ guildId }).lean(),
      SuggestionConfig.findOne({ guildId }).lean(),
      TicketConfig.findOne({ guildId }).lean(),
      StreamConfig.findOne({ guildId }).lean(),
      ReactionRoleConfig.findOne({ guildId }).lean(),
      LogConfiguration.findOne({ guildId }).lean(),
      TournamentConfig.findOne({ guildId }).lean(),
      GiveawayConfig.findOne({ guildId }).lean(),
      AntiSpamModuleConfig.findOne({ guildId }).lean(),
      WrappedModuleConfig.findOne({ guildId }).lean(),
    ]);

    const disboard = await DisboardModuleConfig.findOne({ guildId }).lean();
    const inviteTracker = await InviteTrackerModuleConfig.findOne({ guildId }).lean();
    const commands = await CommandModuleConfig.findOne({ guildId }).lean();
    const moderation = await ModerationModuleConfig.findOne({ guildId }).lean();

    const status = {
      birthdays: (birthday as any)?.enabled === true,
      greetings: (greetings as any)?.enabled === true,
      levels: (levels as any)?.enabled === true,
      "monthly-stats": (monthlyStats as any)?.enabled === true,
      "channel-stats": !!((channelStats as any)?.channels && Object.keys((channelStats as any).channels).some((key: string) => (channelStats as any).channels[key]?.channelId)),
      // Opt-out semantics (default true) — only explicit `enabled: false` turns this off.
      "temp-channels": (tempChannels as any)?.enabled !== false && !!(
        ((tempChannels as any)?.creators?.length > 0) || ((tempChannels as any)?.channelIds?.length > 0)
      ),
      autoroles: (autoRole as any)?.enabled === true,
      qotd: (qotd as any)?.enabled === true,
      suggestions: (suggestions as any)?.enabled === true,
      tickets: (tickets as any)?.enabled === true,
      logs: (logs as any)?.enabled === true,
      "stream-config": (stream as any)?.enabled === true,
      // Opt-out semantics (default true) — only explicit `enabled: false` turns this off.
      "reaction-roles": (reactionRoles as any)?.enabled !== false,
      tournament: (tournament as any)?.enabled === true,
      giveaway: (giveaway as any)?.enabled === true,
      "anti-spam": (antiSpam as any)?.enabled === true,
      disboard: (disboard as any)?.enabled === true,
      "invite-tracker": (inviteTracker as any)?.enabled === true,
      wrapped: (wrapped as any)?.enabled === true,
      // Opt-out semantics (default true) — only explicit `enabled: false` turns this off.
      commands: (commands as any)?.enabled !== false,
      // Opt-out semantics (default true, patrz ModerationConfig.ts w bocie) — tylko jawne `enabled: false` wyłącza.
      moderation: (moderation as any)?.enabled !== false,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching modules status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
