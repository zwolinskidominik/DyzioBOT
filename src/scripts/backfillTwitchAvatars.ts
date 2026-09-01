/**
 * Jednorazowy backfill: pobiera avatarUrl z Twitcha dla streamerów już zapisanych
 * w bazie (dodanych przed wprowadzeniem automatycznego zapisu avatara przy dodawaniu),
 * żeby dashboard mógł od razu pokazać ich prawdziwe zdjęcia profilowe zamiast
 * kolorowych placeholderów. Nie zużywa dodatkowego budżetu rate-limitu ponad to,
 * co i tak trzeba pobrać z Twitcha (walidacja użytkownika = jedno zapytanie
 * zwracające też profile_image_url).
 *
 * Użycie:
 *   npx tsx src/scripts/backfillTwitchAvatars.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/backfillTwitchAvatars.ts --apply     (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { TwitchStreamerModel } from '../models/TwitchStreamer';
import { getTwitchClient, validateTwitchUser } from '../utils/twitchApi';

const APPLY = process.argv.includes('--apply');

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  if (!getTwitchClient()) {
    throw new Error(
      'Brak TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET w .env — Twitch API niedostępne, nie da się pobrać avatarów.'
    );
  }

  await mongoose.connect(uri);
  console.log('Połączono z bazą.');
  console.log(
    `Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`
  );

  // mongoose.trusted(): sanitizeFilter (index.ts) sanityzuje operatory nawet
  // wewnątrz $or — bez tego rzuca CastError na $exists.
  const docs = await TwitchStreamerModel.find({
    $or: [{ avatarUrl: mongoose.trusted({ $exists: false }) }, { avatarUrl: null }, { avatarUrl: '' }],
  }).lean();

  console.log(`Streamerów bez zapisanego avatara: ${docs.length}`);

  let updated = 0;
  let notFound = 0;
  let failed = 0;

  for (const doc of docs) {
    try {
      const twitchUser = await validateTwitchUser(doc.twitchChannel);
      if (!twitchUser) {
        console.log(`  ⚠ ${doc.guildId} / ${doc.twitchChannel} — nie znaleziono na Twitchu`);
        notFound++;
        continue;
      }

      console.log(`  ✓ ${doc.guildId} / ${doc.twitchChannel} → ${twitchUser.profilePictureUrl}`);

      if (APPLY) {
        await TwitchStreamerModel.updateOne(
          { _id: doc._id },
          { $set: { avatarUrl: twitchUser.profilePictureUrl } }
        );
      }
      updated++;
    } catch (error) {
      console.error(`  ✗ Błąd dla ${doc.twitchChannel}: ${error instanceof Error ? error.message : error}`);
      failed++;
    }
  }

  console.log('\n=== Podsumowanie ===');
  console.log(`Do zaktualizowania: ${updated}`);
  console.log(`Nie znaleziono na Twitchu: ${notFound}`);
  console.log(`Błędów: ${failed}`);

  if (!APPLY) {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/backfillTwitchAvatars.ts --apply');
  } else {
    console.log('\nZmiany zostały zapisane.');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Błąd backfillu:', error);
  process.exit(1);
});
