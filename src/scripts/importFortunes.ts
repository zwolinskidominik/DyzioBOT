import type { IFortuneData } from '../interfaces/Fortune';
import { FortuneModel } from '../models/Fortune';
import { env } from '../config';
import mongoose from 'mongoose';
import * as fs from 'fs';

const { MONGODB_URI } = env();

const FORTUNES_FILE_PATH = 'fortunes.txt';

function loadFortunesFromFile(filePath: string): IFortuneData[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  return fileContent
    .split('\n')
    .filter((line) => line.trim())
    .map((content) => ({ content }));
}

async function importFortunes(): Promise<void> {
  let connection = null;

  try {
    connection = await mongoose.connect(MONGODB_URI as string);
    console.log('Połączono z bazą danych');

    const fortunes = loadFortunesFromFile(FORTUNES_FILE_PATH);

    await FortuneModel.deleteMany({});

    await FortuneModel.insertMany(fortunes);
    console.log(`Zaimportowano ${fortunes.length} wróżb`);
  } catch (error: unknown) {
    console.error('Błąd podczas importowania wróżb:', error);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log('Rozłączono z bazą danych');
    }
  }
}

importFortunes();
