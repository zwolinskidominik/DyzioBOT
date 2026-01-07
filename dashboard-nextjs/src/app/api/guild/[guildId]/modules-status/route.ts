import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
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
}, { collection: 'birthdayconfigurations' });
const BirthdayConfig = mongoose.models.BirthdayConfig || mongoose.model('BirthdayConfig', BirthdayConfigSchema);

const GreetingsConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'greetingsconfigurations' });
const GreetingsConfig = mongoose.models.GreetingsConfig || mongoose.model('GreetingsConfig', GreetingsConfigSchema);

const LevelConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'levelconfigs' });
const LevelConfig = mongoose.models.LevelConfig || mongoose.model('LevelConfig', LevelConfigSchema);

const MonthlyStatsConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'monthlystatsconfigs' });
const MonthlyStatsConfig = mongoose.models.MonthlyStatsConfig || mongoose.model('MonthlyStatsConfig', MonthlyStatsConfigSchema);

const ChannelStatsSchema = new mongoose.Schema({
  guildId: String,
  channels: Object,
}, { collection: 'channelstats' });
const ChannelStats = mongoose.models.ChannelStats || mongoose.model('ChannelStats', ChannelStatsSchema);

const TempChannelConfigSchema = new mongoose.Schema({
  guildId: String,
  channelIds: [String],
}, { collection: 'tempchannelconfigurations' });
const TempChannelConfig = mongoose.models.TempChannelConfig || mongoose.model('TempChannelConfig', TempChannelConfigSchema);

const AutoRoleSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'autoroles' });
const AutoRole = mongoose.models.AutoRole || mongoose.model('AutoRole', AutoRoleSchema);

const QuestionConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'questionconfigurations' });
const QuestionConfig = mongoose.models.QuestionConfig || mongoose.model('QuestionConfig', QuestionConfigSchema);

const SuggestionConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'suggestionconfigurations' });
const SuggestionConfig = mongoose.models.SuggestionConfig || mongoose.model('SuggestionConfig', SuggestionConfigSchema);

const TicketConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'ticketconfigs' });
const TicketConfig = mongoose.models.TicketConfig || mongoose.model('TicketConfig', TicketConfigSchema);

const StreamConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'streamconfigurations' });
const StreamConfig = mongoose.models.StreamConfig || mongoose.model('StreamConfig', StreamConfigSchema);

const ReactionRoleSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'reactionroles' });
const ReactionRole = mongoose.models.ReactionRole || mongoose.model('ReactionRole', ReactionRoleSchema);

const LogConfigurationSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'logconfigurations' });
const LogConfiguration = mongoose.models.LogConfiguration || mongoose.model('LogConfiguration', LogConfigurationSchema);

const TournamentConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'tournamentconfigs' });
const TournamentConfig = mongoose.models.TournamentConfig || mongoose.model('TournamentConfig', TournamentConfigSchema);

const GiveawayConfigSchema = new mongoose.Schema({
  guildId: String,
  enabled: Boolean,
}, { collection: 'giveawayconfigs' });
const GiveawayConfig = mongoose.models.GiveawayConfig || mongoose.model('GiveawayConfig', GiveawayConfigSchema);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { guildId } = await params;

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
      ReactionRole.findOne({ guildId }).lean(),
      LogConfiguration.findOne({ guildId }).lean(),
      TournamentConfig.findOne({ guildId }).lean(),
      GiveawayConfig.findOne({ guildId }).lean(),
    ]);

    const status = {
      birthdays: (birthday as any)?.enabled === true,
      greetings: (greetings as any)?.enabled === true,
      levels: (levels as any)?.enabled === true,
      "monthly-stats": (monthlyStats as any)?.enabled === true,
      "channel-stats": !!((channelStats as any)?.channels && Object.keys((channelStats as any).channels).some((key: string) => (channelStats as any).channels[key]?.channelId)),
      "temp-channels": !!((tempChannels as any)?.channelIds && Array.isArray((tempChannels as any).channelIds) && (tempChannels as any).channelIds.length > 0),
      autoroles: (autoRole as any)?.enabled === true,
      qotd: (qotd as any)?.enabled === true,
      suggestions: (suggestions as any)?.enabled === true,
      tickets: (tickets as any)?.enabled === true,
      logs: (logs as any)?.enabled === true,
      "stream-config": (stream as any)?.enabled === true,
      "reaction-roles": (reactionRoles as any)?.enabled === true,
      tournament: (tournament as any)?.enabled === true,
      giveaway: (giveaway as any)?.enabled === true,
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
