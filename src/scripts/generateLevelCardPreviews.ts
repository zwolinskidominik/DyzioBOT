/**
 * Generuje statyczne podglądy karty /level (po jednym PNG na każdy
 * preset koloru motywu, w wariancie z rangą i bez), żeby dashboard mógł
 * pokazywać gotową grafikę zamiast dogenerowywać przybliżony
 * CSS-owy mockup na żywo. Wynik trafia do
 * dashboard-nextjs/public/level-card-previews/.
 *
 * Uruchamiać ręcznie po zmianie CanvasRankCard lub listy presetów:
 *   npx tsx src/scripts/generateLevelCardPreviews.ts
 */
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { CanvasRankCard } from '../utils/canvasRankCard';

const THEME_PRESETS: { slug: string; color: string }[] = [
  { slug: 'lime', color: '#84cc16' },
  { slug: 'blue', color: '#3b82f6' },
  { slug: 'aqua', color: '#06b6d4' },
  { slug: 'mint', color: '#10b981' },
  { slug: 'violet', color: '#8b5cf6' },
  { slug: 'orange', color: '#f97316' },
];

const SAMPLE_AVATAR_PATH = path.resolve(__dirname, '..', '..', 'assets', 'default-avatar.png');
const OUTPUT_DIR = path.resolve(__dirname, '..', '..', 'dashboard-nextjs', 'public', 'level-card-previews');

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const preset of THEME_PRESETS) {
    for (const showRank of [true, false]) {
      const card = new CanvasRankCard({
        username: 'Podgląd',
        level: 12,
        currentXP: 285,
        requiredXP: 605,
        totalXP: 18260,
        rank: 3,
        avatarURL: SAMPLE_AVATAR_PATH,
        themeColor: preset.color,
        showRank,
      });

      const buffer = await card.build();
      const filename = showRank ? `${preset.slug}.png` : `${preset.slug}-norank.png`;
      fs.writeFileSync(path.join(OUTPUT_DIR, filename), buffer);
      console.log(`Wygenerowano ${filename}`);
    }
  }
}

main()
  .then(() => {
    console.log('Gotowe.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Błąd generowania podglądów:', err);
    process.exit(1);
  });
