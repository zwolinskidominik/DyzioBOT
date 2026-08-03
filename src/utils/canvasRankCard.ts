import { createCanvas, loadImage, Canvas, Image } from 'canvas';
import { Ctx2D, registerProjectFonts, roundRect, formatNumberDotSep } from './canvasHelpers';
import logger from './logger';

interface RankCardOptions {
  username: string;
  level: number;
  currentXP: number;
  requiredXP: number;
  totalXP: number;
  rank: number;
  avatarURL: string;
  /** Kolor motywu karty (hex, np. '#3b82f6'). Domyślnie niebieski. */
  themeColor?: string;
  /** Czy pokazywać blok RANK obok LVL. Domyślnie true. */
  showRank?: boolean;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_THEME_COLOR = '#3b82f6';

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '');
  const full =
    normalized.length === 3
      ? normalized.split('').map((c) => c + c).join('')
      : normalized;
  const num = parseInt(full, 16);
  if (full.length !== 6 || Number.isNaN(num)) return hexToRgb(DEFAULT_THEME_COLOR);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl({ r, g, b }: RgbColor): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.min(Math.max(s, 0), 100) / 100;
  const ln = Math.min(Math.max(l, 0), 100) / 100;

  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const hueToRgb = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  return {
    r: Math.round(hueToRgb(hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(hn) * 255),
    b: Math.round(hueToRgb(hn - 1 / 3) * 255),
  };
}

