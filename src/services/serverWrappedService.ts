import { Guild, GuildMember } from 'discord.js';
import mongoose from 'mongoose';
import { createCanvas, loadImage } from 'canvas';
import { registerProjectFonts, roundRect, formatNumberDotSep, formatNumberCompact } from '../utils/canvasHelpers';
import { MonthlyStatsModel } from '../models/MonthlyStats';
import { LevelModel } from '../models/Level';
import { LevelSnapshotModel } from '../models/LevelSnapshot';
import { GiveawayModel } from '../models/Giveaway';
import { WordleStatModel } from '../models/WordleStat';
import { InviteEntryModel } from '../models/InviteEntry';


// ─── Types ────────────────────────────────────────────────────────────────────

interface TopUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  value: number;
}

export interface WrappedData {
  serverName: string;
  serverIconUrl: string | null;
  memberCount: number;
  ageYears: number;
  totalMessages: number;
  totalVoiceHours: number;
  totalGiveaways: number;
  totalWordleGames: number;
  totalInvites: number;
  topMessages: TopUser[];
  topVoice: TopUser[];
  topLevel: TopUser[];
}

// ─── Data collection ──────────────────────────────────────────────────────────

export async function collectWrappedData(guild: Guild): Promise<WrappedData> {
  const guildId = guild.id;

  // Server age (founded November 11, 2022)
  const SERVER_BIRTHDAY = new Date('2022-11-11');
  const ageMs = Date.now() - SERVER_BIRTHDAY.getTime();
  const ageYears = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));

  // Aggregate all monthly stats  
  const msgAgg = await MonthlyStatsModel.aggregate([
    { $match: { guildId } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: '$messageCount' },
        totalVoiceMinutes: { $sum: '$voiceMinutes' },
      },
    },
  ]);
  const totalMessages = msgAgg[0]?.totalMessages ?? 0;
  const totalVoiceHours = Math.round((msgAgg[0]?.totalVoiceMinutes ?? 0) / 60);

  // Top 3 by messages (all time)
  const topMsgRaw = await MonthlyStatsModel.aggregate([
    { $match: { guildId } },
    { $group: { _id: '$userId', total: { $sum: '$messageCount' } } },
    { $sort: { total: -1 } },
    { $limit: 3 },
  ]);

  // Top 3 by voice (all time)
  const topVcRaw = await MonthlyStatsModel.aggregate([
    { $match: { guildId } },
    { $group: { _id: '$userId', total: { $sum: '$voiceMinutes' } } },
    { $sort: { total: -1 } },
    { $limit: 3 },
  ]);

  // Top 3 by level
  const topLvlRaw = await LevelModel.find({ guildId })
    .sort({ level: -1, xp: -1 })
    .limit(3)
    .lean();

  // Giveaways count
  const totalGiveaways = await GiveawayModel.countDocuments({ guildId });

  // Wordle games
  const wordleAgg = await WordleStatModel.aggregate([
    { $match: { guildId } },
    { $group: { _id: null, total: { $sum: { $add: ['$wins', '$losses'] } } } },
  ]);
  const totalWordleGames = wordleAgg[0]?.total ?? 0;

  // Invites
  const totalInvites = await InviteEntryModel.countDocuments({ guildId });

  // Resolve user info
  async function resolveUsers(raw: { _id: string; total: number }[]): Promise<TopUser[]> {
    const results: TopUser[] = [];
    for (const r of raw) {
      try {
        const member = await guild.members.fetch(r._id);
        results.push({
          userId: r._id,
          displayName: member.displayName,
          avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 128 }),
          value: r.total,
        });
      } catch {
        results.push({
          userId: r._id,
          displayName: 'Nieznany',
          avatarUrl: null,
          value: r.total,
        });
      }
    }
    return results;
  }

  const topMessages = await resolveUsers(topMsgRaw);
  const topVoice = await resolveUsers(topVcRaw);

  const topLevel: TopUser[] = [];
  for (const l of topLvlRaw) {
    try {
      const member = await guild.members.fetch(l.userId);
      topLevel.push({
        userId: l.userId,
        displayName: member.displayName,
        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 128 }),
        value: l.level,
      });
    } catch {
      topLevel.push({
        userId: l.userId,
        displayName: 'Nieznany',
        avatarUrl: null,
        value: l.level,
      });
    }
  }

  return {
    serverName: guild.name,
    serverIconUrl: guild.iconURL({ extension: 'png', size: 256 }),
    memberCount: guild.memberCount,
    ageYears,
    totalMessages,
    totalVoiceHours,
    totalGiveaways,
    totalWordleGames,
    totalInvites,
    topMessages,
    topVoice,
    topLevel,
  };
}

