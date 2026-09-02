// Generates a compact, Discord-style emoji dataset from emojibase-data.
// Run with: node scripts/generate-emoji-data.mjs
// Output: src/data/emoji-data.json (committed, used at runtime — emojibase-data is dev-only).

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const data = require("emojibase-data/en/data.json");
const emojibaseShortcodes = require("emojibase-data/en/shortcodes/emojibase.json");
const iamcalShortcodes = require("emojibase-data/en/shortcodes/iamcal.json");

// Discord category order + Polish labels + sidebar icon.
// Discord merges smileys-emotion (0) + people-body (1) into one category.
const CATEGORIES = [
  { key: "people", label: "Buźki i osoby", icon: "😀", groups: [0, 1] },
  { key: "nature", label: "Zwierzęta i natura", icon: "🐻", groups: [3] },
  { key: "food", label: "Żywność i napoje", icon: "🍔", groups: [4] },
  { key: "activities", label: "Aktywność", icon: "⚽", groups: [6] },
  { key: "travel", label: "Podróże i miejsca", icon: "🚗", groups: [5] },
  { key: "objects", label: "Rzeczy", icon: "💡", groups: [7] },
  { key: "symbols", label: "Symbole", icon: "❤️", groups: [8] },
  { key: "flags", label: "Flagi", icon: "🚩", groups: [9] },
];

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Discord's own client uses a handful of shortcodes that differ from the
// emojibase/iamcal names (e.g. Discord says :hugs:, emojibase says :hug:).
// Keyed by the emoji glyph so it survives regeneration regardless of hexcode
// formatting. Prepended to the shortcode list so it becomes the primary code.
const DISCORD_ALIASES = {
  "🙂": "slight_smile",
  "🙃": "upside_down",
  "🤑": "money_mouth",
  "🤗": "hugs",
  "🛰️": "artificial_satellite",
  "⚖️": "balance_scale",
  "📸": "camera_flash",
  "❣️": "heavy_heart_exclamation",
  "🏒": "ice_hockey",
  "🛴": "kick_scooter",
  "🗾": "map_of_japan",
  "🎖️": "medal_military",
  "🥛": "milk_glass",
  "🗞️": "newspaper_roll",
  "⏭️": "next_track_button",
  "⏯️": "play_or_pause_button",
  "⏮️": "previous_track_button",
  "🛍️": "shopping",
};

function shortcodesFor(hexcode, emoji) {
  const merged = [
    DISCORD_ALIASES[emoji],
    ...toArray(emojibaseShortcodes[hexcode]),
    ...toArray(iamcalShortcodes[hexcode]),
  ];
  const seen = new Set();
  const result = [];
  for (const code of merged) {
    if (!code || seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

const groupToCategory = new Map();
for (const category of CATEGORIES) {
  for (const group of category.groups) groupToCategory.set(group, category.key);
}

const emojis = {};
for (const category of CATEGORIES) emojis[category.key] = [];

const sorted = [...data].sort((a, b) => a.order - b.order);
for (const item of sorted) {
  const categoryKey = groupToCategory.get(item.group);
  if (!categoryKey) continue; // skip group 2 (component / skin tones)
  if (!item.emoji) continue;

  emojis[categoryKey].push({
    u: item.emoji,
    n: item.label,
    // Twemoji asset key (matches emojibase's hexcode 1:1) — used to render the
    // emoji as an image instead of relying on the OS's native emoji font,
    // which is what Discord itself does. Native rendering is inconsistent
    // across platforms — Windows in particular renders flag emoji (regional
    // indicator symbol pairs) as plain two-letter text instead of a flag.
    h: item.hexcode.toLowerCase(),
    s: shortcodesFor(item.hexcode, item.emoji),
    t: item.tags ?? [],
  });
}

const output = {
  categories: CATEGORIES.map(({ key, label, icon }) => ({ key, label, icon })),
  emojis,
};

const outDir = join(__dirname, "..", "src", "data");
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, "emoji-data.json");
writeFileSync(outPath, JSON.stringify(output));

const total = Object.values(emojis).reduce((sum, list) => sum + list.length, 0);
console.log(`Wrote ${total} emojis across ${CATEGORIES.length} categories to ${outPath}`);
