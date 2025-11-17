import { randomInt, randomUUID } from 'crypto';

export abstract class BaseFactory<T> {
  protected static readonly SAMPLE_GUILD_IDS = [
    '881293681783623680',
    '1264582308003053570',
    '123456789012345678',
  ];

  protected static readonly SAMPLE_USER_IDS = [
    '123456789012345678',
    '234567890123456789',
    '345678901234567890',
    '456789012345678901',
    '567890123456789012',
  ];

  protected static readonly SAMPLE_CHANNEL_IDS = [
    '801234567890123456',
    '802345678901234567',
    '803456789012345678',
    '804567890123456789',
  ];

  protected static readonly SAMPLE_ROLE_IDS = [
    '701234567890123456',
    '702345678901234567', 
    '703456789012345678',
    '704567890123456789',
  ];

  protected static randomSnowflake(): string {
    return (BigInt(Date.now() - 1420070400000) << 22n | 
           BigInt(randomInt(0, 31)) << 17n |
           BigInt(randomInt(0, 31)) << 12n |
           BigInt(randomInt(0, 4095))).toString();
  }

  protected static pick<T>(array: T[]): T {
    return array[randomInt(array.length)];
  }

  protected static randomString(prefix = 'test', length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomInt(chars.length));
    }
    return result;
  }

  protected static futureDate(daysFromNow = 7): Date {
    const date = new Date();
    date.setDate(date.getDate() + randomInt(1, daysFromNow + 1));
    return date;
  }

  protected static pastDate(daysAgo = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() - randomInt(1, daysAgo + 1));
    return date;
  }

  abstract build(overrides?: Partial<T>): T;

  abstract create(overrides?: Partial<T>): Promise<T>;

  async createMany(count: number, overrides?: Partial<T>): Promise<T[]> {
    const promises = Array.from({ length: count }, () => this.create(overrides));
    return Promise.all(promises);
  }

  buildMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}

export { randomUUID };