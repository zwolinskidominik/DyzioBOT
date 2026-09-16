/**
 * Czyszczenie: usuwa nieprawidłowe `warnEntryId` z wpisów ModerationLog.
 *
 * Do czasu naprawy modelu (src/models/Warn.ts) podwpisy ostrzeżeń nie dostawały własnego `_id`,
 * więc `String(entry._id)` zwracało dla wszystkich ten sam string "undefined" i taka wartość
 * trafiała do logu moderacji. Skutek: `markWarnLogUndone()` filtruje po `warnEntryId` przez
 * `updateMany`, więc cofnięcie JEDNEGO ostrzeżenia oznaczało jako cofnięte WSZYSTKIE wpisy typu
 * "warn" na serwerze.
 *
 * Powiązania starych logów z konkretnymi ostrzeżeniami nie da się odtworzyć — ta informacja
 * nigdy nie została poprawnie zapisana. Dlatego skrypt tylko usuwa bezużyteczne pole: takie
 * wpisy przestają się masowo dopasowywać, a próba ich cofnięcia kończy się czytelnym
 * "nie znaleziono" zamiast zepsucia historii.
 *
 * Ostrzeżeń w kolekcji `warns` skrypt NIE rusza — wygasają samoczynnie (warnExpiryDays,
 * domyślnie 90 dni, sprząta je cleanExpiredWarns), a wszystkie nowe mają już poprawne `_id`.
 *
 * Użycie:
 *   npx tsx src/scripts/cleanOrphanedWarnEntryIds.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/cleanOrphanedWarnEntryIds.ts --apply    (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { ModerationLogModel } from '../models/ModerationLog';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  await mongoose.connect(uri);
  console.log('Połączono z bazą.');
  console.log(`Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`);

  const candidates = await ModerationLogModel.find({ warnEntryId: { $exists: true, $ne: null } })
    .select('guildId targetId targetTag warnEntryId createdAt')
    .lean();

  // Nieprawidłowe = wszystko, co nie jest poprawnym ObjectId (w praktyce literalne "undefined").
  const orphaned = candidates.filter((doc) => !Types.ObjectId.isValid(String(doc.warnEntryId)));

  console.log(`\nWpisów z ustawionym warnEntryId: ${candidates.length}`);
  console.log(`Z nieprawidłowym identyfikatorem: ${orphaned.length}`);

  if (orphaned.length === 0) {
    console.log('\nNie ma czego czyścić.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const perGuild = new Map<string, number>();
  for (const doc of orphaned) {
    perGuild.set(doc.guildId, (perGuild.get(doc.guildId) ?? 0) + 1);
  }
  console.log('\nRozkład per serwer:');
  for (const [guildId, count] of perGuild) {
    console.log(`  ${guildId}: ${count}`);
  }

  const sample = orphaned.slice(0, 5);
  console.log('\nPrzykładowe wpisy:');
  for (const doc of sample) {
    console.log(`  guild=${doc.guildId} user=${doc.targetTag} (${doc.targetId}) warnEntryId=${JSON.stringify(doc.warnEntryId)}`);
  }

  if (APPLY) {
    const result = await ModerationLogModel.updateMany(
      { _id: { $in: orphaned.map((doc) => doc._id) } },
      { $unset: { warnEntryId: '' } },
    );
    console.log(`\nWyczyszczono warnEntryId w ${result.modifiedCount} wpisach.`);
  } else {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/cleanOrphanedWarnEntryIds.ts --apply');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Błąd czyszczenia:', error);
  process.exit(1);
});
