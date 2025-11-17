import { describe, beforeAll, afterAll, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import { DbManager } from '../setup/db';
import { FortuneModel } from '../../../src/models/Fortune';
import { clearTestData } from '../helpers/seeding';
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';


interface IFortuneData {
  content: string;
}

function loadFortunesFromFile(filePath: string): IFortuneData[] {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  return fileContent
    .split('\n')
    .filter((line) => line.trim())
    .map((content) => ({ content }));
}

async function importFortunes(MONGODB_URI: string, FORTUNES_FILE_PATH: string): Promise<void> {
  const connectionAlreadyExists = mongoose.connection.readyState === 1;
  
  try {
    if (!connectionAlreadyExists) {
      await mongoose.connect(MONGODB_URI);
      console.log('Połączono z bazą danych');
    }

    const fortunes = loadFortunesFromFile(FORTUNES_FILE_PATH);

    await FortuneModel.deleteMany({});

    await FortuneModel.insertMany(fortunes);
    console.log(`Zaimportowano ${fortunes.length} wróżb`);
  } catch (error: unknown) {
    console.error('Błąd podczas importowania wróżb:', error);
    throw error;
  } finally {
    if (!connectionAlreadyExists && mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('Rozłączono z bazą danych');
    }
  }
}

describe('ImportFortunes Script Integration Tests', () => {
  let dbManager: DbManager;
  let testDbUri: string;
  let testFilePath: string;

  beforeAll(async () => {
    dbManager = new DbManager();
    testDbUri = await dbManager.startDb();
    testFilePath = path.join(__dirname, 'test-fortunes.txt');
  }, 30000);

  afterAll(async () => {
    await dbManager.stopDb();
    
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (error) {
    }
  });

  beforeEach(async () => {
    await clearTestData();
  });

  afterEach(async () => {
    await clearTestData();
    
    try {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    } catch (error) {
    }
  });

  describe('loadFortunesFromFile function', () => {
    it('should load fortunes from a valid file', () => {
      const testFortunes = [
        'Szczęście uśmiechnie się do Ciebie dziś',
        'Wielkie rzeczy wymagają czasu',
        'Twoja wytrwałość zostanie nagrodzona'
      ];
      
      fs.writeFileSync(testFilePath, testFortunes.join('\n'), 'utf-8');
      
      const result = loadFortunesFromFile(testFilePath);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ content: 'Szczęście uśmiechnie się do Ciebie dziś' });
      expect(result[1]).toEqual({ content: 'Wielkie rzeczy wymagają czasu' });
      expect(result[2]).toEqual({ content: 'Twoja wytrwałość zostanie nagrodzona' });
    });

    it('should filter out empty lines', () => {
      const testContent = [
        'Pierwsza wróżba',
        '',
        '   ',
        'Druga wróżba',
        '',
        'Trzecia wróżba'
      ];
      
      fs.writeFileSync(testFilePath, testContent.join('\n'), 'utf-8');
      
      const result = loadFortunesFromFile(testFilePath);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ content: 'Pierwsza wróżba' });
      expect(result[1]).toEqual({ content: 'Druga wróżba' });
      expect(result[2]).toEqual({ content: 'Trzecia wróżba' });
    });

    it('should handle file with only empty lines', () => {
      const testContent = ['', '   ', '\t', '\n'];
      
      fs.writeFileSync(testFilePath, testContent.join('\n'), 'utf-8');
      
      const result = loadFortunesFromFile(testFilePath);
      
      expect(result).toHaveLength(0);
    });

    it('should throw error for non-existent file', () => {
      const nonExistentPath = path.join(__dirname, 'non-existent-file.txt');
      
      expect(() => {
        loadFortunesFromFile(nonExistentPath);
      }).toThrow();
    });

    it('should handle single line file', () => {
      fs.writeFileSync(testFilePath, 'Pojedyncza wróżba', 'utf-8');
      
      const result = loadFortunesFromFile(testFilePath);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ content: 'Pojedyncza wróżba' });
    });

    it('should preserve line content with special characters', () => {
      const specialContent = [
        'Wróżba z ąćęłńóśźż',
        'Fortune with émojis 🔮✨',
        'Wróżba z "cudzysłowami" i \'apostrofami\'',
        'Numbers and symbols: 123 @#$%'
      ];
      
      fs.writeFileSync(testFilePath, specialContent.join('\n'), 'utf-8');
      
      const result = loadFortunesFromFile(testFilePath);
      
      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({ content: 'Wróżba z ąćęłńóśźż' });
      expect(result[1]).toEqual({ content: 'Fortune with émojis 🔮✨' });
      expect(result[2]).toEqual({ content: 'Wróżba z "cudzysłowami" i \'apostrofami\'' });
      expect(result[3]).toEqual({ content: 'Numbers and symbols: 123 @#$%' });
    });
  });

  describe('importFortunes function', () => {
    it('should successfully import fortunes to database', async () => {
      const timestamp = Date.now();
      const testFortunes = [
        `Sukces czeka za rogiem ${timestamp}`,
        `Twoja intuicja Cię nie zawiedzie ${timestamp}`,
        `Dzisiaj jest Twój szczęśliwy dzień ${timestamp}`
      ];
      
      fs.writeFileSync(testFilePath, testFortunes.join('\n'), 'utf-8');
      await FortuneModel.deleteMany({});
      
      await importFortunes(testDbUri, testFilePath);
      
      const savedFortunes = await FortuneModel.find({}).sort({ content: 1 });
      
      expect(savedFortunes).toHaveLength(3);
      expect(savedFortunes[0].content).toBe(`Dzisiaj jest Twój szczęśliwy dzień ${timestamp}`);
      expect(savedFortunes[1].content).toBe(`Sukces czeka za rogiem ${timestamp}`);
      expect(savedFortunes[2].content).toBe(`Twoja intuicja Cię nie zawiedzie ${timestamp}`);
    });

    it('should clear existing fortunes before importing new ones', async () => {
      const timestamp = Date.now();
      await FortuneModel.create([
        { content: `Stara wróżba 1 ${timestamp}` },
        { content: `Stara wróżba 2 ${timestamp}` }
      ]);
      
      let existingCount = await FortuneModel.countDocuments();
      expect(existingCount).toBe(2);
      
      const newFortunes = [
        `Nowa wróżba 1 ${timestamp}`,
        `Nowa wróżba 2 ${timestamp}`,
        `Nowa wróżba 3 ${timestamp}`
      ];
      
      fs.writeFileSync(testFilePath, newFortunes.join('\n'), 'utf-8');
      
      await importFortunes(testDbUri, testFilePath);
      
      const allFortunes = await FortuneModel.find({}).sort({ content: 1 });
      
      expect(allFortunes).toHaveLength(3);
      expect(allFortunes[0].content).toBe(`Nowa wróżba 1 ${timestamp}`);
      expect(allFortunes[1].content).toBe(`Nowa wróżba 2 ${timestamp}`);
      expect(allFortunes[2].content).toBe(`Nowa wróżba 3 ${timestamp}`);
      const oldFortunes = await FortuneModel.find({ 
        content: { $in: [`Stara wróżba 1 ${timestamp}`, `Stara wróżba 2 ${timestamp}`] } 
      });
      expect(oldFortunes).toHaveLength(0);
    });

    it('should handle empty fortune file', async () => {
      const timestamp = Date.now();
      
      fs.writeFileSync(testFilePath, '', 'utf-8');
      await FortuneModel.create([
        { content: `Istniejąca wróżba ${timestamp}` }
      ]);
      
      await importFortunes(testDbUri, testFilePath);
      
      const allFortunes = await FortuneModel.find({});
      
      expect(allFortunes).toHaveLength(0);
    });

    it('should handle database connection errors gracefully', async () => {
      const invalidUri = 'mongodb://invalid-host:27017/test';
      
      fs.writeFileSync(testFilePath, 'Test fortune', 'utf-8');
      
      const wasConnected = mongoose.connection.readyState === 1;
      
      if (wasConnected) {
        await mongoose.disconnect();
      }
      
      try {
        await expect(importFortunes(invalidUri, testFilePath)).rejects.toThrow();
      } finally {
        if (wasConnected) {
          await mongoose.connect(testDbUri);
        }
      }
    }, 45000);

    it('should handle non-existent file errors gracefully', async () => {
      const nonExistentPath = path.join(__dirname, 'non-existent-fortunes.txt');
      
      await expect(importFortunes(testDbUri, nonExistentPath)).rejects.toThrow();
    });

    it('should import large number of fortunes efficiently', async () => {
      const largeFortunes = Array.from({ length: 100 }, (_, i) => 
        `Wróżba numer ${i + 1}: ${Math.random().toString(36).substring(7)}`
      );
      
      fs.writeFileSync(testFilePath, largeFortunes.join('\n'), 'utf-8');
      
      await FortuneModel.deleteMany({});
      
      const startTime = Date.now();
      await importFortunes(testDbUri, testFilePath);
      const endTime = Date.now();
      
      const savedFortunes = await FortuneModel.find({});
      
      expect(savedFortunes).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should maintain unique constraint on fortune content', async () => {
      const timestamp = Date.now();
      const duplicateFortunes = [
        `Unikalna wróżba ${timestamp}`,
        `Inna wróżba ${timestamp}`,
        `Unikalna wróżba ${timestamp}`,
        `Jeszcze inna wróżba ${timestamp}`
      ];
      
      fs.writeFileSync(testFilePath, duplicateFortunes.join('\n'), 'utf-8');
      await expect(importFortunes(testDbUri, testFilePath)).rejects.toThrow();
    });
  });

  describe('Integration with FortuneModel', () => {
    it('should create fortunes that are compatible with FortuneModel queries', async () => {
      const timestamp = Date.now();
      const testFortunes = [
        `Fortuna sprzyja odważnym ${timestamp}`,
        `Cierpliwość jest cnotą ${timestamp}`,
        `Każdy dzień to nowy początek ${timestamp}`
      ];
      
      fs.writeFileSync(testFilePath, testFortunes.join('\n'), 'utf-8');
      
      await FortuneModel.deleteMany({});
      
      await importFortunes(testDbUri, testFilePath);
      const allFortunes = await FortuneModel.find({});
      expect(allFortunes).toHaveLength(3);
      
      const randomFortune = await FortuneModel.aggregate([{ $sample: { size: 1 } }]);
      expect(randomFortune).toHaveLength(1);
      expect(testFortunes).toContain(randomFortune[0].content);
      
      const specificFortune = await FortuneModel.findOne({ content: `Fortuna sprzyja odważnym ${timestamp}` });
      expect(specificFortune).toBeDefined();
      expect(specificFortune?.content).toBe(`Fortuna sprzyja odważnym ${timestamp}`);
      
      const countResult = await FortuneModel.countDocuments();
      expect(countResult).toBe(3);
    });
  });
});