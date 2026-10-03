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

/**
 * Rysuje tekst z ręcznym odstępem między znakami (letter-spacing) i emoji jako obrazkami.
 * Zakłada textBaseline='alphabetic'. Emoji, którego nie udało się pobrać, jest pomijane —
 * lepiej go nie pokazać niż pokazać prostokąt z kodem.
 *
 * @returns szerokość narysowanego tekstu
 */
export async function fillTextWithEmojiTracked(
  ctx: Ctx2D,
  text: string,
  x: number,
  y: number,
  options: { fontSize: number; letterSpacing: number; align?: 'left' | 'right' | 'center' }
): Promise<number> {
  const { fontSize, letterSpacing, align = 'left' } = options;
  const emojiSize = Math.round(fontSize * EMOJI_SCALE);

  const parts = await Promise.all(
    splitGraphemes(text).map(async (grapheme) => {
      if (!isEmojiGrapheme(grapheme)) {
        return { grapheme, image: null, width: ctx.measureText(grapheme).width };
      }
      const image = await loadTwemoji(twemojiCode(grapheme));
      return { grapheme, image, width: image ? emojiSize : 0 };
    })
  );
  const visible = parts.filter((p) => p.width > 0);

  const totalWidth =
    visible.reduce((sum, p) => sum + p.width, 0) + letterSpacing * Math.max(0, visible.length - 1);

  let cx = x;
  if (align === 'right') cx = x - totalWidth;
  else if (align === 'center') cx = x - totalWidth / 2;

  const savedAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const part of visible) {
    if (part.image) {
      // Dół obrazka lekko poniżej linii bazowej, jak u liter z ogonkami.
      ctx.drawImage(part.image, cx, y - emojiSize * 0.82, emojiSize, emojiSize);
    } else {
      ctx.fillText(part.grapheme, cx, y);
    }
    cx += part.width + letterSpacing;
  }
  ctx.textAlign = savedAlign;

  return totalWidth;
}
