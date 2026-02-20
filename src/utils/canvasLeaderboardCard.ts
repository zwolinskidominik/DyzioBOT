import { createCanvas, loadImage, Canvas, Image } from 'canvas';
import { xpForLevel, deltaXp } from './levelMath';
import { getBotConfig } from '../config/bot';
import { Ctx2D, registerProjectFonts, roundRect, formatNumberCompact } from './canvasHelpers';
import logger from './logger';

interface LeaderboardEntry {
  username: string;
  level: number;
  totalXP: number;
  rank: number;
  avatarURL: string;
}

interface LeaderboardCardOptions {
  entries: LeaderboardEntry[];
  guildName: string;
  page?: number;
  botId: string;
}

export class CanvasLeaderboardCard {
  private canvas: Canvas;
  private ctx: Ctx2D;
  private readonly width = 900;
  private readonly height: number;
  private readonly colors = {
    primary: '#5b8def',
    secondary: '#7ba3f7',
    background: '#0a1628',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    entryBackground: 'rgba(91, 141, 239, 0.15)',
    entryBackgroundHover: 'rgba(91, 141, 239, 0.25)',
    gold: '#FFD700',
    silver: '#C0C0C0',
    bronze: '#CD7F32',
  };

  private options: LeaderboardCardOptions;

  constructor(options: LeaderboardCardOptions) {
    this.options = options;
    registerProjectFonts();
    
    const entryCount = this.options.entries.length;
    const headerHeight = 120;
    const entryHeight = 65;
    const entrySpacing = 5;
    const bottomPadding = 30;
    
    this.height = headerHeight + (entryCount * (entryHeight + entrySpacing)) - entrySpacing + bottomPadding;
    
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');
  }

  public async build(): Promise<Buffer> {
    await this.drawBackground();
    this.drawHeader();
    await this.drawEntries();

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
    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = '48px Daydream, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'center';
    
    const topkaWidth = this.ctx.measureText('TOPKA').width;
    const leveliWidth = this.ctx.measureText('LEVELI').width;
    const gap = 30;
    
    const totalWidth = topkaWidth + gap + leveliWidth;
    const startX = (this.width - totalWidth) / 2;
    
    this.ctx.textAlign = 'left';
    this.ctx.fillText('TOPKA', startX, 60);
    
    this.ctx.fillText('LEVELI', startX + topkaWidth + gap, 60);
    
    this.ctx.textAlign = 'center';

    const page = this.options.page ?? 1;
    if (page > 1) {
      this.ctx.fillStyle = this.colors.textSecondary;
      this.ctx.font = '16px Inter, "Segoe UI", Arial, sans-serif';
      this.ctx.fillText(`Strona ${page}`, this.width / 2, 82);
    }

    this.ctx.strokeStyle = this.colors.primary;
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(50, 95);
    this.ctx.lineTo(this.width - 50, 95);
    this.ctx.stroke();
  }

  private async drawEntries() {
    const startY = 120;
    const entryHeight = 65;
    const spacing = 5;

    for (let i = 0; i < this.options.entries.length; i++) {
      const entry = this.options.entries[i];
      const y = startY + i * (entryHeight + spacing);
      await this.drawEntry(entry, y, entryHeight);
    }
  }

