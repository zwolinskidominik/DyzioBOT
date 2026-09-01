/**
 * Migracja: przenosi stary, płaski kształt InviteTrackerConfig (jeden wspólny
 * `logChannelId` dla join+leave, pojedyncze pola `joinMessage`/`joinMessageUnknown`/
 * `joinMessageVanity`/`leaveMessage`) na nowy, zagnieżdżony kształt z osobnymi
 * sekcjami `join`/`leave` (własny kanał, własny przełącznik, słownik szablonów
 * per sytuacja: normal/selfInvite/unknown/vanity/botAdd dla join,
 * normal/unknown/vanity/botRemove dla leave) — patrz src/models/InviteTrackerConfig.ts
 * i src/services/inviteTrackerService.ts.
 *
 * getConfig() w inviteTrackerService.ts ma już defensywny fallback na stare pola,
 * więc bot działa poprawnie nawet bez tej migracji — ale usuwa ona zbędne stare
 * pola z bazy i sprawia, że każdy dokument ma jawny, kompletny nowy kształt.
 *
 * Użycie:
 *   npx tsx src/scripts/migrateInviteTrackerConfig.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/migrateInviteTrackerConfig.ts --apply     (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { InviteTrackerConfigModel } from '../models/InviteTrackerConfig';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  await mongoose.connect(uri);
  console.log('Połączono z bazą.');
  console.log(`Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`);

  const docs = await InviteTrackerConfigModel.find({}).lean();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyDocs = docs.filter((d: any) => d.joinMessage !== undefined || d.leaveMessage !== undefined || d.joinMessageUnknown !== undefined || d.joinMessageVanity !== undefined || !d.join || !d.leave);

  console.log(`\nDokumentów łącznie: ${docs.length}`);
  console.log(`Dokumentów do migracji (stare pola lub brak join/leave): ${legacyDocs.length}`);

  if (legacyDocs.length > 0) {
    console.log(`  guildId: ${legacyDocs.map((d) => d.guildId).join(', ')}`);
  }

  if (APPLY) {
    for (const d of legacyDocs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const legacy = d as any;
      await InviteTrackerConfigModel.updateOne(
        { _id: d._id },
        {
          $set: {
            join: {
              enabled: legacy.join?.enabled ?? true,
              logChannelId: legacy.join?.logChannelId ?? legacy.logChannelId ?? null,
              embed: legacy.join?.embed ?? false,
              messages: {
                normal: legacy.join?.messages?.normal || legacy.joinMessage || '',
                selfInvite: legacy.join?.messages?.selfInvite || '',
                unknown: legacy.join?.messages?.unknown || legacy.joinMessageUnknown || '',
                vanity: legacy.join?.messages?.vanity || legacy.joinMessageVanity || '',
                botAdd: legacy.join?.messages?.botAdd || '',
              },
            },
            leave: {
              enabled: legacy.leave?.enabled ?? true,
              logChannelId: legacy.leave?.logChannelId ?? legacy.logChannelId ?? null,
              embed: legacy.leave?.embed ?? false,
              messages: {
                normal: legacy.leave?.messages?.normal || legacy.leaveMessage || '',
                unknown: legacy.leave?.messages?.unknown || '',
                vanity: legacy.leave?.messages?.vanity || '',
                botRemove: legacy.leave?.messages?.botRemove || '',
              },
            },
          },
          $unset: {
            logChannelId: '',
            joinMessage: '',
            joinMessageUnknown: '',
            joinMessageVanity: '',
            leaveMessage: '',
          },
        },
      );
    }
    console.log(`\nZmigrowano ${legacyDocs.length} dokumentów.`);
  } else {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/migrateInviteTrackerConfig.ts --apply');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Błąd migracji:', error);
  process.exit(1);
});
