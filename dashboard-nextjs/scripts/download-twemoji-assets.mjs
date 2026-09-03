// Pobiera pliki SVG Twemoji dla wszystkich emoji z src/data/emoji-data.json do
// public/twemoji/svg/ — żeby EmojiPicker i EmojiDisplay mogły serwować je z
// 'self', zgodnie z CSP img-src (który celowo NIE zawiera cdn.jsdelivr.net,
// patrz next.config.ts). Idempotentny — pomija już pobrane pliki, więc można
// bezpiecznie odpalać ponownie po dodaniu nowych emoji do datasetu.
//
// Uruchom: npm run emoji:assets
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const emojiData = require("../src/data/emoji-data.json");

// Ten sam pakiet (github.com/discord/twemoji), którego dotąd używał EmojiDisplay
// przez jsDelivr — tylko teraz pobierany raz i serwowany lokalnie.
const SOURCE_BASE = "https://cdn.jsdelivr.net/npm/@discordapp/twemoji@16.0.1/dist/svg";
const outDir = join(__dirname, "..", "public", "twemoji", "svg");
mkdirSync(outDir, { recursive: true });

const codes = new Set();
for (const category of Object.keys(emojiData.emojis)) {
  for (const emoji of emojiData.emojis[category]) {
    codes.add(emoji.h);
  }
}

const list = [...codes];
const CONCURRENCY = 8;
let done = 0;
let skipped = 0;
const failed = [];

async function fetchSvg(remoteCode) {
  const res = await fetch(`${SOURCE_BASE}/${remoteCode}.svg`);
  if (!res.ok) return null;
  return res.text();
}

async function downloadOne(code) {
  const outPath = join(outDir, `${code}.svg`);
  if (existsSync(outPath)) {
    skipped++;
    return;
  }
  try {
    let text = await fetchSvg(code);
    // @discordapp/twemoji nie zawsze trzyma plik z selektorem wariantu FE0F
    // w nazwie, mimo że nasz dataset (z emojibase) go tam wstawia — np. jest
    // "263a.svg", nie ma "263a-fe0f.svg". Zapisujemy pod ORYGINALNĄ nazwą
    // (h z emoji-data.json), żeby lookup w aplikacji się zgadzał niezależnie
    // od tego, z którego adresu realnie pobraliśmy plik.
    if (text === null && code.includes("-fe0f")) {
      const stripped = code.split("-").filter((part) => part !== "fe0f").join("-");
      if (stripped && stripped !== code) {
        text = await fetchSvg(stripped);
      }
    }
    if (text === null) throw new Error("HTTP 404 (also tried without -fe0f)");
    writeFileSync(outPath, text);
    done++;
  } catch (err) {
    failed.push({ code, error: err instanceof Error ? err.message : String(err) });
  }
}

async function run() {
  console.log(`Pobieram ${list.length} plików SVG (Twemoji) do ${outDir}...`);
  let i = 0;
  async function worker() {
    while (i < list.length) {
      const code = list[i++];
      await downloadOne(code);
      const total = done + skipped + failed.length;
      if (total % 100 === 0 || total === list.length) {
        process.stdout.write(`\r${total}/${list.length} (nowe: ${done}, pominięte: ${skipped}, błędy: ${failed.length})`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n\nGotowe. Nowo pobrane: ${done}, pominięte (już istniały): ${skipped}, błędy: ${failed.length}.`);
  if (failed.length > 0) {
    console.log("Nie udało się pobrać:");
    for (const f of failed.slice(0, 30)) console.log(`  ${f.code}.svg — ${f.error}`);
    if (failed.length > 30) console.log(`  ...i ${failed.length - 30} więcej.`);
    process.exitCode = 1;
  }
}

run();
