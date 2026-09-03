import emojiData from "@/data/emoji-data.json";

interface UnicodeEmojiEntry {
  u: string;
  h: string;
}

// Jedno źródło prawdy dla "glif unicode → nazwa pliku Twemoji", zbudowane z
// tego samego src/data/emoji-data.json, którego używa EmojiPicker. Odtąd
// EmojiDisplay nie zgaduje nazwy pliku samodzielnie (ręczne wycinanie FE0F nie
// zawsze zgadzało się z realną nazwą assetu, np. dla flagi białej: "1f3f3-fe0f"
// a nie "1f3f3").
const GLYPH_TO_CODE: Map<string, string> = (() => {
  const map = new Map<string, string>();
  const categories = emojiData.emojis as Record<string, UnicodeEmojiEntry[]>;
  for (const key of Object.keys(categories)) {
    for (const emoji of categories[key]) {
      map.set(emoji.u, emoji.h);
    }
  }
  return map;
})();

/**
 * Lokalna (self-hosted, zgodna z CSP img-src 'self') ścieżka do SVG Twemoji
 * dla znanego glifu unicode emoji. `null`, jeśli glif nie występuje w naszym
 * datasetcie (np. wklejony ręcznie spoza EmojiPicker) — wtedy wołający
 * powinien pokazać fallback (natywny glif tekstowy).
 *
 * Pliki generowane skryptem `npm run emoji:assets` (scripts/download-twemoji-assets.mjs)
 * do public/twemoji/svg/ — CSP celowo nie zezwala na ładowanie obrazków z
 * zewnętrznych CDN (jsDelivr itp.), więc assety muszą być serwowane z 'self'.
 */
export function twemojiAssetPath(glyph: string): string | null {
  const code = GLYPH_TO_CODE.get(glyph);
  return code ? `/twemoji/svg/${code}.svg` : null;
}
