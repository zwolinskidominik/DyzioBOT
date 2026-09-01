/**
 * Migracja: naprawia moduł Pytania Dnia (QOTD), który dotąd traktował pytania
 * jako "użyte" GLOBALNIE (Question.disabled=true), przez co jedno pytanie
 * wysłane na dowolnym serwerze znikało z puli dla WSZYSTKICH serwerów na
 * zawsze. Po tej migracji: pula pytań (Question) pozostaje wspólna — dodaje
 * ją właściciel bota dla wszystkich — ale każdy serwer śledzi swoje własne
 * użycie osobno przez UsedQuestion (guildId + questionId), więc pytania nie
 * powtarzają się na TYM SAMYM serwerze, dopóki nie przejdzie całej wspólnej
 * puli (patrz questionService.ts).
 *
 * Migracja resetuje `disabled: false` na WSZYSTKICH pytaniach, żeby wróciły
 * do wspólnej puli — dostępność per-guild jest odtąd liczona wyłącznie na
 * podstawie UsedQuestion, które i tak było już poprawnie zapisywane per-guild
 * przez schedulera, więc żadna historia użycia się nie traci.
 *
 * Użycie:
 *   npx tsx src/scripts/migrateQotdGlobalPool.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/migrateQotdGlobalPool.ts --apply     (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { QuestionModel } from '../models/Question';
import { UsedQuestionModel } from '../models/UsedQuestion';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  await mongoose.connect(uri);
  console.log('Połączono z bazą.');
  console.log(`Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`);

  const totalQuestions = await QuestionModel.countDocuments({});
  const legacyDisabled = await QuestionModel.countDocuments({ disabled: true });
  const usedQuestionRecords = await UsedQuestionModel.countDocuments({});
  const guildsWithHistory = (await UsedQuestionModel.distinct('guildId')).length;

  console.log('\n=== Stan przed migracją ===');
  console.log(`  Pytań w puli łącznie: ${totalQuestions}`);
  console.log(`  Pytań globalnie wyłączonych (stare "użyte"): ${legacyDisabled}`);
  console.log(`  Zapisanych użyć per-guild (UsedQuestion): ${usedQuestionRecords}`);
  console.log(`  Serwerów z historią użycia: ${guildsWithHistory}`);

  if (APPLY && legacyDisabled > 0) {
    await QuestionModel.updateMany({ disabled: true }, { $set: { disabled: false } });
    console.log(`\nOdblokowano ${legacyDisabled} pytań — wracają do wspólnej puli dla wszystkich serwerów.`);
    console.log('Historia UsedQuestion pozostaje nietknięta, więc serwer, który już wysłał dane pytanie, i tak go nie dostanie ponownie, dopóki nie przejdzie całej puli.');
  }

  if (!APPLY) {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/migrateQotdGlobalPool.ts --apply');
  } else {
    console.log('\nZmiany zostały zapisane.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Błąd migracji:', error);
  process.exit(1);
});
