import { createCanvas, loadImage, Canvas, Image } from 'canvas';
import { getBotConfig } from '../config/bot';
import { Ctx2D, registerProjectFonts, roundRect, formatNumberDotSep } from './canvasHelpers';
import logger from './logger';

/**
 * Osobny, samodzielny generator grafiki dla miesięcznej "Topki" (wiadomości + głos).
 * Celowo NIE dotyka istniejącego `canvasLeaderboardCard.ts` (TOPKA LEVELI, /toplvl)
 * ani `monthlyStats.ts` (dotychczasowa wersja tekstowa) — to eksperymentalny wariant
 * do testów, żeby nic z obecnego działania nie ryzykować.
 */

export interface TopkaCardEntry {
  userId: string;
  username: string;
  avatarURL: string;
  value: number;
  rank: number;
  prevRank: number;
  prevValue: number;
  isNew: boolean;
}

export interface MonthlyTopkaCardOptions {
  monthName: string;
  year: string;
  totalMessages: number;
  messagesEntries: TopkaCardEntry[];
  voiceEntries: TopkaCardEntry[];
  botId: string;
}

/** Czytelny format czasu głosowego: "162h 11m" zamiast mylącego "162:11h". */
export function formatVoiceTimeReadable(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours > 0) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  return `${mins}m`;
}

interface ColumnStyle {
  accent: string;
  entryBg: string;
  entryBgTop: string;
  formatValue: (v: number) => string;
}

export class MonthlyTopkaCard {
  private canvas: Canvas;
  private ctx: Ctx2D;
  private readonly width = 1100;
  private readonly height: number;
  private readonly colors = {
    background: '#0a1628',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    messages: '#5b8def',
    messagesEntryBg: 'rgba(91, 141, 239, 0.12)',
    messagesEntryBgTop: 'rgba(91, 141, 239, 0.22)',
    voice: '#a78bfa',
    voiceEntryBg: 'rgba(167, 139, 250, 0.12)',
    voiceEntryBgTop: 'rgba(167, 139, 250, 0.22)',
    up: '#4ade80',
    down: '#f87171',
    neutral: '#6b7280',
    newBadge: '#2dd4bf',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
    mvpBg: 'rgba(255, 215, 0, 0.10)',
    mvpBorder: 'rgba(255, 215, 0, 0.4)',
  };

  private options: MonthlyTopkaCardOptions;
  private readonly margin = 40;
  private readonly columnGap = 24;
  private readonly columnWidth: number;
  private readonly headerHeight = 150;
  private readonly mvpHeight: number;
  private readonly sectionTitleHeight = 40;
  private readonly entryHeight = 62;
  private readonly entrySpacing = 6;
  private readonly bottomPadding = 30;
  private readonly sectionGap = 18;

  constructor(options: MonthlyTopkaCardOptions) {
    this.options = options;
    registerProjectFonts();

    this.columnWidth = (this.width - this.margin * 2 - this.columnGap) / 2;
    this.mvpHeight = options.messagesEntries.length > 0 ? 110 : 0;

    const maxRows = Math.max(options.messagesEntries.length, options.voiceEntries.length);
    const listsHeight =
      maxRows > 0
        ? this.sectionTitleHeight + maxRows * (this.entryHeight + this.entrySpacing) - this.entrySpacing
        : 0;

    const gaps = this.mvpHeight > 0 && listsHeight > 0 ? this.sectionGap : 0;

    this.height = this.headerHeight + this.mvpHeight + gaps + listsHeight + this.bottomPadding;

    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');
  }