// ─── Motywy kolorystyczne ─────────────────────────────────────────────────────

export const WRAPPED_THEMES = ['violet', 'midnight', 'emerald', 'sunset', 'amber', 'graphite'] as const;
export type WrappedTheme = (typeof WRAPPED_THEMES)[number];
export const DEFAULT_WRAPPED_THEME: WrappedTheme = 'violet';

interface ThemePalette {
  bg: string;
  tile: string;
  tileBorder: string;
  accent: string;
  border: string;
  /** [r, g, b] + alpha dla dwóch dekoracyjnych "glow" plam w tle. */
  glowA: { rgb: string; alpha: number };
  glowB: { rgb: string; alpha: number };
}

/** Wartości 1:1 z zatwierdzonego prototypu (dashboard-nextjs/src/lib/wrappedThemes.ts). */
const THEME_PALETTES: Record<WrappedTheme, ThemePalette> = {
  violet: {
    bg: '#100f1e', tile: '#1d1b35', tileBorder: 'rgba(139,125,251,0.16)',
    accent: '#a89bff', border: 'rgba(139,125,251,0.3)',
    glowA: { rgb: '139,125,251', alpha: 0.3 }, glowB: { rgb: '59,130,246', alpha: 0.22 },
  },
  midnight: {
    bg: '#080f1d', tile: '#152238', tileBorder: 'rgba(96,165,250,0.16)',
    accent: '#7cb8ff', border: 'rgba(96,165,250,0.3)',
    glowA: { rgb: '96,165,250', alpha: 0.28 }, glowB: { rgb: '14,165,233', alpha: 0.2 },
  },
  emerald: {
    bg: '#05100d', tile: '#0f2119', tileBorder: 'rgba(52,211,153,0.14)',
    accent: '#34d399', border: 'rgba(52,211,153,0.28)',
    glowA: { rgb: '16,185,129', alpha: 0.26 }, glowB: { rgb: '13,148,136', alpha: 0.2 },
  },
  sunset: {
    bg: '#1c0e1b', tile: '#31182b', tileBorder: 'rgba(244,114,182,0.16)',
    accent: '#f9a8d4', border: 'rgba(244,114,182,0.3)',
    glowA: { rgb: '244,114,182', alpha: 0.28 }, glowB: { rgb: '249,115,22', alpha: 0.22 },
  },
  amber: {
    bg: '#19120a', tile: '#2e2417', tileBorder: 'rgba(251,191,36,0.16)',
    accent: '#fcd34d', border: 'rgba(251,191,36,0.3)',
    glowA: { rgb: '251,191,36', alpha: 0.24 }, glowB: { rgb: '239,68,68', alpha: 0.18 },
  },
  graphite: {
    bg: '#101116', tile: '#20222c', tileBorder: 'rgba(255,255,255,0.1)',
    accent: '#e6e9f2', border: 'rgba(255,255,255,0.16)',
    glowA: { rgb: '255,255,255', alpha: 0.12 }, glowB: { rgb: '148,163,184', alpha: 0.12 },
  },
};

export function resolveWrappedTheme(theme: string | undefined | null): WrappedTheme {
  return (WRAPPED_THEMES as readonly string[]).includes(theme ?? '') ? (theme as WrappedTheme) : DEFAULT_WRAPPED_THEME;
}

// ─── Canvas rendering ─────────────────────────────────────────────────────────

const W = 800;
const H = 1200;

const WHITE = '#ffffff';
const MUTED = '#98a2b8';

/** Kolory rang #1/#2/#3 w wierszach top-3 (1:1 z prototypem). */
const RANK_FG = ['#fcd34d', '#cbd5e1', '#e79c2a'];