function rgbToHex({ r, g, b }: RgbColor): string {
  const toHex = (v: number) => Math.min(Math.max(Math.round(v), 0), 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Ustaw absolutną jasność (0-100) zachowując hue/saturację bazowego koloru. */
function shade(baseHsl: { h: number; s: number }, lightness: number): string {
  return rgbToHex(hslToRgb(baseHsl.h, baseHsl.s, lightness));
}

/**
 * Wyprowadza spójną paletę akcentów karty rangi z jednego koloru motywu,
 * zamiast trzymać osobną hardcoded paletę per-kolor. Tła/tekst pozostają
 * neutralne (dark mode zawsze) — motywuje się tylko akcenty.
 */
function derivePalette(themeColor: string) {
  const rgb = hexToRgb(themeColor);
  const hsl = rgbToHsl(rgb);

  return {
    primary: rgbToHex(rgb),
    secondary: shade(hsl, hsl.l + 8),
    cardBorder: shade(hsl, hsl.l - 5),
    avatarBorder: shade(hsl, hsl.l + 3),
    progressFill: rgbToHex(rgb),
    progressBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
    // Sekwencja jasności odtwarzająca oryginalny układ dekoracyjnych kółek
    // (jasne akcenty, średnie, ciemne), niezależnie od wybranego hue.
    circleTints: [78.4, 59.8, 67.8, 40.2, 32.9, 92.7, 40.2, 67.8, 59.8, 78.4].map((l) =>
      shade(hsl, l),
    ),
  };
}

export class CanvasRankCard {
  private canvas: Canvas;
  private ctx: Ctx2D;
  private readonly width = 1000;
  private readonly height = 250;
  private readonly showRank: boolean;
  private readonly colors: {
    primary: string;
    secondary: string;
    background: string;
    cardBackground: string;
    textPrimary: string;
    textSecondary: string;
    progressBackground: string;
    progressFill: string;
    cardBorder: string;
    avatarBorder: string;
  };
  private readonly circleTints: string[];

  constructor(private options: RankCardOptions) {
    registerProjectFonts();
    this.canvas = createCanvas(this.width, this.height);
    this.ctx = this.canvas.getContext('2d');
    this.showRank = options.showRank ?? true;

    const palette = derivePalette(options.themeColor || DEFAULT_THEME_COLOR);
    this.circleTints = palette.circleTints;
    this.colors = {
      primary: palette.primary,
      secondary: palette.secondary,
      background: '#0a1628',
      cardBackground: 'rgba(15, 23, 42, 0.75)',
      textPrimary: '#ffffff',
      textSecondary: '#94a3b8',
      progressBackground: palette.progressBackground,
      progressFill: palette.progressFill,
      cardBorder: palette.cardBorder,
      avatarBorder: palette.avatarBorder,
    };
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
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
    this.ctx.fill();
    
    this.ctx.save();
    this.ctx.beginPath();
    roundRect(this.ctx, 0, 0, this.width, this.height, cornerRadius);
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

    const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9] = this.circleTints;

    this.ctx.fillStyle = c0;
    this.ctx.beginPath();
    this.ctx.arc(circleX, circleY, 75, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c1;
    this.ctx.beginPath();
    this.ctx.arc(239, 16, 10.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c2;
    this.ctx.beginPath();
    this.ctx.arc(396, 33, 7.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c3;
    this.ctx.beginPath();
    this.ctx.arc(516, 38, 12.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c4;
    this.ctx.beginPath();
    this.ctx.arc(1000, 101, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c5;
    this.ctx.beginPath();
    this.ctx.arc(213, 81, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c6;
    this.ctx.beginPath();
    this.ctx.arc(476, 148, 40, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c7;
    this.ctx.beginPath();
    this.ctx.arc(153, 225, 10, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c8;
    this.ctx.beginPath();
    this.ctx.arc(572, 257, 30, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.fillStyle = c9;
    this.ctx.beginPath();
    this.ctx.arc(783, 227, 8.5, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private async drawAvatar() {
    try {
      const avatarImagePromise = loadImage(this.options.avatarURL);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Avatar load timeout')), 5000)
      );
      
      const avatarImage = await Promise.race([avatarImagePromise, timeoutPromise]) as Image;
      const avatarSize = 150;
      const avatarX = 30;
      const avatarY = 50;

      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
      
      const tempSize = avatarSize * 2;
      const tempCanvas = createCanvas(tempSize, tempSize);
      const tempCtx = tempCanvas.getContext('2d') as Ctx2D;
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
      logger.warn(`[CANVAS] Error loading avatar: ${error}`);

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

    const levelEndX = this.showRank ? rankLabelX - 15 : progressEndX;
    const levelNumberX = levelEndX - levelNumberWidth;
    const levelLabelX = levelNumberX - lvlLabelWidth;

    this.ctx.fillStyle = this.colors.textPrimary;
    this.ctx.font = labelFont;
    this.ctx.fillText('LVL', levelLabelX, levelRankY);

    this.ctx.fillStyle = this.colors.primary;
    this.ctx.font = numberFont;
    this.ctx.fillText(levelText, levelNumberX, levelRankY);

    if (this.showRank) {
      this.ctx.fillStyle = this.colors.textPrimary;
      this.ctx.font = labelFont;
      this.ctx.fillText('RANK', rankLabelX, levelRankY);

      this.ctx.fillStyle = this.colors.primary;
      this.ctx.font = numberFont;
      this.ctx.fillText(rankText, rankNumberX, levelRankY);
    }

    this.ctx.textAlign = 'left';
  }

  private drawProgressBar() {
    const progressX = 210; 
    const progressY = 165;
    const progressWidth = this.width - 240;
    const progressHeight = 35;
    const cornerRadius = 20;

    this.ctx.fillStyle = this.colors.progressBackground;
    roundRect(this.ctx, progressX, progressY, progressWidth, progressHeight, cornerRadius);
    this.ctx.fill();

    const progressPercent = Math.min(this.options.currentXP / this.options.requiredXP, 1);
    const fillWidth = progressWidth * progressPercent;

    if (fillWidth > 0) {
      this.ctx.save();
      
      this.ctx.beginPath();
      roundRect(this.ctx, progressX, progressY, progressWidth, progressHeight, cornerRadius);
      this.ctx.clip();
      
      this.ctx.fillStyle = this.colors.progressFill;
      roundRect(this.ctx, progressX, progressY, fillWidth, progressHeight, cornerRadius);
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }

  private drawTotalXP() {
    const progressX = 210;
    const progressY = 165;
    const progressWidth = this.width - 240;
    const progressHeight = 35;

    const totalText = `Razem: ${formatNumberDotSep(this.options.totalXP)} XP`;
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
}
