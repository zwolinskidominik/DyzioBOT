import {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
} from 'discord.js';
import { createCanvas, loadImage } from 'canvas';
import type { ICommandOptions } from '../../interfaces/Command';
import { WordleStatModel } from '../../models/WordleStat';
import logger from '../../utils/logger';

// ─── Canvas layout ────────────────────────────────────────────────────────────
type Ctx2D = any;

const IMG_W    = 820;
const PAD      = 32;
const HDR_H    = 86;
const ROW_H    = 104;
const AV_SIZE  = 64;
const MAX_ROWS = 10;

const C_BG     = '#121213';
const C_LINE   = '#2A2A2C';
const C_WHITE  = '#FFFFFF';
const C_MUTED  = '#818384';
const C_GREEN  = '#538D4E';

// Horizontal column anchors
const RANK_CX  = PAD + 28;          // centre of rank number
const AV_LEFT  = PAD + 72;          // avatar left edge
const AV_CX    = AV_LEFT + AV_SIZE / 2;
const TEXT_X   = AV_LEFT + AV_SIZE + 18;
const RIGHT_X  = IMG_W - PAD;

const RANK_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

function clipCircle(ctx: Ctx2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

// ─── Command definition ────────────────────────────────────────────────────────
export const data = new SlashCommandBuilder()
  .setName('wordle-top')
  .setDescription('Ranking graczy Wordle na tym serwerze.');

export const options = { cooldown: 5 };

export async function run({ interaction }: ICommandOptions): Promise<void> {
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: '❌ Komenda dostępna tylko na serwerze.', flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.deferReply();

  // ── Fetch top 10 by wins ──────────────────────────────────────────────────
  const stats = await WordleStatModel
    .find({ guildId, wins: { $gt: 0 } })
    .sort({ wins: -1 })
    .limit(MAX_ROWS)
    .lean();

  if (!stats.length) {
    await interaction.editReply({ content: '📊 Nikt jeszcze nie wygrał gry Wordle na tym serwerze!' });
    return;
  }

  // ── Resolve Discord members ───────────────────────────────────────────────
  const members = await Promise.all(
    stats.map(async (s) => {
      try {
        const m = await interaction.guild!.members.fetch(s.userId);
        return {
          name:      m.displayName.length > 22 ? m.displayName.slice(0, 20) + '…' : m.displayName,
          avatarUrl: m.displayAvatarURL({ extension: 'png', size: 128 }),
        };
      } catch {
        return { name: `(${s.userId.slice(0, 8)}…)`, avatarUrl: null };
      }
    }),
  );

  // ── Build canvas ──────────────────────────────────────────────────────────
  const IMG_H = HDR_H + stats.length * ROW_H + PAD / 2;
  const canvas = createCanvas(IMG_W, IMG_H);
  const ctx    = canvas.getContext('2d') as Ctx2D;

  // Background
  ctx.fillStyle = C_BG;
  ctx.fillRect(0, 0, IMG_W, IMG_H);

  // Header
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = C_GREEN;
  ctx.font         = 'bold 32px sans-serif';
  ctx.fillText('Wordle — Ranking', IMG_W / 2, HDR_H / 2);

  // Header underline
  ctx.strokeStyle = C_LINE;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, HDR_H);
  ctx.lineTo(IMG_W - PAD, HDR_H);
  ctx.stroke();

  // ── Rows ──────────────────────────────────────────────────────────────────
  for (let i = 0; i < stats.length; i++) {
    const s       = stats[i];
    const u       = members[i];
    const rowY    = HDR_H + i * ROW_H;
    const midY    = rowY + ROW_H / 2;
    const rankCol = RANK_COLORS[i] ?? C_MUTED;

    // Alternating row tint
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(0, rowY, IMG_W, ROW_H);
    }

    // ── Rank number ──────────────────────────────────────────────────────────
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = rankCol;
    ctx.font         = 'bold 26px sans-serif';
    ctx.fillText(`${i + 1}`, RANK_CX, midY);

    // ── Avatar ───────────────────────────────────────────────────────────────
    const avCY = midY;
    const avR  = AV_SIZE / 2;

    ctx.save();
    clipCircle(ctx, AV_CX, avCY, avR);
    ctx.clip();

    if (u.avatarUrl) {
      try {
        const img = await loadImage(u.avatarUrl);
        ctx.drawImage(img, AV_LEFT, avCY - avR, AV_SIZE, AV_SIZE);
      } catch (err) {
        logger.warn(`wordle-top: failed to load avatar for ${s.userId}: ${err}`);
        ctx.fillStyle = C_LINE;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = C_LINE;
      ctx.fill();
    }
    ctx.restore();

    // Avatar border ring
    ctx.strokeStyle = rankCol;
    ctx.lineWidth   = 3;
    clipCircle(ctx, AV_CX, avCY, avR + 1);
    ctx.stroke();

    // ── Name + wins row ───────────────────────────────────────────────────────
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = C_WHITE;
    ctx.font      = 'bold 24px sans-serif';
    ctx.fillText(u.name, TEXT_X, midY - 14);

    const winRate = s.wins + s.losses > 0
      ? Math.round((s.wins / (s.wins + s.losses)) * 100)
      : 0;
    ctx.fillStyle = C_MUTED;
    ctx.font      = '17px sans-serif';
    ctx.fillText(`${s.wins} wyg. · ${winRate}% winrate`, TEXT_X, midY + 14);

    // ── Avg guesses (right-aligned) ───────────────────────────────────────────
    const avg = s.wins > 0 ? (s.totalGuesses / s.wins).toFixed(2) : '—';

    ctx.textAlign = 'right';
    ctx.fillStyle = C_GREEN;
    ctx.font      = 'bold 30px sans-serif';
    ctx.fillText(avg, RIGHT_X, midY - 10);

    ctx.fillStyle = C_MUTED;
    ctx.font      = '14px sans-serif';
    ctx.fillText('śr. prób', RIGHT_X, midY + 16);

    // Row separator
    if (i < stats.length - 1) {
      ctx.strokeStyle = C_LINE;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, rowY + ROW_H);
      ctx.lineTo(IMG_W - PAD, rowY + ROW_H);
      ctx.stroke();
    }
  }

  // ── Send image ────────────────────────────────────────────────────────────
  const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'wordle-top.png' });
  await interaction.editReply({ files: [attachment] });
}