/** Gradienty awatara zastępczego, gdy nie da się pobrać prawdziwego avatara. */
const AVATAR_FALLBACK_GRADIENTS: [string, string][] = [
  ['#6366f1', '#a855f7'],
  ['#0ea5e9', '#22c55e'],
  ['#f59e0b', '#ef4444'],
  ['#ec4899', '#a855f7'],
];

/** Rysuje wielką, miękką plamę światła (odpowiednik CSS radial-gradient(...,68%)). */
function drawGlow(ctx: any, cx: number, cy: number, radius: number, rgb: string, alpha: number): void {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(0.68, `rgba(${rgb},${alpha})`);
  gradient.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function fillAvatarFallback(ctx: any, cx: number, cy: number, size: number, index: number): void {
  const [c1, c2] = AVATAR_FALLBACK_GRADIENTS[index % AVATAR_FALLBACK_GRADIENTS.length];
  const r = size / 2;
  const gradient = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  gradient.addColorStop(0, c1);
  gradient.addColorStop(1, c2);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.restore();
}

export async function renderWrappedCanvas(data: WrappedData, theme: WrappedTheme = DEFAULT_WRAPPED_THEME): Promise<Buffer> {
  registerProjectFonts();

  const { bg, tile: STAT_BG, tileBorder: TILE_BORDER, accent: ACCENT, border: CARD_BORDER, glowA, glowB } = THEME_PALETTES[theme];

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  // ── Background + dekoracyjne "glow" plamy (1:1 z prototypem: dwie duże,
  // miękkie plamy w rogach karty, zamiast dawnych trzech płaskich kółek) ──
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  drawGlow(ctx, 710, 90, 320, glowA.rgb, glowA.alpha);
  drawGlow(ctx, 110, 1110, 360, glowB.rgb, glowB.alpha);

  const PAD_SIDES = 40;
  const CONTENT_W = W - PAD_SIDES * 2;

  let y = 38;

  // ── Header: ikona serwera + nazwa ──
  const AVATAR_D = 80;
  if (data.serverIconUrl) {
    try {
      const icon = await loadImage(data.serverIconUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, y + AVATAR_D / 2, AVATAR_D / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(icon, W / 2 - AVATAR_D / 2, y, AVATAR_D, AVATAR_D);
      ctx.restore();
    } catch {
      // skip icon
    }
  }
  ctx.save();
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(W / 2, y + AVATAR_D / 2, AVATAR_D / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  y += AVATAR_D;

  y += 10;
  ctx.fillStyle = WHITE;
  ctx.font = '800 24px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(data.serverName, W / 2, y + 20);
  y += 28;

  y += 20;
  ctx.fillStyle = ACCENT;
  ctx.font = '900 40px Inter';
  ctx.fillText('SERVER WRAPPED', W / 2, y + 34);
  y += 44;

  y += 8;
  ctx.fillStyle = MUTED;
  ctx.font = '500 16px Inter';
  ctx.fillText(
    `${data.ageYears} ${data.ageYears === 1 ? 'rok' : data.ageYears < 5 ? 'lata' : 'lat'} razem!`,
    W / 2,
    y + 14,
  );
  y += 20;

  // ── Stats grid (3×2) ──
  const stats = [
    { label: 'Członków', value: formatNumberDotSep(data.memberCount), icon: '👥' },
    { label: 'Wiadomości', value: formatNumberCompact(data.totalMessages), icon: '✉️' },
    { label: 'Godzin VC', value: formatNumberCompact(data.totalVoiceHours), icon: '🎙️' },
    { label: 'Giveawayów', value: formatNumberDotSep(data.totalGiveaways), icon: '🎉' },
    { label: 'Gier Wordle', value: formatNumberDotSep(data.totalWordleGames), icon: '🔤' },
    { label: 'Dołączeń', value: formatNumberDotSep(data.totalInvites), icon: '📨' },
  ];

  const gridCols = 3;
  const gridGap = 12;
  const cellW = (CONTENT_W - (gridCols - 1) * gridGap) / gridCols;
  const cellH = 82;
  const gridStartX = PAD_SIDES;

  y += 24;
  const gridY = y;

  for (let i = 0; i < stats.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const cx = gridStartX + col * (cellW + gridGap);
    const cy = gridY + row * (cellH + gridGap);

    ctx.fillStyle = STAT_BG;
    roundRect(ctx, cx, cy, cellW, cellH, 12);
    ctx.fill();
    ctx.strokeStyle = TILE_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = WHITE;
    ctx.font = '800 24px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`${stats[i].icon} ${stats[i].value}`, cx + cellW / 2, cy + 37);

    ctx.fillStyle = MUTED;
    ctx.font = '500 13px Inter';
    ctx.fillText(stats[i].label, cx + cellW / 2, cy + 61);
  }

  const gridRows = Math.ceil(stats.length / gridCols);
  y = gridY + gridRows * cellH + (gridRows - 1) * gridGap;

  // ── Sekcje top-3 (wiadomości / głos / poziom) ──
  const sections = [
    { title: '💬 Top wiadomości', users: data.topMessages, suffix: 'wiad.' },
    { title: '🎙️ Top głosowe', users: data.topVoice, suffix: 'min' },
    { title: '⭐ Top poziom', users: data.topLevel, suffix: 'lvl' },
  ];

  const sectionX = PAD_SIDES;
  const sectionW = CONTENT_W;
  const ROW_H = 50;
  const ROW_GAP = 7;
  const TITLE_BLOCK_H = 28; // 20 (tytuł) + 8 (margines do wierszy)
  const BASE_SECTION_GAP = 16;
  const FOOTER_RESERVE = 26;

  const sectionContentH = TITLE_BLOCK_H + 3 * ROW_H + 2 * ROW_GAP;
  const naturalSectionsH = sections.length * sectionContentH + (sections.length - 1) * BASE_SECTION_GAP;
  const availableH = H - 30 - FOOTER_RESERVE - (y + 22);
  const extraGap = Math.max(0, (availableH - naturalSectionsH) / Math.max(1, sections.length - 1));
  const sectionGap = BASE_SECTION_GAP + extraGap;

  y += 22;

  for (const section of sections) {
    ctx.fillStyle = ACCENT;
    ctx.font = '700 17px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(section.title, sectionX, y + 13);
    y += TITLE_BLOCK_H;

    for (let i = 0; i < section.users.length; i++) {
      const user = section.users[i];
      const rowY = y + i * (ROW_H + ROW_GAP);

      ctx.fillStyle = STAT_BG;
      roundRect(ctx, sectionX, rowY, sectionW, ROW_H, 10);
      ctx.fill();
      ctx.strokeStyle = TILE_BORDER;
      ctx.lineWidth = 1;
      ctx.stroke();

      const textBaselineY = rowY + ROW_H / 2 + 5;

      // Ranga
      ctx.fillStyle = RANK_FG[i] ?? WHITE;
      ctx.font = '800 15px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(`#${i + 1}`, sectionX + 16, textBaselineY);

      // Awatar
      const avSize = 32;
      const avCx = sectionX + 16 + 26 + 12 + avSize / 2;
      const avCy = rowY + ROW_H / 2;
      if (user.avatarUrl) {
        try {
          const av = await loadImage(user.avatarUrl);
          ctx.save();
          ctx.beginPath();
          ctx.arc(avCx, avCy, avSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(av, avCx - avSize / 2, avCy - avSize / 2, avSize, avSize);
          ctx.restore();
        } catch {
          fillAvatarFallback(ctx, avCx, avCy, avSize, i);
        }
      } else {
        fillAvatarFallback(ctx, avCx, avCy, avSize, i);
      }

      // Nick
      ctx.fillStyle = WHITE;
      ctx.font = '600 16px Inter';
      ctx.textAlign = 'left';
      const maxNameW = 340;
      let name = user.displayName;
      while (ctx.measureText(name).width > maxNameW && name.length > 3) {
        name = name.slice(0, -1);
      }
      if (name !== user.displayName) name += '…';
      ctx.fillText(name, avCx + avSize / 2 + 12, textBaselineY);

      // Wartość
      ctx.fillStyle = ACCENT;
      ctx.font = '700 15px Inter';
      ctx.textAlign = 'right';
      const valStr =
        section.suffix === 'min'
          ? `${Math.floor(user.value / 60)}h ${Math.round(user.value % 60)}m`
          : `${formatNumberDotSep(user.value)} ${section.suffix}`;
      ctx.fillText(valStr, sectionX + sectionW - 16, textBaselineY);
    }

    y += 3 * ROW_H + 2 * ROW_GAP + sectionGap;
  }

  // ── Ramka karty ──
  ctx.strokeStyle = CARD_BORDER;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);

  // ── Stopka ──
  ctx.fillStyle = MUTED;
  ctx.font = '300 13px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`Wygenerowano ${new Date().toLocaleDateString('pl-PL')}`, W / 2, H - 16);

  return canvas.toBuffer('image/png');
}

// ─── Personal Wrapped ─────────────────────────────────────────────────────────

export interface PersonalWrappedData {
  displayName: string;
  avatarUrl: string;
  serverName: string;
  serverIconUrl: string | null;
  joinedAt: Date;
  totalMessages: number;
  totalVoiceMinutes: number;
  level: number;
  xp: number;
  levelsGained: number;
  wordleWins: number;
  wordleLosses: number;
  wordleBestStreak: number;
  giveawaysEntered: number;
  giveawaysWon: number;
  invites: number;
  messageRank: number;
  voiceRank: number;
  levelRank: number;
  topMonth: { month: string; messages: number } | null;
}

export async function collectPersonalWrappedData(
  member: GuildMember,
): Promise<PersonalWrappedData> {
  const guildId = member.guild.id;
  const userId = member.id;

  // ── Yearly boundary: last 12 months ──
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  // Month string boundary for MonthlyStats (format "YYYY-MM")
  const yearAgoMonth = `${oneYearAgo.getFullYear()}-${String(oneYearAgo.getMonth() + 1).padStart(2, '0')}`;

  // Messages & voice (last 12 months)
  const userAgg = await MonthlyStatsModel.aggregate([
    { $match: { guildId, userId, month: { $gte: yearAgoMonth } } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: '$messageCount' },
        totalVoiceMinutes: { $sum: '$voiceMinutes' },
      },
    },
  ]);
  const totalMessages = userAgg[0]?.totalMessages ?? 0;
  const totalVoiceMinutes = userAgg[0]?.totalVoiceMinutes ?? 0;

  // Best month (last 12 months)
  // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje ręcznie pisane
  // operatory w .find()/.countDocuments() (nie dotyczy .aggregate() poniżej).
  const topMonthAgg = await MonthlyStatsModel.find({ guildId, userId, month: mongoose.trusted({ $gte: yearAgoMonth }) })
    .sort({ messageCount: -1 })
    .limit(1)
    .lean();
  const topMonth =
    topMonthAgg.length > 0
      ? { month: topMonthAgg[0].month, messages: topMonthAgg[0].messageCount }
      : null;

  // Level (current) + yearly growth from snapshot
  const levelDoc = await LevelModel.findOne({ guildId, userId }).lean();
  const level = levelDoc?.level ?? 1;
  const xp = levelDoc?.xp ?? 0;

  const lastYearSnapshot = await LevelSnapshotModel.findOne({
    guildId,
    userId,
    year: oneYearAgo.getFullYear(),
  }).lean();
  const levelsGained = lastYearSnapshot ? level - lastYearSnapshot.level : level - 1;

  // Wordle (last 12 months from games array, fallback to all-time aggregated fields)
  const wordleDoc = await WordleStatModel.findOne({ guildId, userId }).lean();
  let wordleWins = 0;
  let wordleLosses = 0;
  let wordleBestStreak = 0;

  if (wordleDoc) {
    const yearlyGames = (wordleDoc.games ?? []).filter(
      (g: any) => new Date(g.date) >= oneYearAgo,
    );

    if (yearlyGames.length > 0) {
      wordleWins = yearlyGames.filter((g: any) => g.won).length;
      wordleLosses = yearlyGames.filter((g: any) => !g.won).length;

      // Compute best streak from yearly games (chronological)
      let streak = 0;
      for (const g of yearlyGames.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
        if (g.won) {
          streak++;
          if (streak > wordleBestStreak) wordleBestStreak = streak;
        } else {
          streak = 0;
        }
      }
    } else {
      // No games array data yet — fall back to all-time aggregated
      wordleWins = wordleDoc.wins ?? 0;
      wordleLosses = wordleDoc.losses ?? 0;
      wordleBestStreak = wordleDoc.bestStreak ?? 0;
    }
  }

  // Giveaways (last 12 months — entered & won)
  const giveawaysEntered = await GiveawayModel.countDocuments({
    guildId,
    participants: userId,
    createdAt: mongoose.trusted({ $gte: oneYearAgo }),
  });
  const giveawaysWon = await GiveawayModel.countDocuments({
    guildId,
    winners: userId,
    createdAt: mongoose.trusted({ $gte: oneYearAgo }),
  });

  // Invites — total people invited (last 12 months, not only active)
  const invites = await InviteEntryModel.countDocuments({
    guildId,
    inviterId: userId,
    joinedAt: mongoose.trusted({ $gte: oneYearAgo }),
  });

  // Ranks (last 12 months based on MonthlyStats)
  const msgRanks = await MonthlyStatsModel.aggregate([
    { $match: { guildId, month: { $gte: yearAgoMonth } } },
    { $group: { _id: '$userId', total: { $sum: '$messageCount' } } },
    { $sort: { total: -1 } },
  ]);
  const messageRank = msgRanks.findIndex((r) => r._id === userId) + 1 || msgRanks.length + 1;

  const vcRanks = await MonthlyStatsModel.aggregate([
    { $match: { guildId, month: { $gte: yearAgoMonth } } },
    { $group: { _id: '$userId', total: { $sum: '$voiceMinutes' } } },
    { $sort: { total: -1 } },
  ]);
  const voiceRank = vcRanks.findIndex((r) => r._id === userId) + 1 || vcRanks.length + 1;

  const lvlRanks = await LevelModel.find({ guildId }).sort({ level: -1, xp: -1 }).lean();
  const levelRank = lvlRanks.findIndex((r) => r.userId === userId) + 1 || lvlRanks.length + 1;

  return {
    displayName: member.displayName,
    avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
    serverName: member.guild.name,
    serverIconUrl: member.guild.iconURL({ extension: 'png', size: 128 }),
    joinedAt: member.joinedAt ?? new Date(),
    totalMessages,
    totalVoiceMinutes,
    level,
    xp,
    levelsGained,
    wordleWins,
    wordleLosses,
    wordleBestStreak,
    giveawaysEntered,
    giveawaysWon,
    invites,
    messageRank,
    voiceRank,
    levelRank,
    topMonth,
  };
}

// ─── Personal canvas ──────────────────────────────────────────────────────────

const PW = 800;

export async function renderPersonalWrappedCanvas(
  data: PersonalWrappedData,
  theme: WrappedTheme = DEFAULT_WRAPPED_THEME,
): Promise<Buffer> {
  registerProjectFonts();

  const { bg, tile: STAT_BG, accent: ACCENT } = THEME_PALETTES[theme];

  // Calculate dynamic height
  const hasTopMonth = !!(data.topMonth && data.topMonth.messages > 0);
  const pCellH = 100;
  const pGridGap = 16;
  // header(35+130+28+48+35) + grid(2*(100+16)+20) + topMonth?(90) + footer(50)
  const PH = 35 + 130 + 28 + 48 + 35 + 2 * (pCellH + pGridGap) + 20 + (hasTopMonth ? 90 : 0) + 50;

  const canvas = createCanvas(PW, PH);
  const ctx = canvas.getContext('2d') as any;

  // Background
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, PW, PH);

  // Decorative circles
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.arc(680, 80, 180, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(80, PH - 150, 200, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  let y = 35;

  // ── Avatar ──
  try {
    const av = await loadImage(data.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(PW / 2, y + 60, 55, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(av, PW / 2 - 55, y + 5, 110, 110);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = ACCENT;
    ctx.shadowBlur = 20;
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(PW / 2, y + 60, 57, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } catch { /* skip */ }
  y += 130;

  // Display name
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 28px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(data.displayName, PW / 2, y);
  y += 28;

  // "TWÓJ WRAPPED"
  ctx.fillStyle = ACCENT;
  ctx.font = 'bold 36px Inter';
  ctx.fillText('TWÓJ WRAPPED', PW / 2, y + 32);
  y += 48;

  // Server + join date
  const daysSince = Math.floor((Date.now() - data.joinedAt.getTime()) / 86_400_000);
  ctx.fillStyle = MUTED;
  ctx.font = '500 15px Inter';
  ctx.fillText(
    `${data.serverName} · na serwerze od ${daysSince} dni`,
    PW / 2,
    y + 8,
  );
  y += 35;

  // ── Stats grid (3×2) ──
  const voiceH = Math.floor(data.totalVoiceMinutes / 60);
  const voiceM = Math.round(data.totalVoiceMinutes % 60);
  const levelSub = data.levelsGained > 0
    ? `+${data.levelsGained} w tym roku · ${formatNumberDotSep(data.xp)} XP`
    : `#${data.levelRank} · ${formatNumberDotSep(data.xp)} XP`;
  const stats = [
    { label: 'Wiadomości', value: formatNumberCompact(data.totalMessages), sub: `#${data.messageRank} na serwerze` },
    { label: 'Czas głosowy', value: `${voiceH}h ${voiceM}m`, sub: `#${data.voiceRank} na serwerze` },
    { label: 'Poziom', value: `${data.level}`, sub: levelSub },
    { label: 'Wordle', value: `${data.wordleWins}W / ${data.wordleLosses}L`, sub: `Najlepszy streak: ${data.wordleBestStreak}` },
    { label: 'Udział w giveawayach', value: `${data.giveawaysEntered}`, sub: `Wygrane: ${data.giveawaysWon}` },
    { label: 'Zaproszeni użytkownicy', value: `${data.invites}`, sub: 'w tym roku' },
  ];

  const gridCols = 3;
  const cellW = 230;
  const cellH = 100;
  const gridGap = 16;
  const gridX = (PW - (gridCols * cellW + (gridCols - 1) * gridGap)) / 2;

  for (let i = 0; i < stats.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const cx = gridX + col * (cellW + gridGap);
    const cy = y + row * (cellH + gridGap);

    ctx.fillStyle = STAT_BG;
    roundRect(ctx, cx, cy, cellW, cellH, 12);
    ctx.fill();

    // Value
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 22px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(stats[i].value, cx + cellW / 2, cy + 36);

    // Label
    ctx.fillStyle = ACCENT;
    ctx.font = '600 13px Inter';
    ctx.fillText(stats[i].label, cx + cellW / 2, cy + 56);

    // Sub
    ctx.fillStyle = MUTED;
    ctx.font = '500 11px Inter';
    ctx.fillText(stats[i].sub, cx + cellW / 2, cy + 78);
  }

  y += 2 * (cellH + gridGap) + 20;

  // ── Best month section ──
  if (data.topMonth && data.topMonth.messages > 0) {
    const sectionW = 720;
    const sectionX = (PW - sectionW) / 2;

    ctx.fillStyle = STAT_BG;
    roundRect(ctx, sectionX, y, sectionW, 70, 12);
    ctx.fill();

    ctx.fillStyle = ACCENT;
    ctx.font = 'bold 16px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('🔥 Najaktywniejszy miesiąc', sectionX + 20, y + 28);

    const [yr, mo] = data.topMonth.month.split('-');
    const months = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                    'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
    const monthName = `${months[parseInt(mo) - 1]} ${yr}`;

    ctx.fillStyle = WHITE;
    ctx.font = '500 15px Inter';
    ctx.fillText(
      `${monthName} — ${formatNumberDotSep(data.topMonth.messages)} wiadomości`,
      sectionX + 20,
      y + 52,
    );

    y += 90;
  }

  // ── Footer ──
  ctx.fillStyle = MUTED;
  ctx.font = '300 13px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`Wygenerowano ${new Date().toLocaleDateString('pl-PL')}`, PW / 2, y + 20);

  return canvas.toBuffer('image/png');
}
