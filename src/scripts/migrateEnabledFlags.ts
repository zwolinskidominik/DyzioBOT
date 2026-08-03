/**
 * Migracja: przywraca `enabled: true` dla gildii, które faktycznie skonfigurowały
 * dany moduł (mają ustawiony kluczowy kanał/kategorię), ale flaga `enabled`
 * jest `false` lub jej brak.
 *
 * Kontekst: przed poprawkami z tej sesji bot NIE sprawdzał flagi `enabled` przy
 * wykonywaniu akcji (sugestie, greetings, tickety, QOTD, twitch, leveling, logi).
 * Flaga w bazie mogła więc zostać na domyślnym `false` mimo że moduł realnie
 * działał (bo admin skonfigurował kanał, ale nigdy nie kliknął przełącznika,
 * który wcześniej i tak nic nie robił). Configi są też auto-tworzone dla KAŻDEJ
 * gildii przy dołączeniu bota (initializeGuildConfigs.ts) z enabled:false — więc
 * samo istnienie dokumentu NIC nie mówi o tym, czy moduł był używany. Dlatego
 * migracja patrzy na konkretne pole wskazujące realną konfigurację, a dla
 * Levelingu/Logów dodatkowo na dane potwierdzające realne użycie.
 *
 * Użycie:
 *   npx tsx src/scripts/migrateEnabledFlags.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/migrateEnabledFlags.ts --apply     (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { SuggestionConfigurationModel } from '../models/SuggestionConfiguration';
import { GreetingsConfigurationModel } from '../models/GreetingsConfiguration';
import { TicketConfigModel } from '../models/TicketConfig';
import { QuestionConfigurationModel } from '../models/QuestionConfiguration';
import { StreamConfigurationModel } from '../models/StreamConfiguration';
import { LevelConfigModel } from '../models/LevelConfig';
import { LevelModel } from '../models/Level';
import { LogConfigurationModel } from '../models/LogConfiguration';

const APPLY = process.argv.includes('--apply');

interface ModuleReport {
  module: string;
  checked: number;
  toUpdate: string[];
}

function printReport(report: ModuleReport): void {
  console.log(`\n${report.module}`);
  console.log(`  Dokumentów z enabled != true: ${report.checked}`);
  console.log(`  Kwalifikuje się do włączenia: ${report.toUpdate.length}`);
  if (report.toUpdate.length > 0) {
    console.log(`  guildId: ${report.toUpdate.join(', ')}`);
  }
}

/** Moduły, gdzie sygnałem "realnie skonfigurowane" jest niepusty kanał/kategoria. */
async function migrateSuggestions(): Promise<ModuleReport> {
  const docs = await SuggestionConfigurationModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate = docs.filter((d) => typeof d.suggestionChannelId === 'string' && d.suggestionChannelId.trim() !== '');

  if (APPLY && toUpdate.length > 0) {
    await SuggestionConfigurationModel.updateMany(
      { _id: { $in: toUpdate.map((d) => d._id) } },
      { $set: { enabled: true } }
    );
  }

  return { module: 'Sugestie', checked: docs.length, toUpdate: toUpdate.map((d) => d.guildId) };
}

async function migrateGreetings(): Promise<ModuleReport> {
  const docs = await GreetingsConfigurationModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate = docs.filter((d) => typeof d.greetingsChannelId === 'string' && d.greetingsChannelId.trim() !== '');

  if (APPLY && toUpdate.length > 0) {
    await GreetingsConfigurationModel.updateMany(
      { _id: { $in: toUpdate.map((d) => d._id) } },
      { $set: { enabled: true } }
    );
  }

  return { module: 'Greetings', checked: docs.length, toUpdate: toUpdate.map((d) => d.guildId) };
}

async function migrateTickets(): Promise<ModuleReport> {
  const docs = await TicketConfigModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate = docs.filter((d) => typeof d.categoryId === 'string' && d.categoryId.trim() !== '');

  if (APPLY && toUpdate.length > 0) {
    await TicketConfigModel.updateMany(
      { _id: { $in: toUpdate.map((d) => d._id) } },
      { $set: { enabled: true } }
    );
  }

  return { module: 'Tickety', checked: docs.length, toUpdate: toUpdate.map((d) => d.guildId) };
}

async function migrateQotd(): Promise<ModuleReport> {
  const docs = await QuestionConfigurationModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate = docs.filter((d) => typeof d.questionChannelId === 'string' && d.questionChannelId.trim() !== '');

  if (APPLY && toUpdate.length > 0) {
    await QuestionConfigurationModel.updateMany(
      { _id: { $in: toUpdate.map((d) => d._id) } },
      { $set: { enabled: true } }
    );
  }

  return { module: 'QOTD', checked: docs.length, toUpdate: toUpdate.map((d) => d.guildId) };
}

async function migrateTwitch(): Promise<ModuleReport> {
  const docs = await StreamConfigurationModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate = docs.filter((d) => typeof d.channelId === 'string' && d.channelId.trim() !== '');

  if (APPLY && toUpdate.length > 0) {
    await StreamConfigurationModel.updateMany(
      { _id: { $in: toUpdate.map((d) => d._id) } },
      { $set: { enabled: true } }
    );
  }

  return { module: 'Twitch', checked: docs.length, toUpdate: toUpdate.map((d) => d.guildId) };
}

/** Leveling nie ma pola-kanału — sygnałem realnego użycia są istniejące rekordy XP. */
async function migrateLeveling(): Promise<ModuleReport> {
  const docs = await LevelConfigModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate: string[] = [];

  for (const doc of docs) {
    const hasXpRecords = await LevelModel.exists({ guildId: doc.guildId });
    if (hasXpRecords) {
      toUpdate.push(doc.guildId);
    }
  }

  if (APPLY && toUpdate.length > 0) {
    await LevelConfigModel.updateMany({ guildId: { $in: toUpdate } }, { $set: { enabled: true } });
  }

  return { module: 'Leveling', checked: docs.length, toUpdate };
}

/** Logi nie mają pola-kanału — sygnałem realnego użycia jest niepusta mapa logChannels. */
async function migrateLogs(): Promise<ModuleReport> {
  const docs = await LogConfigurationModel.find({ enabled: { $ne: true } }).lean();
  const toUpdate = docs.filter((d) => d.logChannels && Object.keys(d.logChannels).length > 0);

  if (APPLY && toUpdate.length > 0) {
    await LogConfigurationModel.updateMany(
      { _id: { $in: toUpdate.map((d) => d._id) } },
      { $set: { enabled: true } }
    );
  }

  return { module: 'Logi', checked: docs.length, toUpdate: toUpdate.map((d) => d.guildId) };
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  await mongoose.connect(uri);
  console.log(`Połączono z bazą.`);
  console.log(`Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`);

  const reports = [
    await migrateSuggestions(),
    await migrateGreetings(),
    await migrateTickets(),
    await migrateQotd(),
    await migrateTwitch(),
    await migrateLeveling(),
    await migrateLogs(),
  ];

  console.log('\n=== Podsumowanie ===');
  reports.forEach(printReport);

  if (!APPLY) {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/migrateEnabledFlags.ts --apply');
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
