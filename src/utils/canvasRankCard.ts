import { createCanvas, loadImage, registerFont, Canvas } from 'canvas';
import path from 'path';
import fs from 'fs';

interface RankCardOptions {
  username: string;
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
  rank: number;
  avatarURL: string;
}

export class CanvasRankCard {
  private canvas: Canvas;
  private ctx: any;
  private readonly width = 1000;
  private readonly height = 250;
  private readonly colors = {
    primary: '#5b8def',
    secondary: '#7ba3f7',
    background: '#0a1628',
    cardBackground: 'rgba(15, 23, 42, 0.75)',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    progressBackground: 'rgba(91, 141, 239, 0.3)',
    progressFill: '#5b8def',
    cardBorder: '#3b82f6',
    avatarBorder: '#60a5fa',
  };

  private formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  constructor(private options: RankCardOptions) {
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');
    this.loadFonts();
  }

  private loadFonts() {
    try {
      const projectRoot = path.resolve(__dirname, '..', '..');
      const fontPaths = {
        bold: path.resolve(projectRoot, 'assets/Inter-Bold.ttf'),
        bolditalic: path.resolve(projectRoot, 'assets/Inter-BoldItalic.ttf'),
        semibold: path.resolve(projectRoot, 'assets/Inter-SemiBold.ttf'),
        semibolditalic: path.resolve(projectRoot, 'assets/Inter-SemiBoldItalic.ttf'),
        medium: path.resolve(projectRoot, 'assets/Inter-Medium.ttf'),
        mediumitalic: path.resolve(projectRoot, 'assets/Inter-MediumItalic.ttf'),
        regular: path.resolve(projectRoot, 'assets/Inter-Regular.ttf'),
        light: path.resolve(projectRoot, 'assets/Inter-Light.ttf'),
        lightitalic: path.resolve(projectRoot, 'assets/Inter-LightItalic.ttf'),
      };

      Object.entries(fontPaths).forEach(([type, fontPath]) => {
        if (fs.existsSync(fontPath)) {
          try {
            registerFont(fontPath, {
              family: 'Inter',
              weight: this.getFontWeight(type),
              style: this.getFontStyle(type),
            });
          } catch (error) {
            console.warn(`[CANVAS] Could not register font ${type}:`, error);
          }
        }
      });
    } catch (error) {
      console.warn('[CANVAS] Error loading fonts:', error);
    }
  }

  private getFontWeight(type: string): string {
    switch (type) {
      case 'bold':
      case 'bolditalic':
        return 'bold';
      case 'semibold':
      case 'semibolditalic':
        return '600';
      case 'medium':
      case 'mediumitalic':
        return '500';
      case 'light':
      case 'lightitalic':
        return '300';
      default:
        return 'normal';
    }
  }

  private getFontStyle(type: string): string {
    return type.includes('italic') ? 'italic' : 'normal';
  }

  public async build(): Promise<Buffer> {
    await this.drawBackground();

    this.drawDecorativeCircles();

    await this.drawAvatar();

    this.drawUserInfo();

    this.drawProgressBar();

    this.drawTotalXP();

    this.ctx.restore();

    return this.canvas.toBuffer('image/png');
  }

  private async drawBackground() {
    const cornerRadius = 40;
    this.ctx.fillStyle = this.colors.background;
    this.roundRect(0, 0, this.width, this.height, cornerRadius);
    this.ctx.fill();
    
    this.ctx.save();
    this.ctx.beginPath();
    this.roundRect(0, 0, this.width, this.height, cornerRadius);
    this.ctx.clip();
  }

