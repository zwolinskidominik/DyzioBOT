import { randomInt, randomUUID } from 'crypto';

/**
 * Base factory class with common test data generation utilities
 */
export abstract class BaseFactory<T> {
  protected static readonly SAMPLE_GUILD_IDS = [
    '881293681783623680', // Main Server
    '1264582308003053570', // Test Server
    '123456789012345678', // Generic Test
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

  /**
   * Generate random Discord snowflake ID
   */
  protected static randomSnowflake(): string {
    return (BigInt(Date.now() - 1420070400000) << 22n | 
           BigInt(randomInt(0, 31)) << 17n |
           BigInt(randomInt(0, 31)) << 12n |
           BigInt(randomInt(0, 4095))).toString();
  }

  /**
   * Pick random item from array
   */
  protected static pick<T>(array: T[]): T {
    return array[randomInt(array.length)];
  }

  /**
   * Generate random string with prefix
   */
  protected static randomString(prefix = 'test', length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = prefix;
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomInt(chars.length));
    }
    return result;
  }

  /**
   * Generate random future date
   */
  protected static futureDate(daysFromNow = 7): Date {
    const date = new Date();
    date.setDate(date.getDate() + randomInt(1, daysFromNow + 1));
    return date;
  }

  /**
   * Generate random past date
   */
  protected static pastDate(daysAgo = 30): Date {
    const date = new Date();
    date.setDate(date.getDate() - randomInt(1, daysAgo + 1));
    return date;
  }

  /**
   * Build object without saving to database
   */
  abstract build(overrides?: Partial<T>): T;

  /**
   * Create and save object to database
   */
  abstract create(overrides?: Partial<T>): Promise<T>;

  /**
   * Create multiple objects
   */
  async createMany(count: number, overrides?: Partial<T>): Promise<T[]> {
    const promises = Array.from({ length: count }, () => this.create(overrides));
    return Promise.all(promises);
  }

  /**
   * Build multiple objects without saving
   */
  buildMany(count: number, overrides?: Partial<T>): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}

export { randomUUID };