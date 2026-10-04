import { loadImage, Image } from 'canvas';
import type { Ctx2D } from './canvasHelpers';
import logger from './logger';

/**
 * Tekst z emoji na canvasie.
 *
 * node-canvas (Cairo) nie renderuje kolorowych emoji przez fillText — zamiast glifu rysuje
 * pusty prostokąt z kodem (np. „01F3AE" dla 🎮). Tak wyglądała nazwa serwera w grafice
 * statystyk miesięcznych. Dlatego emoji rysujemy jako obrazki Twemoji (ta sama wersja, co
 * medale w canvasMonthlyTopkaCardV3), a zwykły tekst przez fillText.
 */

const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72';
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
const ZWJ = '‍';
const VARIATION_SELECTOR_16 = /️/g;

/** Emoji są nieco większe od liter, żeby optycznie pasowały do wysokości tekstu. */
const EMOJI_SCALE = 1.2;

const imageCache = new Map<string, Promise<Image | null>>();

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Dzieli tekst na znaki widoczne dla człowieka (emoji złożone z kilku kodów zostają w całości). */
export function splitGraphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

export function isEmojiGrapheme(grapheme: string): boolean {
  return EMOJI_RE.test(grapheme);
}

/**
 * Nazwa pliku Twemoji dla emoji: kody szesnastkowe połączone myślnikiem. Selektor wariantu
 * U+FE0F usuwamy, chyba że emoji jest sekwencją ZWJ — tak samo nazywa pliki biblioteka Twemoji.
 */
export function twemojiCode(grapheme: string): string {
  const normalized = grapheme.includes(ZWJ) ? grapheme : grapheme.replace(VARIATION_SELECTOR_16, '');
  return Array.from(normalized, (ch) => (ch.codePointAt(0) ?? 0).toString(16)).join('-');
}

function loadTwemoji(code: string): Promise<Image | null> {
  let cached = imageCache.get(code);
  if (!cached) {
    cached = loadImage(`${TWEMOJI_BASE}/${code}.png`).catch((error: unknown) => {
      logger.warn(`[CANVAS-EMOJI] Nie udało się pobrać Twemoji ${code}: ${error}`);
      return null;
    });
    imageCache.set(code, cached);
  }
  return cached;
}

interface TextPart {
  text: string;
  image: Image | null;
  width: number;
}

/**
 * Dzieli tekst na fragmenty do narysowania. Bez letter-spacingu zwykły tekst idzie w ciągłych
 * kawałkach (zachowuje kerning fontu); z letter-spacingiem — znak po znaku. Emoji, którego nie
 * udało się pobrać, jest pomijane — lepiej go nie pokazać niż pokazać prostokąt z kodem.
 */
async function layoutParts(ctx: Ctx2D, graphemes: string[], emojiSize: number, perGrapheme: boolean): Promise<TextPart[]> {
  const parts: TextPart[] = [];
  let run = '';
  const flush = () => {
    if (!run) return;
    parts.push({ text: run, image: null, width: ctx.measureText(run).width });
    run = '';
  };

  for (const grapheme of graphemes) {
    if (isEmojiGrapheme(grapheme)) {
      flush();
      const image = await loadTwemoji(twemojiCode(grapheme));
      if (image) parts.push({ text: grapheme, image, width: emojiSize });
    } else if (perGrapheme) {
      parts.push({ text: grapheme, image: null, width: ctx.measureText(grapheme).width });
    } else {
      run += grapheme;
    }
  }
  flush();
  return parts;
}

function partsWidth(parts: TextPart[], letterSpacing: number): number {
  return parts.reduce((sum, p) => sum + p.width, 0) + letterSpacing * Math.max(0, parts.length - 1);
}

export interface EmojiTextOptions {
  fontSize: number;
  /** Ręczny odstęp między znakami (Cairo nie obsługuje CSS letter-spacing). Domyślnie 0. */
  letterSpacing?: number;
  align?: 'left' | 'right' | 'center';
  /** Gdy tekst jest szerszy, zostaje ucięty z „…" na końcu. */
  maxWidth?: number;
}

/**
 * Rysuje tekst z emoji jako obrazkami Twemoji. Zakłada textBaseline='alphabetic'.
 *
 * @returns szerokość narysowanego tekstu
 */
export async function fillTextWithEmoji(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  options: EmojiTextOptions
): Promise<number> {
  const { fontSize, letterSpacing = 0, align = 'left', maxWidth } = options;
  const emojiSize = Math.round(fontSize * EMOJI_SCALE);
  const perGrapheme = letterSpacing !== 0;

  const graphemes = splitGraphemes(text);
  let parts = await layoutParts(ctx, graphemes, emojiSize, perGrapheme);

  if (maxWidth !== undefined && partsWidth(parts, letterSpacing) > maxWidth) {
    const kept = [...graphemes];
    do {
      kept.pop();
      while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();
      parts = await layoutParts(ctx, [...kept, '…'], emojiSize, perGrapheme);
    } while (kept.length > 1 && partsWidth(parts, letterSpacing) > maxWidth);
  }

  const totalWidth = partsWidth(parts, letterSpacing);

  let cx = x;
  if (align === 'right') cx = x - totalWidth;
  else if (align === 'center') cx = x - totalWidth / 2;

  const savedAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const part of parts) {
    if (part.image) {
      // Dół obrazka lekko poniżej linii bazowej, jak u liter z ogonkami.
      ctx.drawImage(part.image, cx, y - emojiSize * 0.82, emojiSize, emojiSize);
    } else {
      ctx.fillText(part.text, cx, y);
    }
    cx += part.width + letterSpacing;
  }
  ctx.textAlign = savedAlign;

  return totalWidth;
}

/** Wariant z wymaganym letter-spacingiem (nagłówek grafiki statystyk miesięcznych). */
export function fillTextWithEmojiTracked(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  options: { fontSize: number; letterSpacing: number; align?: 'left' | 'right' | 'center' }
): Promise<number> {
  return fillTextWithEmoji(ctx, text, x, y, options);
}
