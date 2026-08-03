import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import mongoose from 'mongoose';
import { createAuditLog } from "@/lib/auditLog";

export const dynamic = 'force-dynamic';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_ROLE_REWARDS = 20;
const DEFAULT_CARD_THEME_COLOR = '#3b82f6';

const levelConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  xpPerMsg: { type: Number, default: 5 },
  xpPerMinVc: { type: Number, default: 10 },
  cooldownSec: { type: Number, default: 0 },
  notifyChannelId: { type: String },
  enableLevelUpMessages: { type: Boolean, default: false },
  levelUpMessage: { type: String, default: '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏' },
  rewardMessage: { type: String, default: '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!' },
  roleRewards: [{
    level: Number,
    roleId: String,
    rewardMessage: String,
  }],
  roleMultipliers: [{
    roleId: String,
    multiplier: Number,
  }],
  channelMultipliers: [{
    channelId: String,
    multiplier: Number,
  }],
  ignoredChannels: [String],
  ignoredRoles: [String],
  cardThemeColor: { type: String, default: DEFAULT_CARD_THEME_COLOR },
  showRankBadge: { type: Boolean, default: true },
  removePreviousRewards: { type: Boolean, default: true },
}, {
  collection: 'levelconfigs'
});

if (mongoose.models.LevelConfig) {
  delete mongoose.models.LevelConfig;
}

const LevelConfig = mongoose.model('LevelConfig', levelConfigSchema);

async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  await mongoose.connect(process.env.MONGODB_URI!);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ guildId: string }> }
) {
  try {
    const { guildId } = await params;
    await connectDB();

    const config = await LevelConfig.findOne({ guildId }).lean();

    if (!config) {
      return NextResponse.json({
        guildId,
        enabled: false,
        xpPerMsg: 5,
        xpPerMinVc: 10,
        cooldownSec: 0,
        enableLevelUpMessages: false,
        levelUpMessage: '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏',
        rewardMessage: '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!',
        roleRewards: [],
        roleMultipliers: [],
        channelMultipliers: [],
        ignoredChannels: [],
        ignoredRoles: [],
        cardThemeColor: DEFAULT_CARD_THEME_COLOR,
        showRankBadge: true,
        removePreviousRewards: true,
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching level config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch level config' },
      { status: 500 }
    );
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
    const body = await request.json();
    await connectDB();

    const sanitized = {
      ...body,
      guildId,
      cardThemeColor: HEX_COLOR_PATTERN.test(body.cardThemeColor)
        ? body.cardThemeColor
        : DEFAULT_CARD_THEME_COLOR,
      showRankBadge: body.showRankBadge !== false,
      removePreviousRewards: body.removePreviousRewards !== false,
      roleRewards: Array.isArray(body.roleRewards)
        ? body.roleRewards.slice(0, MAX_ROLE_REWARDS)
        : [],
    };

    const result = await LevelConfig.findOneAndUpdate(
      { guildId },
      sanitized,
      { upsert: true, new: true }
    );

    await createAuditLog({
      guildId,
      userId: session.user.id || session.user.name || 'unknown',
      username: session.user.name || session.user.email || 'Unknown User',
      action: 'levels.update',
      module: 'levels',
      description: 'Zaktualizowano konfigurację systemu poziomów',
      metadata: {
        xpPerMsg: body.xpPerMsg,
        xpPerMinVc: body.xpPerMinVc,
        enableLevelUpMessages: body.enableLevelUpMessages,
        roleRewards: body.roleRewards?.length || 0,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error saving level config:', error);
    return NextResponse.json(
      { error: 'Failed to save level config' },
      { status: 500 }
    );
  }
}
