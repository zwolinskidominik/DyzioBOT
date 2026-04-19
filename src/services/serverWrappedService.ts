import { Client, Guild, GuildMember } from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import { registerProjectFonts, roundRect, formatNumberDotSep, formatNumberCompact } from '../utils/canvasHelpers';
import { MonthlyStatsModel } from '../models/MonthlyStats';
import { LevelModel } from '../models/Level';
import { LevelSnapshotModel } from '../models/LevelSnapshot';
import { GiveawayModel } from '../models/Giveaway';
import { WordleStatModel } from '../models/WordleStat';
import { InviteEntryModel } from '../models/InviteEntry';
import logger from '../utils/logger';

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

// ─── Canvas rendering ─────────────────────────────────────────────────────────

const W = 800;
const H = 1200;

const BG_DARK  = '#0d0d0d';
const BG_CARD  = '#1a1a2e';
const ACCENT   = '#6c5ce7';
const ACCENT_2 = '#a29bfe';
const GOLD     = '#ffd700';
const SILVER   = '#c0c0c0';
const BRONZE   = '#cd7f32';
const WHITE    = '#ffffff';
const MUTED    = '#8e8e93';
const STAT_BG  = '#16213e';

const MEDAL_COLORS = [GOLD, SILVER, BRONZE];

