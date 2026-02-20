import { CRON } from '../../../src/config/constants/cron';

describe('CRON constants', () => {
  it('exports an object with expected schedule keys', () => {
    expect(CRON).toBeDefined();
    expect(typeof CRON).toBe('object');
  });

  it('has all expected schedule entries', () => {
    const expectedKeys = [
      'BIRTHDAY_CHECK', 'MONTHLY_STATS_GENERATE', 'QUESTION_POST',
      'TOURNAMENT_RULES_DEFAULT', 'TWITCH_THUMBNAIL_CLEANUP',
      'TWITCH_STREAM_CHECK', 'MONTHLY_STATS_FLUSH', 'VC_MINUTE_TICK',
      'WARN_MAINTENANCE', 'GIVEAWAY_CHECK', 'XP_FLUSH', 'CHANNEL_STATS_UPDATE',
    ];
    for (const key of expectedKeys) {
      expect(CRON).toHaveProperty(key);
    }
  });

  it('all values are valid cron expressions (strings)', () => {
    for (const value of Object.values(CRON)) {
      expect(typeof value).toBe('string');
      // Should have at least 5 space-separated fields (standard cron)
      expect(value.split(' ').length).toBeGreaterThanOrEqual(5);
    }
  });

  it('has correct specific schedules', () => {
    expect(CRON.BIRTHDAY_CHECK).toBe('0 9 * * *');
    expect(CRON.MONTHLY_STATS_GENERATE).toBe('0 12 1 * *');
    expect(CRON.GIVEAWAY_CHECK).toBe('* * * * *');
    expect(CRON.XP_FLUSH).toBe('*/5 * * * *');
  });
});
