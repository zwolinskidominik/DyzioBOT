/**
 * Uzupełnienie: dopisuje brakujące `_id` istniejącym ostrzeżeniom w kolekcji `warns`.
 *
 * Do czasu naprawy modelu (src/models/Warn.ts) jawna deklaracja `_id` bez `default` wyłączała
 * automatyczne nadawanie identyfikatora przez Mongoose, więc podwpisy zapisywały się bez niego.
 * Skutek widoczny w panelu: agregacja w `api/guild/[guildId]/moderation/warned` rzutuje
 * `warnEntryId: '$warnings._id'`, więc dla takich wpisów przychodzi `undefined`, walidacja
 * `z.string().min(1)` odrzuca żądanie i krzyżyk przy ostrzeżeniu nie działa.
 *
 * Nowe ostrzeżenia mają już poprawne `_id` — ten skrypt jest wyłącznie dla tych sprzed naprawy.
 * Dopisuje TYLKO brakujące identyfikatory: treść, data, moderator i kolejność wpisów zostają
 * nietknięte. Zapis idzie przez sterownik (nie przez Mongoose), żeby nie ruszyć niczego poza
 * tablicą `warnings`.
 *
 * Użycie:
 *   npx tsx src/scripts/backfillWarnEntryIds.ts            (dry-run — tylko podgląd)
 *   npx tsx src/scripts/backfillWarnEntryIds.ts --apply    (faktyczny zapis)
 */

import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import { WarnModel } from '../models/Warn';

const APPLY = process.argv.includes('--apply');

interface RawWarnEntry {
  _id?: Types.ObjectId;
  reason?: string;
  date?: Date;
  moderatorId?: string;
  moderatorTag?: string;
}

interface RawWarnDoc {
  _id: Types.ObjectId;
  guildId: string;
  userId: string;
  warnings?: RawWarnEntry[];
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Brak MONGODB_URI w .env');
  }

  await mongoose.connect(uri);
  console.log('Połączono z bazą.');
  console.log(`Tryb: ${APPLY ? 'APPLY — zmiany zostaną zapisane' : 'DRY-RUN — tylko podgląd, nic nie zostanie zapisane'}`);

  // Czytamy przez sterownik, żeby zobaczyć realny kształt dokumentów — hydratacja Mongoose
  // mogłaby dorobić `_id` w pamięci i zamaskować problem.
  const collection = WarnModel.collection;
  const docs = (await collection.find({}).toArray()) as unknown as RawWarnDoc[];

  let entriesTotal = 0;
  let entriesMissing = 0;
  const perGuild = new Map<string, number>();
  const toFix: { doc: RawWarnDoc; warnings: RawWarnEntry[]; missing: number }[] = [];

  for (const doc of docs) {
    const warnings = doc.warnings ?? [];
    entriesTotal += warnings.length;

    const missing = warnings.filter((entry) => !entry._id).length;
    if (missing === 0) continue;

    entriesMissing += missing;
    perGuild.set(doc.guildId, (perGuild.get(doc.guildId) ?? 0) + missing);

    const patched = warnings.map((entry) => (entry._id ? entry : { ...entry, _id: new Types.ObjectId() }));
    toFix.push({ doc, warnings: patched, missing });
  }

  console.log(`\nDokumentów w kolekcji warns: ${docs.length}`);
  console.log(`Ostrzeżeń łącznie: ${entriesTotal}`);
  console.log(`Bez własnego _id: ${entriesMissing} (w ${toFix.length} dokumentach)`);

  if (entriesMissing === 0) {
    console.log('\nWszystkie ostrzeżenia mają już poprawne identyfikatory — nie ma czego uzupełniać.');
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log('\nRozkład per serwer:');
  for (const [guildId, count] of perGuild) {
    console.log(`  ${guildId}: ${count}`);
  }

  console.log('\nPrzykładowe wpisy do uzupełnienia:');
  for (const { doc, missing } of toFix.slice(0, 5)) {
    console.log(`  guild=${doc.guildId} user=${doc.userId} — brakuje ${missing} z ${doc.warnings?.length ?? 0}`);
  }

  if (APPLY) {
    let updated = 0;
    let skipped = 0;

    for (const { doc, warnings } of toFix) {
      // Zapis podmienia całą tablicę, więc warunek `$size` pilnuje, że nikt (np. bot nadający
      // ostrzeżenie w tej samej chwili) nie zmienił jej między odczytem a zapisem — inaczej
      // taki świeży wpis zostałby po cichu skasowany.
      const result = await collection.updateOne(
        { _id: doc._id, warnings: { $size: warnings.length } },
        { $set: { warnings } },
      );

      if (result.matchedCount === 0) {
        skipped += 1;
        console.warn(`  POMINIĘTO guild=${doc.guildId} user=${doc.userId} — lista zmieniła się w trakcie, uruchom skrypt ponownie.`);
        continue;
      }
      updated += result.modifiedCount;
    }

    console.log(`\nUzupełniono identyfikatory w ${updated} dokumentach (${entriesMissing} ostrzeżeń).`);
    if (skipped > 0) {
      console.log(`Pominięto ${skipped} dokumentów zmienionych w trakcie działania — po prostu uruchom skrypt jeszcze raz.`);
    }
    console.log('Krzyżyk przy tych ostrzeżeniach w panelu powinien już działać.');
  } else {
    console.log('\nTo był dry-run — żadne dane nie zostały zmienione.');
    console.log('Żeby faktycznie zapisać zmiany, uruchom:');
    console.log('  npx tsx src/scripts/backfillWarnEntryIds.ts --apply');
  }

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error('Błąd uzupełniania:', error);
  process.exit(1);
});
