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

  async create(overrides: Partial<BirthdayFactoryData> = {}): Promise<BirthdayDocument> {
    const birthdayDoc = this.build(overrides);
    return await birthdayDoc.save();
  }

  buildWithYear(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      date: this.generateBirthdayWithYear(),
      yearSpecified: true
    });
  }

  buildWithoutYear(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      date: this.generateBirthdayWithoutYear(),
      yearSpecified: false
    });
  }

  buildUpcoming(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      date: this.generateUpcomingBirthday()
    });
  }

  buildToday(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    const today = new Date();
    return this.build({
      ...overrides,
      date: new Date(today.getFullYear(), today.getMonth(), today.getDate())
    });
  }

  buildInactive(overrides: Partial<BirthdayFactoryData> = {}): BirthdayDocument {
    return this.build({
      ...overrides,
      active: false
    });
  }

  private generateBirthdayDate(): Date {
    const year = randomInt(1970, 2010);
    const month = randomInt(0, 12);
    const day = randomInt(1, 29);
    
    return new Date(year, month, day);
  }

  private generateBirthdayWithYear(): Date {
    return this.generateBirthdayDate();
  }

  private generateBirthdayWithoutYear(): Date {
    const referenceYear = 1900;
    const month = randomInt(0, 12);
    const day = randomInt(1, 29);
    
    return new Date(referenceYear, month, day);
  }

  private generateUpcomingBirthday(): Date {
    const today = new Date();
    const currentYear = today.getFullYear();
    const daysFromNow = randomInt(0, 31);
    
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + daysFromNow);
    
    return new Date(currentYear, futureDate.getMonth(), futureDate.getDate());
  }

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

  async createMonthlySpread(count: number, baseOverrides: Partial<BirthdayFactoryData> = {}): Promise<BirthdayDocument[]> {
    const birthdays = [];
    
    for (let i = 0; i < count; i++) {
      const month = i % 12;
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

export const birthdayFactory = BirthdayFactory.getInstance();