import { BaseFactory } from './BaseFactory';
import { BirthdayModel, BirthdayDocument } from '../../../src/models/Birthday';
import { randomInt } from 'crypto';

export interface BirthdayFactoryData {
  userId: string;
  guildId: string;
  date: Date;
  yearSpecified: boolean;
  active: boolean;
}

export class BirthdayFactory extends BaseFactory<BirthdayDocument> {
  private static instance: BirthdayFactory;

  static getInstance(): BirthdayFactory {
    if (!BirthdayFactory.instance) {
      BirthdayFactory.instance = new BirthdayFactory();
    }
    return BirthdayFactory.instance;
  }

  /**
   * Build Birthday object without saving to database
   */
  build(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    const defaults: BirthdayFactoryData = {
      userId: overrides.userId || BaseFactory.pick(BaseFactory.SAMPLE_USER_IDS),
      guildId: overrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS),
      date: overrides.date || this.generateBirthdayDate(),
      yearSpecified: overrides.yearSpecified ?? true,
      active: overrides.active ?? true
    };

    const data = { ...defaults, ...overrides };
    return new BirthdayModel(data) as BirthdayDocument;
  }

  /**
   * Create and save Birthday to database
   */
  async create(overrides: Partial<BirthdayFactoryData> = {}): Promise<BirthdayDocument> {
    const birthdayDoc = this.build(overrides);
    return await birthdayDoc.save();
  }

  /**
   * Create birthday with year specified (full date)
   */
  buildWithYear(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      date: this.generateBirthdayWithYear(),
      yearSpecified: true
    });
  }

  /**
   * Create birthday without year (month/day only)
   */
  buildWithoutYear(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      date: this.generateBirthdayWithoutYear(),
      yearSpecified: false
    });
  }

  /**
   * Create upcoming birthday (within next 30 days)
   */
  buildUpcoming(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      date: this.generateUpcomingBirthday()
    });
  }

  /**
   * Create birthday for today
   */
  buildToday(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    const today = new Date();
    return this.build({
      ...overrides,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate())
    });
  }

  /**
   * Create inactive birthday
   */
  buildInactive(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      active: false
    });
  }

  /**
   * Generate random birthday date
   */
  private generateBirthdayDate(): Date {
    const year = randomInt(1970, 2010); // Birth years between 1970-2010
    const month = randomInt(0, 12); // 0-11 (January-December)
    const day = randomInt(1, 29); // 1-28 to avoid month-end issues
    
    return new Date(year, month, day);
  }

  /**
   * Generate birthday with specific year
   */
  private generateBirthdayWithYear(): Date {
    return this.generateBirthdayDate();
  }

  /**
   * Generate birthday without year (uses a reference year for storage)
   */
  private generateBirthdayWithoutYear(): Date {
    const referenceYear = 1900; // Common reference year for birthdays without year
    const month = randomInt(0, 12);
    const day = randomInt(1, 29);
    
    return new Date(referenceYear, month, day);
  }

  /**
   * Generate upcoming birthday (next 30 days)
   */
  private generateUpcomingBirthday(): Date {
    const today = new Date();
    const currentYear = today.getFullYear();
    const daysFromNow = randomInt(0, 31); // 0-30 days from now
    
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysFromNow);
    
    // Create birthday in current year with the future month/day
    return new Date(currentYear, futureDate.getMonth(), futureDate.getDate());
  }

  /**
   * Create multiple birthdays for the same user in different guilds
   */
  async createForUserInGuilds(userId: string, guildIds: string[], baseOverrides: Partial<BirthdayFactoryData> = {}): Promise<BirthdayDocument[]> {
    const birthdays = [];
    
    for (const guildId of guildIds) {
      const birthday = await this.create({
        ...baseOverrides,
        userId,
        guildId
      });
      birthdays.push(birthday);
    }
    
    return birthdays;
  }

  /**
   * Create birthdays for multiple users in same guild
   */
  async createForUsersInGuild(userIds: string[], guildId: string, baseOverrides: Partial<BirthdayFactoryData> = {}): Promise<BirthdayDocument[]> {
    const birthdays = [];
    
    for (const userId of userIds) {
      const birthday = await this.create({
        ...baseOverrides,
        userId,
        guildId
      });
      birthdays.push(birthday);
    }
    
    return birthdays;
  }

  /**
   * Create birthdays spread across different months
   */
  async createMonthlySpread(count: number, baseOverrides: Partial<BirthdayFactoryData> = {}): Promise<BirthdayDocument[]> {
    const birthdays = [];
    
    for (let i = 0; i < count; i++) {
      const month = i % 12; // Cycle through months
      const day = randomInt(1, 29);
      const year = randomInt(1980, 2005);
      
      const birthday = await this.create({
        ...baseOverrides,
        date: new Date(year, month, day),
        userId: `user-month-${i}`,
        guildId: baseOverrides.guildId || BaseFactory.pick(BaseFactory.SAMPLE_GUILD_IDS)
      });
      
      birthdays.push(birthday);
    }
    
    return birthdays;
  }
}

// Export singleton instance
export const birthdayFactory = BirthdayFactory.getInstance();