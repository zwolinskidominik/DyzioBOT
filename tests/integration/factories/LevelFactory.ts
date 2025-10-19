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

  /**
   * Build Level object without saving to database
   */
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
    
    // Ensure level matches XP if not explicitly overridden
    if (!overrides.level && overrides.xp !== undefined) {
      data.level = this.calculateLevelFromXp(data.xp);
    }

    return new LevelModel(data) as LevelDocument;
  }

  /**
   * Create and save Level to database
   */
  async create(overrides: Partial<LevelFactoryData> = {}): Promise<LevelDocument> {
    const levelDoc = this.build(overrides);
    return await levelDoc.save();
  }

  /**
   * Create level with specific level number (calculates appropriate XP)
   */
  async createWithLevel(level: number, overrides: Partial<LevelFactoryData> = {}): Promise<LevelDocument> {
    const xp = this.generateXpForLevel(level);
    return this.create({ ...overrides, level, xp });
  }

  /**
   * Create multiple levels for same user across different guilds
   */
  async createForUser(userId: string, guildCount = 3): Promise<LevelDocument[]> {
    const guilds = BaseFactory.SAMPLE_GUILD_IDS.slice(0, guildCount);
    return Promise.all(
      guilds.map(guildId => this.create({ userId, guildId }))
    );
  }

  /**
   * Create multiple levels for same guild with different users
   */
  async createForGuild(guildId: string, userCount = 5): Promise<LevelDocument[]> {
    const users = BaseFactory.SAMPLE_USER_IDS.slice(0, userCount);
    return Promise.all(
      users.map(userId => this.create({ guildId, userId }))
    );
  }

  /**
   * Create leaderboard data (multiple users with varying levels)
   */
  async createLeaderboard(guildId: string, userCount = 10): Promise<LevelDocument[]> {
    const levels = Array.from({ length: userCount }, (_, i) => userCount - i); // Descending levels
    const users = BaseFactory.SAMPLE_USER_IDS.slice(0, userCount);
    
    return Promise.all(
      users.map((userId, index) => 
        this.createWithLevel(levels[index], { guildId, userId })
      )
    );
  }

  /**
   * Generate realistic XP amount (weighted towards lower values)
   */
  private generateRealisticXp(): number {
    const weights = [
      { range: [0, 500], weight: 40 },        // Beginners
      { range: [500, 2000], weight: 30 },     // Active users
      { range: [2000, 10000], weight: 20 },   // Regular users
      { range: [10000, 50000], weight: 8 },   // Power users
      { range: [50000, 200000], weight: 2 },  // Veterans
    ];

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let random = Math.random() * totalWeight;

    for (const { range, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        return Math.floor(Math.random() * (range[1] - range[0]) + range[0]);
      }
    }

    return 100; // fallback
  }

  /**
   * Calculate level from XP using bot's level formula
   */
  private calculateLevelFromXp(xp?: number): number {
    if (!xp) return 1;
    // Using levelFromTotalXp formula: (-50 + sqrt(500 + 20*total)) / 10
    const level = Math.floor((-50 + Math.sqrt(500 + 20 * xp)) / 10);
    return Math.max(1, level);
  }

  /**
   * Generate appropriate XP for given level
   */
  private generateXpForLevel(level: number): number {
    // Using xpForLevel formula: 5 * level^2 + 50 * level + 100
    const baseXp = 5 * level * level + 50 * level + 100;
    // Add some random progress within the level (0-80% of next level)
    const deltaXp = 10 * level + 55; // XP needed for next level
    const progress = Math.floor(Math.random() * deltaXp * 0.8);
    return baseXp + progress;
  }
}

// Export singleton instance
export const levelFactory = LevelFactory.getInstance();