  private drawDecorativeCircles() {
    const avatarX = 40;
    const avatarY = 60;
    const avatarSize = 135;
    const avatarCenterX = avatarX + avatarSize / 2;
    const avatarCenterY = avatarY + avatarSize / 2;
    
    const circleX = avatarCenterX - 27 + 8;
    const circleY = avatarCenterY - 34 + 9 - 2;
    
    this.ctx.fillStyle = '#93c5fd';
    this.ctx.beginPath();
    this.ctx.arc(circleX, circleY, 75, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#3b82f6';
    this.ctx.beginPath();
    this.ctx.arc(239, 16, 10.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#60a5fa';
    this.ctx.beginPath();
    this.ctx.arc(396, 33, 7.5, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = '#1e40af';
    this.ctx.beginPath();
    this.ctx.arc(516, 38, 12.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#1e3a8a';
    this.ctx.beginPath();
    this.ctx.arc(1000, 101, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#dbeafe';
    this.ctx.beginPath();
    this.ctx.arc(213, 81, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#1e40af';
    this.ctx.beginPath();
    this.ctx.arc(476, 148, 40, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#60a5fa';
    this.ctx.beginPath();
    this.ctx.arc(153, 225, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#3b82f6';
    this.ctx.beginPath();
    this.ctx.arc(572, 257, 30, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = '#93c5fd';
    this.ctx.beginPath();
    this.ctx.arc(783, 227, 8.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private async drawAvatar() {
    try {
      // Timeout wrapper dla loadImage (max 5 sekund)
      const avatarImagePromise = loadImage(this.options.avatarURL);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Avatar load timeout')), 5000)
      );
      
      const avatarImage = await Promise.race([avatarImagePromise, timeoutPromise]) as any;
      const avatarSize = 150;
      const avatarX = 30;
      const avatarY = 50;

      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      
      const tempSize = avatarSize * 2;
      const tempCanvas = createCanvas(tempSize, tempSize);
      const tempCtx: any = tempCanvas.getContext('2d');
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';

      tempCtx.save();
      tempCtx.beginPath();
      tempCtx.arc(tempSize / 2, tempSize / 2, tempSize / 2, 0, Math.PI * 2);
      tempCtx.closePath();
      tempCtx.clip();
      tempCtx.drawImage(avatarImage, 0, 0, tempSize, tempSize);
      tempCtx.restore();

      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.closePath();
      this.ctx.clip();

      this.ctx.drawImage(tempCanvas, avatarX, avatarY, avatarSize, avatarSize);
      this.ctx.restore();
    } catch (error) {
      console.warn('[CANVAS] Error loading avatar:', error);

      const avatarSize = 150;
      const avatarX = 30;
      const avatarY = 50;

      this.ctx.fillStyle = this.colors.secondary;
      this.ctx.beginPath();
      this.ctx.arc(
        avatarX + avatarSize / 2,
        avatarY + avatarSize / 2,
        avatarSize / 2,
        0,
        Math.PI * 2
      );
      this.ctx.fill();
    }
  }

  private drawUserInfo() {
    const progressX = 210;
    const progressWidth = this.width - 240;
    
    const usernameX = progressX;
    const usernameY = 150;

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = 'bold 36px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.fillText(this.options.username, usernameX, usernameY);

    const xpY = 150;
    const currentXPText = `${this.options.currentXP.toLocaleString('pl-PL')} `;
    const slashText = '/ ';
    const requiredXPText = `${this.options.requiredXP.toLocaleString('pl-PL')} xp`;

    this.ctx.font = 'bold 34px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'right';
    const progressEndX = progressX + progressWidth;
    
    let currentX = progressEndX;
    
    this.ctx.fillStyle = '#7f8381';
    this.ctx.fillText(requiredXPText, currentX, xpY);
    currentX -= this.ctx.measureText(requiredXPText).width;
    
    this.ctx.fillStyle = '#7f8381';
    this.ctx.fillText(slashText, currentX, xpY);
    currentX -= this.ctx.measureText(slashText).width;
    
    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.fillText(currentXPText, currentX, xpY);
    
    this.ctx.textAlign = 'left';

    const levelRankY = 75;
    
    const labelFont = 'bold 36px Inter, "Segoe UI", Arial, sans-serif';
    const numberFont = 'bold 60px Inter, "Segoe UI", Arial, sans-serif';
    
    this.ctx.font = labelFont;
    const lvlLabelWidth = this.ctx.measureText('LVL ').width;
    const rankLabelWidth = this.ctx.measureText('RANK ').width;
    
    this.ctx.font = numberFont;
    const rankText = `#${this.options.rank}`;
    const levelText = this.options.level.toString();
    const rankNumberWidth = this.ctx.measureText(rankText).width;
    const levelNumberWidth = this.ctx.measureText(levelText).width;

    const rankEndX = progressEndX;
    const rankNumberX = rankEndX - rankNumberWidth;
    const rankLabelX = rankNumberX - rankLabelWidth;
    
    const levelEndX = rankLabelX - 15;
    const levelNumberX = levelEndX - levelNumberWidth;
    const levelLabelX = levelNumberX - lvlLabelWidth;

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = labelFont;
    this.ctx.fillText('LVL', levelLabelX, levelRankY);
    
    this.ctx.fillStyle = this.colors.primary;
    this.ctx.font = numberFont;
    this.ctx.fillText(levelText, levelNumberX, levelRankY);

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = labelFont;
    this.ctx.fillText('RANK', rankLabelX, levelRankY);
    
    this.ctx.fillStyle = this.colors.primary;
    this.ctx.font = numberFont;
    this.ctx.fillText(rankText, rankNumberX, levelRankY);

    this.ctx.textAlign = 'left';
  }

  private drawProgressBar() {
    const progressX = 210; 
    const progressY = 165;
    const progressWidth = this.width - 240;
    const progressHeight = 35;
    const cornerRadius = 20;

    this.ctx.fillStyle = this.colors.progressBackground;
    this.roundRect(progressX, progressY, progressWidth, progressHeight, cornerRadius);
    this.ctx.fill();

    const progressPercent = Math.min(this.options.currentXP / this.options.requiredXP, 1);
    const fillWidth = progressWidth * progressPercent;

    if (fillWidth > 0) {
      this.ctx.save();
      
      this.ctx.beginPath();
      this.roundRect(progressX, progressY, progressWidth, progressHeight, cornerRadius);
      this.ctx.clip();
      
      this.ctx.fillStyle = this.colors.progressFill;
      this.roundRect(progressX, progressY, fillWidth, progressHeight, cornerRadius);
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }

  private drawTotalXP() {
    const progressX = 210;
    const progressY = 165;
    const progressWidth = this.width - 240;
    const progressHeight = 35;

    const totalText = `Razem: ${this.formatNumber(this.options.totalXP)} XP`;
    const totalX = progressX + progressWidth / 2;
    const totalY = progressY + progressHeight / 2 + 5;

    this.ctx.font = 'bold 13px Inter, "Segoe UI", Arial, sans-serif';
    this.ctx.textAlign = 'center';

    const progressPercent = Math.min(this.options.currentXP / this.options.requiredXP, 1);
    const fillWidth = progressWidth * progressPercent;
    const fillEndX = progressX + fillWidth;

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(fillEndX, 0, this.width - fillEndX, this.height);
    this.ctx.clip();
    this.ctx.fillStyle = '#b9bbbe';
    this.ctx.fillText(totalText, totalX, totalY);
    this.ctx.restore();

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(progressX, 0, fillWidth, this.height);
    this.ctx.clip();
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillText(totalText, totalX, totalY);
    this.ctx.restore();

    this.ctx.textAlign = 'left';
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
}
