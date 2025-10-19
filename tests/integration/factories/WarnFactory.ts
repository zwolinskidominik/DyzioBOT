import { BaseFactory } from './BaseFactory';
import { WarnModel, WarnDocument } from '../../../src/models/Warn';

export interface WarnEntryData {
  reason: string;
  date: Date;
  moderator: string;
}

export interface WarnFactoryData {
  userId: string;
  guildId: string;
  warnings: WarnEntryData[];
}

export class WarnFactory extends BaseFactory<WarnDocument> {
  private static instance: WarnFactory;

  static getInstance(): WarnFactory {
    if (!WarnFactory.instance) {
      WarnFactory.instance = new WarnFactory();
    }
    return WarnFactory.instance;
  }

  /**
   * Build Warn object without saving to database
   */
  build(overrides: Partial<WarnFactoryData> = {}): WarnDocument {
    const defaults: WarnFactoryData = {
      userId: overrides.userId || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      warnings: overrides.warnings || [this.createWarnEntry()],
    };

    const data = { ...defaults, ...overrides };
    return new WarnModel(data) as WarnDocument;
  }

  /**
   * Create and save Warn to database
   */
  async create(overrides: Partial<WarnFactoryData> = {}): Promise<WarnDocument> {
    const warnDoc = this.build(overrides);
    return await warnDoc.save();
  }

  /**
   * Create user with no warnings (empty record)
   */
  async createClean(userId: string, guildId: string): Promise<WarnDocument> {
    return this.create({
      userId,
      guildId,
      warnings: [],
    });
  }

  /**
   * Create user with single warning
   */
  async createSingleWarn(
    userId: string, 
    guildId: string, 
    reason?: string, 
    moderator?: string
  ): Promise<WarnDocument> {
    return this.create({
      userId,
      guildId,
      warnings: [this.createWarnEntry(reason, moderator)],
    });
  }

  /**
   * Create user with multiple warnings
   */
  async createMultipleWarns(
    userId: string,
    guildId: string,
    count = 3
  ): Promise<WarnDocument> {
    const warnings = Array.from({ length: count }, (_, i) => 
      this.createWarnEntry(
        this.generateRandomReason(),
        BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS), // Random moderator
        BaseFactory.pastDate(30 - i * 7) // Spread warnings over time
      )
    );

    return this.create({
      userId,
      guildId,
      warnings,
    });
  }

  /**
   * Create warning records for multiple users in same guild
   */
  async createForGuild(guildId: string, userCount = 5): Promise<WarnDocument[]> {
    const users = BaseFactory.SAMPLE_USER_IDS.slice(0, userCount);
    return Promise.all(
      users.map(userId => {
        const warnCount = Math.floor(Math.random() * 4); // 0-3 warnings
        if (warnCount === 0) {
          return this.createClean(userId, guildId);
        }
        return this.createMultipleWarns(userId, guildId, warnCount);
      })
    );
  }

  /**
   * Create progressive warning scenario (warnings spread over time)
   */
  async createProgressiveWarns(
    userId: string,
    guildId: string,
    count = 3,
    daysBetween = 7
  ): Promise<WarnDocument> {
    const warnings = Array.from({ length: count }, (_, i) => {
      const daysAgo = (count - i) * daysBetween;
      return this.createWarnEntry(
        this.generateProgressiveReason(i + 1),
        BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
        BaseFactory.pastDate(daysAgo)
      );
    });

    return this.create({ userId, guildId, warnings });
  }

  /**
   * Create warning with custom entry data
   */
  async createWithEntry(
    userId: string,
    guildId: string,
    entry: Partial<WarnEntryData>
  ): Promise<WarnDocument> {
    const warning = this.createWarnEntry(entry.reason, entry.moderator, entry.date);
    return this.create({
      userId,
      guildId,
      warnings: [warning],
    });
  }

  /**
   * Add warning to existing record
   */
  async addWarnToUser(
    userId: string,
    guildId: string,
    reason?: string,
    moderator?: string
  ): Promise<WarnDocument> {
    const existing = await WarnModel.findOne({ userId, guildId });
    if (existing) {
      existing.warnings.push(this.createWarnEntry(reason, moderator));
      return await existing.save();
    } else {
      return this.createSingleWarn(userId, guildId, reason, moderator);
    }
  }

  /**
   * Create a single warning entry
   */
  private createWarnEntry(
    reason?: string,
    moderator?: string,
    date?: Date
  ): WarnEntryData {
    return {
      reason: reason || this.generateRandomReason(),
      moderator: moderator || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      date: date || BaseFactory.pastDate(30),
    };
  }

  /**
   * Generate random warning reason
   */
  private generateRandomReason(): string {
    const reasons = [
      'Spam w kanałach tekstowych',
      'Nieodpowiednie zachowanie na czacie głosowym',
      'Naruszenie regulaminu serwera',
      'Używanie nieodpowiedniego języka',
      'Flooding kanałów wiadomościami',
      'Disturbing innych użytkowników',
      'Ignorowanie próśb moderatorów',
      'Niewłaściwe używanie komend bota',
      'Publikowanie nieodpowiednich treści',
      'Próba obejścia ograniczeń serwera',
    ];
    return BaseFactory.pick(reasons);
  }

  /**
   * Generate progressive warning reasons (escalating severity)
   */
  private generateProgressiveReason(warnNumber: number): string {
    const progressiveReasons = [
      'Pierwsze ostrzeżenie - spam na kanałach',
      'Drugie ostrzeżenie - kontynuowanie nieodpowiedniego zachowania',
      'Trzecie ostrzeżenie - ignorowanie wcześniejszych ostrzeżeń',
      'Ostatnie ostrzeżenie przed banem - poważne naruszenie regulaminu',
      'Końcowe ostrzeżenie - następne naruszenie = ban permanentny',
    ];
    
    const index = Math.min(warnNumber - 1, progressiveReasons.length - 1);
    return progressiveReasons[index];
  }
}

// Export singleton instance
export const warnFactory = WarnFactory.getInstance();