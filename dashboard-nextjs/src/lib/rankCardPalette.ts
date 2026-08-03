/**
 * Wyprowadzanie palety karty /level z jednego koloru motywu — czysty JS/TS,
 * bez zależności od `canvas` (którego nie da się uruchomić w tym środowisku
 * na serwerze). Logika 1:1 odzwierciedla derivePalette() z
 * src/utils/canvasRankCard.ts po stronie bota, żeby podgląd w dashboardzie
 * wizualnie odpowiadał prawdziwej karcie generowanej na Discordzie.
 */

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

const DEFAULT_THEME_COLOR = '#3b82f6';

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '');
  const full = normalized.length === 3 ? normalized.split('').map((c) => c + c).join('') : normalized;
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
  const hn = (((h % 360) + 360) % 360) / 360;
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

function shade(baseHsl: { h: number; s: number }, lightness: number): string {
  return rgbToHex(hslToRgb(baseHsl.h, baseHsl.s, lightness));
}

export interface RankCardPalette {
  primary: string;
  progressFill: string;
  progressBackground: string;
  circleTints: string[];
}

const CIRCLE_LIGHTNESS_STOPS = [78.4, 59.8, 67.8, 40.2, 32.9, 92.7, 40.2, 67.8, 59.8, 78.4];

export function deriveRankCardPalette(themeColor: string): RankCardPalette {
  const rgb = hexToRgb(themeColor || DEFAULT_THEME_COLOR);
  const hsl = rgbToHsl(rgb);

  return {
    primary: rgbToHex(rgb),
    progressFill: rgbToHex(rgb),
    progressBackground: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`,
    circleTints: CIRCLE_LIGHTNESS_STOPS.map((l) => shade(hsl, l)),
  };
}
