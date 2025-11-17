import { BaseFactory } from './BaseFactory';
import { LevelModel, LevelDocument } from '../../../src/models/Level';

export interface LevelFactoryData {
  guildId: string;
  userId: string;
  xp: number;
  level: number;
  lastMessageTs?: Date;
  lastVcUpdateTs?: Date;
}

export class LevelFactory extends BaseFactory<LevelDocument> {
  private static instance: LevelFactory;

  static getInstance(): LevelFactory {
    if (!LevelFactory.instance) {
      LevelFactory.instance = new LevelFactory();
    }
    return LevelFactory.instance;
  }

  build(overrides: Partial<LevelFactoryData> = {}): LevelDocument {
    const defaults: LevelFactoryData = {
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      userId: overrides.userId || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      xp: overrides.xp ?? this.generateRealisticXp(),
      level: overrides.level ?? this.calculateLevelFromXp(overrides.xp),
      lastMessageTs: overrides.lastMessageTs || BaseFactory.pastDate(7),
      lastVcUpdateTs: overrides.lastVcUpdateTs || BaseFactory.pastDate(7),
    };

    const data = { ...defaults, ...overrides };
    
    if (!overrides.level && overrides.xp !== undefined) {
      data.level = this.calculateLevelFromXp(data.xp);
    }

    return new LevelModel(data) as LevelDocument;
  }

  async create(overrides: Partial<LevelFactoryData> = {}): Promise<LevelDocument> {
    const levelDoc = this.build(overrides);
    return await levelDoc.save();
  }

  async createWithLevel(level: number, overrides: Partial<LevelFactoryData> = {}): Promise<LevelDocument> {
    const xp = this.generateXpForLevel(level);
    return this.create({ ...overrides, level, xp });
  }

  async createForUser(userId: string, guildCount = 3): Promise<LevelDocument[]> {
    const guilds = BaseFactory.SAMPLE_GUILD_IDS.slice(0, guildCount);
    return Promise.all(
      guilds.map(guildId => this.create({ userId, guildId }))
    );
  }

  async createForGuild(guildId: string, userCount = 5): Promise<LevelDocument[]> {
    const users = BaseFactory.SAMPLE_USER_IDS.slice(0, userCount);
    return Promise.all(
      users.map(userId => this.create({ guildId, userId }))
    );
  }

  async createLeaderboard(guildId: string, userCount = 10): Promise<LevelDocument[]> {
    const levels = Array.from({ length: userCount }, (_, i) => userCount - i);
    const users = BaseFactory.SAMPLE_USER_IDS.slice(0, userCount);
    
    return Promise.all(
      users.map((userId, index) => 
        this.createWithLevel(levels[index], { guildId, userId })
      )
    );
  }

  private generateRealisticXp(): number {
    const weights = [
      { range: [0, 500], weight: 40 },
      { range: [500, 2000], weight: 30 },
      { range: [2000, 10000], weight: 20 },
      { range: [10000, 50000], weight: 8 },
      { range: [50000, 200000], weight: 2 },
    ];

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { range, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        return Math.floor(Math.random() * (range[1] - range[0]) + range[0]);
      }
    }

    return 100;
  }

  private calculateLevelFromXp(xp?: number): number {
    if (!xp) return 1;
    const level = Math.floor((-50 + Math.sqrt(500 + 20 * xp)) / 10);
    return Math.max(1, level);
  }

  private generateXpForLevel(level: number): number {
    const baseXp = 5 * level * level + 50 * level + 100;
    const deltaXp = 10 * level + 55;
    const progress = Math.floor(Math.random() * deltaXp * 0.8);
    return baseXp + progress;
  }
}

export const levelFactory = LevelFactory.getInstance();