  public async build(): Promise<Buffer> {
    await this.drawBackground();
    this.drawHeader();

    let y = this.headerHeight;

    if (this.mvpHeight > 0) {
      await this.drawMvp(y);
      y += this.mvpHeight + this.sectionGap;
    }

    const leftX = this.margin;
    const rightX = this.margin + this.columnWidth + this.columnGap;
    const maxRows = Math.max(this.options.messagesEntries.length, this.options.voiceEntries.length);

    if (maxRows > 0) {
      this.drawColumnTitle(leftX, y, '💬', `TOP ${this.options.messagesEntries.length} — Wiadomości`, this.colors.messages);
      this.drawColumnTitle(rightX, y, '🎙️', `TOP ${this.options.voiceEntries.length} — Głos`, this.colors.voice);

      const rowsStartY = y + this.sectionTitleHeight;
      const messagesStyle: ColumnStyle = {
        accent: this.colors.messages,
        entryBg: this.colors.messagesEntryBg,
        entryBgTop: this.colors.messagesEntryBgTop,
        formatValue: (v) => `${formatNumberDotSep(v)} 💬`,
      };
      const voiceStyle: ColumnStyle = {
        accent: this.colors.voice,
        entryBg: this.colors.voiceEntryBg,
        entryBgTop: this.colors.voiceEntryBgTop,
        formatValue: (v) => `${formatVoiceTimeReadable(v)} 🎙️`,
      };

      for (let i = 0; i < maxRows; i++) {
        const rowY = rowsStartY + i * (this.entryHeight + this.entrySpacing);
        const msgEntry = this.options.messagesEntries[i];
        const voiceEntry = this.options.voiceEntries[i];

        if (msgEntry) await this.drawEntry(msgEntry, leftX, rowY, messagesStyle);
        if (voiceEntry) await this.drawEntry(voiceEntry, rightX, rowY, voiceStyle);
      }
    }

    this.ctx.restore();
    return this.canvas.toBuffer('image/png');
  }

  private async drawBackground() {
    const cornerRadius = 40;
    this.ctx.fillStyle = this.colors.background;
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
    this.ctx.fill();

    this.ctx.save();
    this.ctx.beginPath();
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
    this.ctx.clip();
  }

  private drawHeader() {
    const { monthName, year, totalMessages } = this.options;

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = '40px Daydream, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`TOPKA ${monthName} ${year}`, this.margin, 58);

    this.ctx.strokeStyle = this.colors.messages;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(this.margin, 78);
    this.ctx.lineTo(this.width - this.margin, 78);
    this.ctx.stroke();

    this.ctx.fillStyle = this.colors.textSecondary;
    this.ctx.font = '18px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.fillText('Liczba wiadomości napisanych w tym miesiącu', this.margin, 108);

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 30px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.fillText(`${formatNumberDotSep(totalMessages)} 💬`, this.margin, 140);
  }

  private async drawMvp(y: number) {
    const mvp = this.options.messagesEntries[0];
    const x = this.margin;
    const width = this.width - this.margin * 2;
    const height = this.mvpHeight;

    this.ctx.fillStyle = this.colors.mvpBg;
    roundRect(this.ctx, x, y, width, height, 16);
    this.ctx.fill();
    this.ctx.strokeStyle = this.colors.mvpBorder;
    this.ctx.lineWidth = 2;
    roundRect(this.ctx, x, y, width, height, 16);
    this.ctx.stroke();

    this.ctx.font = '30px "Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('👑', x + 24, y + height / 2 + 11);

    const avatarSize = 64;
    const avatarX = x + 70;
    const avatarY = y + (height - avatarSize) / 2;
    await this.drawAvatar(mvp, avatarX, avatarY, avatarSize);

    this.ctx.fillStyle = this.colors.gold;
    this.ctx.font = 'bold 13px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('MVP MIESIĄCA', x + 150, y + height / 2 - 12);

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 24px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.fillText(this.truncate(mvp.username, 420), x + 150, y + height / 2 + 18);

    this.ctx.fillStyle = this.colors.textSecondary;
    this.ctx.font = '600 18px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`${formatNumberDotSep(mvp.value)} 💬`, x + width - 24, y + height / 2 + 7);
    this.ctx.textAlign = 'left';
  }

  private drawColumnTitle(x: number, y: number, emoji: string, title: string, accentColor: string) {
    this.ctx.fillStyle = accentColor;
    this.ctx.font = 'bold 18px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`${emoji} ${title}`, x, y + 26);
  }

  private async drawEntry(entry: TopkaCardEntry, x: number, y: number, style: ColumnStyle) {
    const width = this.columnWidth;
    const height = this.entryHeight;
    const cornerRadius = 12;
    const isTopThree = entry.rank <= 3;

    this.ctx.fillStyle = isTopThree ? style.entryBgTop : style.entryBg;
    roundRect(this.ctx, x, y, width, height, cornerRadius);
    this.ctx.fill();

    const rankX = x + 26;
    const rankY = y + height / 2;
    await this.drawRankBadge(entry.rank, rankX, rankY);

    const avatarSize = 38;
    const avatarX = x + 54;
    const avatarY = y + (height - avatarSize) / 2;
    await this.drawAvatar(entry, avatarX, avatarY, avatarSize);

    const usernameX = x + 104;
    const usernameY = y + height / 2 - 4;
    const valueReserve = 108;
    const maxUsernameWidth = width - 104 - valueReserve;

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 16px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.fillText(this.truncate(entry.username, maxUsernameWidth), usernameX, usernameY + 4);

    this.drawDelta(entry, usernameX, y + height / 2 + 15, maxUsernameWidth);

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 16px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'right';
    this.ctx.fillText(style.formatValue(entry.value), x + width - 16, y + height / 2 + 6);
    this.ctx.textAlign = 'left';
  }

