import { MonthlyStatsModel } from '../models/MonthlyStats';

type Key = `${string}:${string}:${string}`; // guildId:userId:month

interface CacheEntry {
  guildId: string;
  userId: string;
  month: string;
  messageCount: number;
  voiceMinutes: number;
}

export class MonthlyStatsCache {
  private map = new Map<Key, CacheEntry>();

  addMessage(guildId: string, userId: string, month: string) {
    const key = `${guildId}:${userId}:${month}` as Key;
    const entry = this.map.get(key);

    if (entry) {
      entry.messageCount++;
    } else {
      this.map.set(key, {
        guildId,
        userId,
        month,
        messageCount: 1,
        voiceMinutes: 0,
      });
    }
  }

  addVoiceMinutes(guildId: string, userId: string, month: string, minutes: number = 0.5) {
    const key = `${guildId}:${userId}:${month}` as Key;
    const entry = this.map.get(key);

    if (entry) {
      entry.voiceMinutes += minutes;
    } else {
      this.map.set(key, {
        guildId,
        userId,
        month,
        messageCount: 0,
        voiceMinutes: minutes,
      });
    }
  }

  drain(): CacheEntry[] {
    const entries = Array.from(this.map.values());
    this.map.clear();
    return entries;
  }

  size(): number {
    return this.map.size;
  }
}

const monthlyStatsCache = new MonthlyStatsCache();
export default monthlyStatsCache;

export async function flushMonthlyStats() {
  const entries = monthlyStatsCache.drain();
  
  if (entries.length === 0) {
    return;
  }

  const bulkOps: any[] = [];

  for (const entry of entries) {
    bulkOps.push({
      updateOne: {
        filter: {
          guildId: entry.guildId,
          userId: entry.userId,
          month: entry.month,
        },
        update: {
          $inc: {
            messageCount: entry.messageCount,
            voiceMinutes: entry.voiceMinutes,
          },
          $set: {
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    });
  }

  try {
    await MonthlyStatsModel.bulkWrite(bulkOps, { ordered: false });
  } catch (error) {
    for (const entry of entries) {
      if (entry.messageCount > 0) {
        for (let i = 0; i < entry.messageCount; i++) {
          monthlyStatsCache.addMessage(entry.guildId, entry.userId, entry.month);
        }
      }
      if (entry.voiceMinutes > 0) {
        monthlyStatsCache.addVoiceMinutes(entry.guildId, entry.userId, entry.month, entry.voiceMinutes);
      }
    }
  }
}