  private async drawEntry(entry: LeaderboardEntry, y: number, height: number) {
    const x = 40;
    const width = this.width - 80;
    const cornerRadius = 15;

    const isTopThree = entry.rank <= 3;
    this.ctx.fillStyle = isTopThree
      ? this.colors.entryBackgroundHover
      : this.colors.entryBackground;
    roundRect(this.ctx, x, y, width, height, cornerRadius);
    this.ctx.fill();

    this.ctx.textAlign = 'center';
    const rankX = x + 35;
    const rankY = y + height / 2;

    if (isTopThree) {
      const botConfig = getBotConfig(this.options.botId);
      const trophyEmojis = [
        botConfig.emojis.trophy.gold,
        botConfig.emojis.trophy.silver,
        botConfig.emojis.trophy.bronze,
      ];
      
      const trophyEmoji = trophyEmojis[entry.rank - 1];
      
      const customEmojiMatch = trophyEmoji.match(/<a?:\w+:(\d+)>/);
      
      if (customEmojiMatch) {
        const emojiId = customEmojiMatch[1];
        try {
          const medalUrl = `https://cdn.discordapp.com/emojis/${emojiId}.png`;
          const medalImage = await loadImage(medalUrl);
          const medalSize = 32;
          const medalX = rankX - medalSize / 2;
          const medalY = rankY - medalSize / 2;
          
          this.ctx.imageSmoothingEnabled = true;
          this.ctx.imageSmoothingQuality = 'high';
          this.ctx.drawImage(medalImage, medalX, medalY, medalSize, medalSize);
        } catch (error) {
          this.drawMedalFallback(rankX, rankY, entry.rank);
        }
      } else {
        this.ctx.font = '32px "Segoe UI Emoji", "Noto Color Emoji", "Apple Color Emoji", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(trophyEmoji, rankX, rankY);
      }
    } else {
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.font = 'bold 26px Inter, "Segoe UI", Arial, sans-serif';
      this.ctx.fillText(`${entry.rank}.`, rankX, rankY + 9);
    }

    try {
      const avatarImagePromise = loadImage(entry.avatarURL);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Avatar load timeout')), 5000)
      );
      
      const avatarImage = await Promise.race([avatarImagePromise, timeoutPromise]) as Image;
      const avatarSize = 45;
      const avatarX = x + 70;
      const avatarY_pos = y + (height - avatarSize) / 2;

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(
        avatarX + avatarSize / 2,
        avatarY_pos + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.closePath();
      this.ctx.clip();

      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      this.ctx.drawImage(avatarImage, avatarX, avatarY_pos, avatarSize, avatarSize);
      this.ctx.restore();
    } catch (error) {
      logger.warn(`[CANVAS] Error loading avatar for leaderboard: ${error}`);
      
      const avatarSize = 45;
      const avatarX = x + 70;
      const avatarY_pos = y + (height - avatarSize) / 2;
      
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(
        avatarX + avatarSize / 2,
        avatarY_pos + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.closePath();
      this.ctx.fillStyle = this.colors.secondary;
      this.ctx.fill();
      
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.font = 'bold 20px Inter, "Segoe UI", Arial, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      const initial = entry.username.charAt(0).toUpperCase();
      this.ctx.fillText(initial, avatarX + avatarSize / 2, avatarY_pos + avatarSize / 2);
      this.ctx.restore();
    }

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 20px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'left';
    const usernameX = x + 130;
    const usernameY = y + height / 2 + 7;
    
    const maxUsernameWidth = 360;
    let displayUsername = entry.username;
    let usernameWidth = this.ctx.measureText(displayUsername).width;
    
    if (usernameWidth > maxUsernameWidth) {
      while (usernameWidth > maxUsernameWidth && displayUsername.length > 1) {
        displayUsername = displayUsername.slice(0, -1);
        usernameWidth = this.ctx.measureText(displayUsername + '...').width;
      }
      displayUsername += '...';
    }
    
    this.ctx.fillText(displayUsername, usernameX, usernameY);

    this.ctx.fillStyle = this.colors.primary;
    this.ctx.font = 'bold 20px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'right';
    const lvlTextX = width + x - 180;
    this.ctx.fillText('LVL', lvlTextX, usernameY);

    const circleRadius = 24;
    const circleX = width + x - 135;
    const circleY = y + height / 2;
    
    const xpForCurrentLevel = xpForLevel(entry.level);
    const currentXP = entry.totalXP - xpForCurrentLevel;
    const requiredXP = deltaXp(entry.level);
    const progress = Math.min(1, Math.max(0, currentXP / requiredXP));
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2);
    this.ctx.stroke();
    
    this.ctx.strokeStyle = this.colors.primary;
    this.ctx.lineWidth = 4;
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();

    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (progress * Math.PI * 2);
    this.ctx.arc(circleX, circleY, circleRadius, startAngle, endAngle);
    this.ctx.stroke();
    
    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 22px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${entry.level}`, circleX, circleY + 7);

    this.ctx.fillStyle = this.colors.textSecondary;
    this.ctx.font = '600 16px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'right';
    const xpX = width + x - 20;
    this.ctx.fillText(`${formatNumberCompact(entry.totalXP)} XP`, xpX, usernameY);

    this.ctx.textAlign = 'left';
  }

  private drawMedalFallback(rankX: number, rankY: number, rank: number) {
    const medalColors = [this.colors.gold, this.colors.silver, this.colors.bronze];
    const medalRadius = 18;
    
    this.ctx.fillStyle = medalColors[rank - 1];
    this.ctx.beginPath();
    this.ctx.arc(rankX, rankY, medalRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.font = 'bold 20px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${rank}`, rankX, rankY + 7);
  }
}
