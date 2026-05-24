/**
 * Skrypt migracyjny: zastępuje serwerowe custom emoji w reakcjach pytań QOTD
 * emoji aplikacji bota (Discord Developer Portal).
 *
 * Uruchomienie:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrateQotdEmojis.ts
 *
 * Flagi:
 *   --dry-run   Tylko wypisz co by zostało zmienione, nie zapisuj do bazy
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { QuestionModel } from '../models/Question';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

// ── typy ────────────────────────────────────────────────────────────────────

interface AppEmoji {
  id: string;
  name: string;
  animated: boolean;
}

// ── name aliases ─────────────────────────────────────────────────────────────
// Mapowanie: stara nazwa emoji z serwera → nowa nazwa w emoji aplikacji

const NAME_ALIASES: Record<string, string> = {
  xemoji00_yes: 'checkmark2',
  xemoji01_no: 'crossmark2',
  cat01_yes: 'cat_yes',
  cat02_no: 'cat_no',
  xemoji21_aliendance: 'alien_dance',
};

// ── helpers ──────────────────────────────────────────────────────────────────

const CUSTOM_RE = /^<(a)?:([^:]+):(\d+)>$/;

function parseEmoji(s: string): { animated: boolean; name: string; id: string } | null {
  const m = s.match(CUSTOM_RE);
  if (!m) return null;
  return { animated: !!m[1], name: m[2], id: m[3] };
}

function formatEmoji(e: AppEmoji): string {
  return e.animated ? `<a:${e.name}:${e.id}>` : `<:${e.name}:${e.id}>`;
}

// ── Discord API ───────────────────────────────────────────────────────────────

async function fetchAppEmojis(): Promise<AppEmoji[]> {
  const appId = process.env.CLIENT_ID;
  const token = process.env.TOKEN;
  if (!appId || !token) throw new Error('Brak CLIENT_ID lub TOKEN w .env');

  const res = await fetch(`https://discord.com/api/v10/applications/${appId}/emojis`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) throw new Error(`Discord API ${res.status}: ${await res.text()}`);
  const data = await res.json() as { items: AppEmoji[] };
  return data.items ?? [];
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Brak MONGODB_URI w .env');

  console.log('🔌 Łączenie z MongoDB…');
  await mongoose.connect(mongoUri);

  console.log('📡 Pobieranie emoji aplikacji z Discord…');
  const appEmojis = await fetchAppEmojis();

  if (appEmojis.length === 0) {
    console.warn('⚠️  Bot nie ma żadnych emoji aplikacji. Migracja niemożliwa.');
    process.exit(0);
  }

  // Indeks: name → AppEmoji (lowercase dla fuzzy match)
  const byName = new Map<string, AppEmoji>();
  for (const e of appEmojis) byName.set(e.name.toLowerCase(), e);

  const appEmojiIds = new Set(appEmojis.map((e) => e.id));

  console.log(`✅ Znaleziono ${appEmojis.length} emoji aplikacji:`);
  for (const e of appEmojis) console.log(`   ${formatEmoji(e)}  (animated: ${e.animated})`);
  console.log();

  if (DRY_RUN) console.log('🔍 TRYB DRY-RUN — baza nie zostanie zmodyfikowana\n');

  // Pobierz wszystkie pytania z reakcjami zawierającymi custom emoji
  const questions = await QuestionModel.find({
    reactions: { $elemMatch: { $regex: '^<a?:' } },
  });

  console.log(`📋 Znaleziono ${questions.length} pytań z custom emoji reakcjami.\n`);

  let updatedCount = 0;
  let skippedCount = 0;
  const unmappable: { questionId: string; emoji: string }[] = [];

  for (const q of questions) {
    const newReactions: string[] = [];
    let changed = false;

    for (const reaction of q.reactions) {
      const parsed = parseEmoji(reaction);

      if (!parsed) {
        // unicode emoji — bez zmian
        newReactions.push(reaction);
        continue;
      }

      if (appEmojiIds.has(parsed.id)) {
        // już jest emoji aplikacji — bez zmian
        newReactions.push(reaction);
        continue;
      }

      // Szukamy odpowiednika w emoji aplikacji po nazwie (z aliasami)
      const lookupName = NAME_ALIASES[parsed.name.toLowerCase()] ?? parsed.name.toLowerCase();
      const match = byName.get(lookupName);

      if (match) {
        const newFmt = formatEmoji(match);
        console.log(`  [${q.questionId}] ${reaction}  →  ${newFmt}`);
        newReactions.push(newFmt);
        changed = true;
      } else {
        console.warn(`  [${q.questionId}] ❌ Brak odpowiednika dla: ${reaction} (name: ${parsed.name})`);
        newReactions.push(reaction); // zostaw stare
        unmappable.push({ questionId: q.questionId, emoji: reaction });
        skippedCount++;
      }
    }

    if (changed) {
      if (!DRY_RUN) {
        await QuestionModel.updateOne(
          { questionId: q.questionId },
          { $set: { reactions: newReactions } }
        );
      }
      updatedCount++;
    }
  }

  console.log('\n── Podsumowanie ───────────────────────────────────────────');
  console.log(`✅ Zaktualizowano pytań: ${DRY_RUN ? `${updatedCount} (dry-run)` : updatedCount}`);
  console.log(`⏭️  Bez odpowiednika (niezmienione): ${skippedCount}`);

  if (unmappable.length > 0) {
    console.log('\n⚠️  Poniższe emoji nie mają odpowiednika w emoji aplikacji:');
    for (const u of unmappable) console.log(`   questionId=${u.questionId}  emoji=${u.emoji}`);
    console.log('\n   Dodaj te emoji do aplikacji w Discord Developer Portal');
    console.log('   (https://discord.com/developers/applications) i uruchom skrypt ponownie.');
  }

  await mongoose.disconnect().catch(() => undefined);
  console.log('\n🔌 Rozłączono z MongoDB.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Błąd:', err);
  process.exit(1);
});