export async function renderWrappedCanvas(data: WrappedData): Promise<Buffer> {
  registerProjectFonts();

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;

  // ── Background gradient ──
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0f0c29');
  bgGrad.addColorStop(0.5, '#302b63');
  bgGrad.addColorStop(1, '#24243e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Decorative circles
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(650, 100, 200, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(100, 900, 250, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(700, 1100, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  let y = 40;

  // ── Header: Server icon + name ──
  if (data.serverIconUrl) {
    try {
      const icon = await loadImage(data.serverIconUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(W / 2, y + 50, 45, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(icon, W / 2 - 45, y + 5, 90, 90);
      ctx.restore();

      // Glow
      ctx.save();
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(W / 2, y + 50, 47, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } catch {
      // skip icon
    }
  }
  y += 110;

  // Server name
  ctx.fillStyle = WHITE;
  ctx.font = 'bold 28px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(data.serverName, W / 2, y);
  y += 30;

  // "SERVER WRAPPED"
  const wrappedGrad = ctx.createLinearGradient(200, y, 600, y + 40);
  wrappedGrad.addColorStop(0, ACCENT);
  wrappedGrad.addColorStop(1, ACCENT_2);
  ctx.fillStyle = wrappedGrad;
  ctx.font = 'bold 42px Inter';
  ctx.fillText('SERVER WRAPPED', W / 2, y + 35);
  y += 50;

  // Age subtitle
  ctx.fillStyle = MUTED;
  ctx.font = '500 18px Inter';
  ctx.fillText(
    `${data.ageYears} ${data.ageYears === 1 ? 'rok' : data.ageYears < 5 ? 'lata' : 'lat'} razem!`,
    W / 2,
    y + 10,
  );
  y += 40;

  // ── Stats grid (2×3) ──
  const stats = [
    { label: 'Członków', value: formatNumberDotSep(data.memberCount), icon: '👥' },
    { label: 'Wiadomości', value: formatNumberCompact(data.totalMessages), icon: '✉️' },
    { label: 'Godzin VC', value: formatNumberCompact(data.totalVoiceHours), icon: '🎙️' },
    { label: 'Giveawayów', value: formatNumberDotSep(data.totalGiveaways), icon: '🎉' },
    { label: 'Gier Wordle', value: formatNumberDotSep(data.totalWordleGames), icon: '🟩' },
    { label: 'Dołączeń', value: formatNumberDotSep(data.totalInvites), icon: '📨' },
  ];

  const gridCols = 3;
  const cellW = 230;
  const cellH = 90;
  const gridGap = 16;
  const gridStartX = (W - (gridCols * cellW + (gridCols - 1) * gridGap)) / 2;

  for (let i = 0; i < stats.length; i++) {
    const col = i % gridCols;
    const row = Math.floor(i / gridCols);
    const cx = gridStartX + col * (cellW + gridGap);
    const cy = y + row * (cellH + gridGap);

    // Card bg
    ctx.fillStyle = STAT_BG;
    ctx.globalAlpha = 0.6;
    roundRect(ctx, cx, cy, cellW, cellH, 12);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Icon + value
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 26px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(`${stats[i].icon} ${stats[i].value}`, cx + cellW / 2, cy + 38);

    // Label
    ctx.fillStyle = MUTED;
    ctx.font = '500 14px Inter';
    ctx.fillText(stats[i].label, cx + cellW / 2, cy + 62);
  }

  y += 2 * (cellH + gridGap) + 20;

  // ── Top sections ──
  const sections = [
    { title: '💬 Top wiadomości', users: data.topMessages, suffix: 'wiad.' },
    { title: '🎤 Top głosowe', users: data.topVoice, suffix: 'min' },
    { title: '⭐ Top poziom', users: data.topLevel, suffix: 'lvl' },
  ];

  const sectionW = 720;
  const sectionX = (W - sectionW) / 2;

  for (const section of sections) {
    // Section title
    ctx.fillStyle = ACCENT_2;
    ctx.font = 'bold 20px Inter';
    ctx.textAlign = 'left';
    ctx.fillText(section.title, sectionX, y + 5);
    y += 20;

    // Users
    for (let i = 0; i < section.users.length; i++) {
      const user = section.users[i];
      const rowY = y + i * 55;

      // Row bg
      ctx.fillStyle = STAT_BG;
      ctx.globalAlpha = 0.4;
      roundRect(ctx, sectionX, rowY, sectionW, 48, 10);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Medal/rank
      ctx.fillStyle = MEDAL_COLORS[i] ?? WHITE;
      ctx.font = 'bold 18px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(`#${i + 1}`, sectionX + 14, rowY + 30);

      // Avatar
      const avX = sectionX + 55;
      const avY = rowY + 4;
      const avSize = 40;
      if (user.avatarUrl) {
        try {
          const av = await loadImage(user.avatarUrl);
          ctx.save();
          ctx.beginPath();
          ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(av, avX, avY, avSize, avSize);
          ctx.restore();
        } catch {
          // skip avatar
        }
      }

      // Name
      ctx.fillStyle = WHITE;
      ctx.font = '600 16px Inter';
      ctx.textAlign = 'left';
      const maxNameW = 380;
      let name = user.displayName;
      while (ctx.measureText(name).width > maxNameW && name.length > 3) {
        name = name.slice(0, -1);
      }
      if (name !== user.displayName) name += '…';
      ctx.fillText(name, avX + avSize + 14, rowY + 30);

      // Value
      ctx.fillStyle = ACCENT_2;
      ctx.font = 'bold 16px Inter';
      ctx.textAlign = 'right';
      const valStr =
        section.suffix === 'min'
          ? `${Math.floor(user.value / 60)}h ${Math.round(user.value % 60)}m`
          : `${formatNumberDotSep(user.value)} ${section.suffix}`;
      ctx.fillText(valStr, sectionX + sectionW - 14, rowY + 30);
    }

    y += section.users.length * 55 + 20;
  }

  // ── Footer ──
  ctx.fillStyle = MUTED;
  ctx.font = '300 13px Inter';
  ctx.textAlign = 'center';
  ctx.fillText(`Wygenerowano ${new Date().toLocaleDateString('pl-PL')}`, W / 2, H - 20);

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
  const topMonthAgg = await MonthlyStatsModel.find({ guildId, userId, month: { $gte: yearAgoMonth } })
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
    createdAt: { $gte: oneYearAgo },
  });
  const giveawaysWon = await GiveawayModel.countDocuments({
    guildId,
    winners: userId,
    createdAt: { $gte: oneYearAgo },
  });

  // Invites — total people invited (last 12 months, not only active)
  const invites = await InviteEntryModel.countDocuments({
    guildId,
    inviterId: userId,
    joinedAt: { $gte: oneYearAgo },
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

export async function renderPersonalWrappedCanvas(data: PersonalWrappedData): Promise<Buffer> {
  registerProjectFonts();

  // Calculate dynamic height
  const hasTopMonth = !!(data.topMonth && data.topMonth.messages > 0);
  const pCellH = 100;
  const pGridGap = 16;
  // header(35+130+28+48+35) + grid(2*(100+16)+20) + topMonth?(90) + footer(50)
  const PH = 35 + 130 + 28 + 48 + 35 + 2 * (pCellH + pGridGap) + 20 + (hasTopMonth ? 90 : 0) + 50;

  const canvas = createCanvas(PW, PH);
  const ctx = canvas.getContext('2d') as any;

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 0, PH);
  bgGrad.addColorStop(0, '#0f0c29');
  bgGrad.addColorStop(0.5, '#302b63');
  bgGrad.addColorStop(1, '#24243e');
  ctx.fillStyle = bgGrad;
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
  const titleGrad = ctx.createLinearGradient(200, y, 600, y + 36);
  titleGrad.addColorStop(0, ACCENT);
  titleGrad.addColorStop(1, ACCENT_2);
  ctx.fillStyle = titleGrad;
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
    ctx.globalAlpha = 0.6;
    roundRect(ctx, cx, cy, cellW, cellH, 12);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Value
    ctx.fillStyle = WHITE;
    ctx.font = 'bold 22px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(stats[i].value, cx + cellW / 2, cy + 36);

    // Label
    ctx.fillStyle = ACCENT_2;
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
    ctx.globalAlpha = 0.5;
    roundRect(ctx, sectionX, y, sectionW, 70, 12);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = ACCENT_2;
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
