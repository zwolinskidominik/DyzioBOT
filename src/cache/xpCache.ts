import { Client } from 'discord.js';
import { LevelModel } from '../models/Level';
import type { LevelDocument } from '../models/Level';
import { deltaXp } from '../utils/levelMath';
import { notifyLevelUp } from '../services/levelNotifier';

type Key = `${string}:${string}`;

interface BucketIncr {
  msgCount: number;
  vcMin: number;
}

interface CacheEntry {
  persistedXp: number;
  persistedLevel: number;
  levelDelta: number;
  bucket: BucketIncr;
  bucketStart: Date;
  lastMessageTs?: Date;
  lastVcUpdateTs?: Date;
}

export class XpCache {
  private map = new Map<Key, CacheEntry>();
  private client: Client | null = null;

  public setClient(c: Client) {
    this.client = c;
  }
  async addMsg(g: string, u: string, xp: number) {
    await this.upsert(g, u, xp, { msg: 1 });
  }
  async addVcMin(g: string, u: string, xp: number) {
    await this.upsert(g, u, xp, { vc: 1 });
  }
  async getCurrentXp(g: string, u: string): Promise<{ level: number; xp: number }> {
    const k = `${g}:${u}` as Key;
    const cached = this.map.get(k);

    if (cached) {
      return {
        level: cached.persistedLevel,
        xp: cached.persistedXp + cached.levelDelta,
      };
    }

    const doc = await LevelModel.findOne({ guildId: g, userId: u }).lean<LevelDocument>();
    return {
      level: doc?.level ?? 1,
      xp: doc?.xp ?? 0,
    };
  }

  invalidateUser(g: string, u: string) {
    const k = `${g}:${u}` as Key;
    this.map.delete(k);
  }
  drain(): [Key, CacheEntry][] {
    const a = Array.from(this.map.entries());
    this.map.clear();
    return a;
  }
  private async upsert(g: string, u: string, d: number, inc: { msg?: 1; vc?: 1 }) {
    const k = `${g}:${u}` as Key;
    const now = new Date();
    const bs = new Date(Math.floor(now.getTime() / 300_000) * 300_000);

    let e = this.map.get(k);
    if (!e) {
      const doc = await LevelModel.findOne({ guildId: g, userId: u }).lean<LevelDocument>();
      e = {
        persistedXp: doc?.xp ?? 0,
        persistedLevel: doc?.level ?? 1,
        levelDelta: 0,
        bucket: { msgCount: 0, vcMin: 0 },
        bucketStart: bs,
      };
    }

    e.levelDelta += d;

    if (inc.msg) {
      e.bucket.msgCount++;
      e.lastMessageTs = now;
    }
    if (inc.vc) {
      e.bucket.vcMin++;
      e.lastVcUpdateTs = now;
    }
    e.bucketStart = bs;

    let currentXp = e.persistedXp + e.levelDelta;
    let currentLevel = e.persistedLevel;
    let levelChanged = false;

    while (currentXp >= deltaXp(currentLevel + 1)) {
      const needed = deltaXp(currentLevel + 1);
      currentXp -= needed;
      currentLevel++;
      levelChanged = true;

      await LevelModel.findOneAndUpdate(
        { guildId: g, userId: u },
        { level: currentLevel, xp: currentXp },
        { upsert: true }
      );
    }
    
    // Sprawdź powiadomienie raz po wszystkich level-upach
    if (levelChanged && this.client) {
      await notifyLevelUp(this.client, g, u, currentLevel).catch(() => null);
    }
    
    if (levelChanged) {
      e.persistedLevel = currentLevel;
      e.persistedXp = currentXp;
      e.levelDelta = 0;
    }

    this.map.set(k, e);
  }
}

const xpCache = new XpCache();
export default xpCache;
