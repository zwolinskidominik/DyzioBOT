import { registerFont, CanvasRenderingContext2D } from 'canvas';
import path from 'path';
import fs from 'fs';
import logger from './logger';

export type Ctx2D = CanvasRenderingContext2D & { imageSmoothingQuality?: string };

/* ── Font loading ─────────────────────────────────────────────── */

const FONT_DIR = path.resolve(__dirname, '..', '..', 'assets');

interface FontDef {
  file: string;
  family: string;
  weight: string;
  style: string;
}

const INTER_FONTS: FontDef[] = [
  { file: 'Inter-Bold.ttf',           family: 'Inter', weight: 'bold',   style: 'normal' },
  { file: 'Inter-BoldItalic.ttf',     family: 'Inter', weight: 'bold',   style: 'italic' },
  { file: 'Inter-SemiBold.ttf',       family: 'Inter', weight: '600',    style: 'normal' },
  { file: 'Inter-SemiBoldItalic.ttf', family: 'Inter', weight: '600',    style: 'italic' },
  { file: 'Inter-Medium.ttf',         family: 'Inter', weight: '500',    style: 'normal' },
  { file: 'Inter-MediumItalic.ttf',   family: 'Inter', weight: '500',    style: 'italic' },
  { file: 'Inter-Regular.ttf',        family: 'Inter', weight: 'normal', style: 'normal' },
  { file: 'Inter-Light.ttf',          family: 'Inter', weight: '300',    style: 'normal' },
  { file: 'Inter-LightItalic.ttf',    family: 'Inter', weight: '300',    style: 'italic' },
];

const EXTRA_FONTS: FontDef[] = [
  { file: 'Daydream.otf', family: 'Daydream', weight: 'normal', style: 'normal' },
];

let fontsRegistered = false;

/**
 * Register all project fonts (Inter + Daydream) once.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function registerProjectFonts(): void {
  if (fontsRegistered) return;
  fontsRegistered = true;

  for (const def of [...INTER_FONTS, ...EXTRA_FONTS]) {
    const fp = path.resolve(FONT_DIR, def.file);
    if (!fs.existsSync(fp)) continue;
    try {
      registerFont(fp, { family: def.family, weight: def.weight, style: def.style });
    } catch (err) {
      logger.warn(`[CANVAS] Could not register font ${def.file}: ${err}`);
    }
  }
}

/* ── Drawing primitives ───────────────────────────────────────── */

/** Draw a rounded rectangle path (does NOT fill/stroke — caller decides). */
export function roundRect(
  ctx: Ctx2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/* ── Number formatting ────────────────────────────────────────── */

/** Format with dot thousands separator: 1234 → "1.234" */
export function formatNumberDotSep(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Compact format: 1 234 567 → "1.2M", 12 345 → "12.3k" */
export function formatNumberCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 10_000) return `${(num / 1_000).toFixed(1)}k`;
  return formatNumberDotSep(num);
}
