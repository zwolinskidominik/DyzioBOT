/**
 * Imports Wordle words from JSON files into MongoDB.
 *
 * Reads wordle-words-{5,6,7}.json from the project root and upserts each entry
 * into the `wordlewords` collection (skipping duplicates via the unique index).
 *
 * Run:  npx tsx src/scripts/importWordleWords.ts
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { WordleWordModel } from '../models/WordleWord';
import { env } from '../config';

const { MONGODB_URI } = env();

const TARGET_LENGTHS = [5, 6, 7] as const;

function loadWordsForLength(length: number): string[] {
  const filePath = path.resolve(`wordle-words-${length}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Brak pliku: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Plik ${filePath} nie zawiera tablicy`);
  }
  return parsed.filter((w): w is string => typeof w === 'string' && w.length === length);
}

async function importWordleWords(): Promise<void> {
  let connection: typeof mongoose | null = null;
  try {
    connection = await mongoose.connect(MONGODB_URI as string);
    console.log('Połączono z bazą danych');

    let totalInserted = 0;
    let totalDuplicates = 0;

    for (const length of TARGET_LENGTHS) {
      const words = loadWordsForLength(length);
      const docs = words.map((word) => ({ word, length }));

      try {
        const result = await WordleWordModel.insertMany(docs, { ordered: false });
        totalInserted += result.length;
        console.log(`✓ ${length}-literowe: dodano ${result.length}/${docs.length}`);
      } catch (err: unknown) {
        // insertMany z ordered:false rzuca BulkWriteError gdy któreś dokumenty są duplikatami
        const e = err as { insertedDocs?: unknown[]; writeErrors?: unknown[] };
        const inserted = e.insertedDocs?.length ?? 0;
        const duplicates = e.writeErrors?.length ?? 0;
        totalInserted += inserted;
        totalDuplicates += duplicates;
        console.log(
          `✓ ${length}-literowe: dodano ${inserted}/${docs.length} (pominięto ${duplicates} duplikatów)`,
        );
      }
    }

    console.log(`\nPodsumowanie: dodano ${totalInserted}, pominięto ${totalDuplicates} duplikatów`);
    const total = await WordleWordModel.countDocuments();
    console.log(`Łącznie w bazie: ${total} słów`);
  } catch (error: unknown) {
    console.error('Błąd podczas importowania słów:', error);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Rozłączono z bazą danych');
    }
  }
}

void importWordleWords();