  private drawDelta(entry: TopkaCardEntry, x: number, y: number, maxWidth: number) {
    this.ctx.font = '600 11px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'left';

    const draw = (text: string, color: string) => {
      this.ctx.fillStyle = color;
      let display = text;
      let w = this.ctx.measureText(display).width;
      while (w > maxWidth && display.length > 1) {
        display = display.slice(0, -1);
        w = this.ctx.measureText(display).width;
      }
      this.ctx.fillText(display, x, y);
    };

    if (entry.isNew) {
      draw('🆕 nowy w rankingu', this.colors.newBadge);
      return;
    }

    if (entry.prevRank === 0) {
      draw('brak danych z poprz. mies.', this.colors.neutral);
      return;
    }

    const rankDiff = entry.prevRank - entry.rank;
    const valueDiff = entry.value - entry.prevValue;
    const sign = valueDiff > 0 ? '+' : '';

    if (rankDiff > 0) {
      draw(`▲ ${rankDiff} (${sign}${formatNumberDotSep(valueDiff)})`, this.colors.up);
    } else if (rankDiff < 0) {
      draw(`▼ ${Math.abs(rankDiff)} (${sign}${formatNumberDotSep(valueDiff)})`, this.colors.down);
    } else {
      draw(`– bez zmian (${sign}${formatNumberDotSep(valueDiff)})`, this.colors.neutral);
    }
  }

  private async drawRankBadge(rank: number, cx: number, cy: number) {
    if (rank > 3) {
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.font = 'bold 18px Inter, "Segoe UI", Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${rank}`, cx, cy + 6);
      this.ctx.textAlign = 'left';
      return;
    }

    const botConfig = getBotConfig(this.options.botId);
    const trophyEmojis = [
      botConfig.emojis.trophy.gold,
      botConfig.emojis.trophy.silver,
      botConfig.emojis.trophy.bronze,
    ];
    const trophyEmoji = trophyEmojis[rank - 1];
    const customEmojiMatch = trophyEmoji.match(/<a?:\w+:(\d+)>/);

    if (customEmojiMatch) {
      try {
        const medalUrl = `https://cdn.discordapp.com/emojis/${customEmojiMatch[1]}.png`;
        const medalImage = await loadImage(medalUrl);
        const medalSize = 26;
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(medalImage, cx - medalSize / 2, cy - medalSize / 2, medalSize, medalSize);
        return;
      } catch {
        // fall through to circle fallback
      }
    }

    const medalColors = [this.colors.gold, this.colors.silver, this.colors.bronze];
    this.ctx.fillStyle = medalColors[rank - 1];
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.font = 'bold 15px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${rank}`, cx, cy + 5);
    this.ctx.textAlign = 'left';
  }

  private async drawAvatar(entry: TopkaCardEntry, x: number, y: number, size: number) {
    try {
      const avatarImagePromise = loadImage(entry.avatarURL);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Avatar load timeout')), 5000),
      );
      const avatarImage = (await Promise.race([avatarImagePromise, timeoutPromise])) as Image;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      this.ctx.closePath();
      this.ctx.clip();
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(avatarImage, x, y, size, size);
      this.ctx.restore();
    } catch (error) {
      logger.warn(`[TOPKA-CANVAS] Nie udało się wczytać avatara: ${error}`);
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
      this.ctx.closePath();
      this.ctx.fillStyle = this.colors.messages;
      this.ctx.fill();
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.font = `bold ${Math.floor(size * 0.4)}px Inter, "Segoe UI", Arial, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(entry.username.charAt(0).toUpperCase(), x + size / 2, y + size / 2);
      this.ctx.restore();
      this.ctx.textBaseline = 'alphabetic';
    }
  }

  private truncate(text: string, maxWidth: number): string {
    let display = text;
    let w = this.ctx.measureText(display).width;
    if (w <= maxWidth) return display;
    while (w > maxWidth && display.length > 1) {
      display = display.slice(0, -1);
      w = this.ctx.measureText(display + '...').width;
    }
    return `${display}...`;
  }
}
