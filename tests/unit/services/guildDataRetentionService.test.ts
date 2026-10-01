/**
 * Unit tests for guildDataRetentionService — usuwanie danych serwerów 30 dni po usunięciu bota.
 *
 * To kod kasujący dane, więc testujemy przede wszystkim bezpieczniki: niczego nie usuwamy bez
 * poprawnego ID serwera, bez wiarygodnej listy obecnych serwerów, ani dla serwera, na którym
 * bot nadal jest.
 */
import path from 'path';
import { promises as fs } from 'fs';
import mongoose from 'mongoose';

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockDeparture = {
  updateOne: jest.fn().mockResolvedValue({}),
  deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  find: jest.fn(),
};
jest.mock('../../../src/models/GuildDeparture', () => ({ GuildDepartureModel: mockDeparture }));

import {
  GUILD_DATA_RETENTION_DAYS,
  isValidGuildId,
  markGuildDeparted,
  reconcileGuildDepartures,
  purgeExpiredGuildData,
} from '../../../src/services/guildDataRetentionService';

const GUILD_A = '881293681783623680';
const GUILD_B = '123456789012345678';

const collectionNames = ['levels', 'warns', 'system.views', 'guilddepartures'];
const mockDistinct = jest.fn();
const mockRawDeleteMany = jest.fn();
const mockCollection = jest.fn((_name: string) => ({ distinct: mockDistinct, deleteMany: mockRawDeleteMany }));

beforeAll(() => {
  Object.defineProperty(mongoose.connection, 'db', {
    configurable: true,
    value: {
      listCollections: () => ({ toArray: async () => collectionNames.map((name) => ({ name })) }),
      collection: (name: string) => mockCollection(name),
    },
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockRawDeleteMany.mockResolvedValue({ deletedCount: 2 });
  jest.spyOn(fs, 'rm').mockResolvedValue(undefined);
});

describe('isValidGuildId', () => {
  it('accepts Discord snowflakes only', () => {
    expect(isValidGuildId(GUILD_A)).toBe(true);
    expect(isValidGuildId('')).toBe(false);
    expect(isValidGuildId('abc')).toBe(false);
    expect(isValidGuildId('../123456789012345678')).toBe(false);
    expect(isValidGuildId(undefined)).toBe(false);
    expect(isValidGuildId(null)).toBe(false);
  });
});

describe('markGuildDeparted', () => {
  it('upserts without overwriting an earlier departure date', async () => {
    const at = new Date('2026-09-01T00:00:00Z');
    const result = await markGuildDeparted(GUILD_A, at);
    expect(result.ok).toBe(true);
    expect(mockDeparture.updateOne).toHaveBeenCalledWith(
      { guildId: GUILD_A },
      { $setOnInsert: { guildId: GUILD_A, leftAt: at } },
      { upsert: true }
    );
  });

  it('refuses invalid guild ids without touching the database', async () => {
    const result = await markGuildDeparted('not-a-guild');
    expect(result.ok).toBe(false);
    expect(mockDeparture.updateOne).not.toHaveBeenCalled();
  });
});

describe('reconcileGuildDepartures', () => {
  it('does nothing when the bot reports no guilds (e.g. gateway not ready)', async () => {
    const result = await reconcileGuildDepartures([]);
    expect(result.ok).toBe(false);
    expect(mockDistinct).not.toHaveBeenCalled();
    expect(mockDeparture.updateOne).not.toHaveBeenCalled();
  });

  it('marks guilds known to the database but absent from the bot, and clears present ones', async () => {
    mockDistinct.mockResolvedValue([GUILD_A, GUILD_B, null, 'junk']);

    const result = await reconcileGuildDepartures([GUILD_A]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.marked).toBe(1);
    expect(mockDeparture.updateOne).toHaveBeenCalledTimes(1);
    expect(mockDeparture.updateOne.mock.calls[0][0]).toEqual({ guildId: GUILD_B });
    // Kolekcje systemowe i sam rejestr odejść nie są skanowane.
    const scanned = mockCollection.mock.calls.map(([name]) => name);
    expect(scanned).toEqual(['levels', 'warns']);
    expect(mockDeparture.deleteMany).toHaveBeenCalledWith({ guildId: { $in: [GUILD_A] } });
  });
});

describe('purgeExpiredGuildData', () => {
  function due(...guildIds: string[]) {
    mockDeparture.find.mockReturnValue({ lean: async () => guildIds.map((guildId) => ({ guildId })) });
  }

  it(`only selects departures older than ${GUILD_DATA_RETENTION_DAYS} days`, async () => {
    due();
    const now = new Date('2026-10-31T00:00:00Z');
    await purgeExpiredGuildData([GUILD_A], now);
    const cutoff = new Date(now.getTime() - GUILD_DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    expect(mockDeparture.find).toHaveBeenCalledWith({ leftAt: { $lte: cutoff } });
  });

  it('deletes all guild-scoped documents and uploaded files of an expired guild', async () => {
    due(GUILD_B);

    const result = await purgeExpiredGuildData([GUILD_A]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.purgedGuilds).toEqual([GUILD_B]);
    expect(result.data.deletedDocuments).toBe(4); // 2 kolekcje × 2 dokumenty
    expect(mockRawDeleteMany).toHaveBeenCalledTimes(2);
    for (const [filter] of mockRawDeleteMany.mock.calls) {
      expect(filter).toEqual({ guildId: GUILD_B });
    }
    const removedDirs = (fs.rm as jest.Mock).mock.calls.map(([dir]) => dir);
    expect(removedDirs).toEqual([
      path.join(process.cwd(), 'assets', 'greetings', 'uploads', GUILD_B),
      path.join(process.cwd(), 'assets', 'lobby', 'uploads', GUILD_B),
    ]);
    expect(mockDeparture.deleteOne).toHaveBeenCalledWith({ guildId: GUILD_B });
  });

  it('never purges a guild the bot is currently in — just drops the stale departure', async () => {
    due(GUILD_A);

    const result = await purgeExpiredGuildData([GUILD_A]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.purgedGuilds).toEqual([]);
    expect(mockRawDeleteMany).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
    expect(mockDeparture.deleteOne).toHaveBeenCalledWith({ guildId: GUILD_A });
  });

  it('skips records with an invalid guild id instead of running an unscoped delete', async () => {
    due('');

    const result = await purgeExpiredGuildData([GUILD_A]);

    expect(result.ok).toBe(true);
    expect(mockRawDeleteMany).not.toHaveBeenCalled();
    expect(fs.rm).not.toHaveBeenCalled();
  });

  it('keeps the departure record when deletion fails, so the next run retries', async () => {
    due(GUILD_B);
    mockRawDeleteMany.mockRejectedValueOnce(new Error('db down'));

    const result = await purgeExpiredGuildData([GUILD_A]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.purgedGuilds).toEqual([]);
    expect(mockDeparture.deleteOne).not.toHaveBeenCalled();
  });
});
