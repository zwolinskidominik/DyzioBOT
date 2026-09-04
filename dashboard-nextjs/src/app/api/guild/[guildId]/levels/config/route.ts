import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth.config";
import { requireGuildAccess } from "@/lib/requireGuildAccess";
import mongoose from 'mongoose';
import { createAuditLog, diffFields } from "@/lib/auditLog";
import { z } from "zod";

// Whitelist pól POST-a — blokuje mass assignment.
const levelConfigZod = z.object({
  enabled: z.boolean().optional(),
  xpPerMsg: z.number().min(0).max(1000).optional(),
  xpPerMinVc: z.number().min(0).max(1000).optional(),
  cooldownSec: z.number().min(0).max(3600).optional(),
  notifyChannelId: z.string().optional(),
  enableLevelUpMessages: z.boolean().optional(),
  enableRewardMessages: z.boolean().optional(),
  levelUpMessage: z.string().max(2000).optional(),
  rewardMessage: z.string().max(2000).optional(),
  roleRewards: z
    .array(
      z.object({
        level: z.number().int().min(1),
        roleId: z.string(),
        rewardMessage: z.string().max(2000).optional(),
      })
    )
    .optional(),
  roleMultipliers: z
    .array(z.object({ roleId: z.string(), multiplier: z.number().min(0).max(100) }))
    .optional(),
  channelMultipliers: z
    .array(z.object({ channelId: z.string(), multiplier: z.number().min(0).max(100) }))
    .optional(),
  ignoredChannels: z.array(z.string()).optional(),
  ignoredRoles: z.array(z.string()).optional(),
  cardThemeColor: z.string().optional(),
  showRankBadge: z.boolean().optional(),
  removePreviousRewards: z.boolean().optional(),
});

export const dynamic = 'force-dynamic';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const MAX_ROLE_REWARDS = 20;
const DEFAULT_CARD_THEME_COLOR = '#3b82f6';

// Płaski kształt dokumentu używany tylko do porównania w diffFields —
// odseparowany od typu Mongoose (DocumentArray itp.), żeby uniknąć konfliktu typów.
interface IRoleReward {
  level: number;
  roleId: string;
  rewardMessage?: string;
}
interface IRoleMultiplier {
  roleId: string;
  multiplier: number;
}
interface IChannelMultiplier {
  channelId: string;
  multiplier: number;
}
interface ILevelConfig {
  guildId: string;
  enabled: boolean;
  xpPerMsg: number;
  xpPerMinVc: number;
  cooldownSec: number;
  notifyChannelId?: string;
  enableLevelUpMessages: boolean;
  enableRewardMessages: boolean;
  levelUpMessage: string;
  rewardMessage: string;
  roleRewards: IRoleReward[];
  roleMultipliers: IRoleMultiplier[];
  channelMultipliers: IChannelMultiplier[];
  ignoredChannels: string[];
  ignoredRoles: string[];
  cardThemeColor: string;
  showRankBadge: boolean;
  removePreviousRewards: boolean;
}

const levelConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  xpPerMsg: { type: Number, default: 5 },
  xpPerMinVc: { type: Number, default: 10 },
  cooldownSec: { type: Number, default: 0 },
  notifyChannelId: { type: String },
  enableLevelUpMessages: { type: Boolean, default: false },
  enableRewardMessages: { type: Boolean, default: true },
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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { guildId } = await params;
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

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
        enableRewardMessages: true,
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
    const accessError = await requireGuildAccess(session, guildId);
    if (accessError) return accessError;

    const rawBody = await request.json();
    const parsedBody = levelConfigZod.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Nieprawidłowe dane konfiguracji", details: parsedBody.error.flatten() },
        { status: 400 }
      );
    }
    const body = parsedBody.data;
    await connectDB();

    const sanitized = {
      ...body,
      guildId,
      enabled: body.enabled ?? false,
      xpPerMsg: body.xpPerMsg ?? 5,
      xpPerMinVc: body.xpPerMinVc ?? 10,
      cooldownSec: body.cooldownSec ?? 0,
      enableLevelUpMessages: body.enableLevelUpMessages ?? false,
      enableRewardMessages: body.enableRewardMessages ?? true,
      levelUpMessage: body.levelUpMessage ?? '{user} jesteś kozakiem! Wbiłeś/aś: **{level}** level. 👏',
      rewardMessage: body.rewardMessage ?? '{user}! Zdobyto nową rolę na serwerze: {roleId}! Dziękujemy za aktywność!',
      roleMultipliers: body.roleMultipliers ?? [],
      channelMultipliers: body.channelMultipliers ?? [],
      ignoredChannels: body.ignoredChannels ?? [],
      ignoredRoles: body.ignoredRoles ?? [],
      cardThemeColor: body.cardThemeColor && HEX_COLOR_PATTERN.test(body.cardThemeColor)
        ? body.cardThemeColor
        : DEFAULT_CARD_THEME_COLOR,
      showRankBadge: body.showRankBadge !== false,
      removePreviousRewards: body.removePreviousRewards !== false,
      roleRewards: Array.isArray(body.roleRewards)
        ? body.roleRewards.slice(0, MAX_ROLE_REWARDS)
        : [],
    };

    const oldConfig = await LevelConfig.findOne({ guildId }).lean<ILevelConfig>();

    const result = await LevelConfig.findOneAndUpdate(
      { guildId },
      sanitized,
      { upsert: true, new: true }
    );

    const changes = diffFields(oldConfig, sanitized, [
      { field: 'enabled', label: 'Włączony' },
      { field: 'xpPerMsg', label: 'XP za wiadomość' },
      { field: 'xpPerMinVc', label: 'XP za minutę na kanale głosowym' },
      { field: 'cooldownSec', label: 'Cooldown (s)' },
      { field: 'notifyChannelId', label: 'Kanał powiadomień' },
      { field: 'enableLevelUpMessages', label: 'Wiadomość o poziomie' },
      { field: 'enableRewardMessages', label: 'Wiadomość o nagrodzie' },
      { field: 'levelUpMessage', label: 'Treść wiadomości o poziomie' },
      { field: 'rewardMessage', label: 'Treść wiadomości o nagrodzie' },
      { field: 'roleRewards', label: 'Liczba nagród za poziom' },
      { field: 'roleMultipliers', label: 'Liczba mnożników ról' },
      { field: 'channelMultipliers', label: 'Liczba mnożników kanałów' },
      { field: 'ignoredChannels', label: 'Ignorowane kanały' },
      { field: 'ignoredRoles', label: 'Ignorowane role' },
      { field: 'cardThemeColor', label: 'Kolor karty' },
      { field: 'showRankBadge', label: 'Odznaka rangi' },
      { field: 'removePreviousRewards', label: 'Usuwanie poprzednich nagród' },
    ]);

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
      changes,
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
