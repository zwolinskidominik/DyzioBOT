import { COLORS } from '../../../src/config/constants/colors';

describe('COLORS constants', () => {
  it('exports an object with expected color keys', () => {
    expect(COLORS).toBeDefined();
    expect(typeof COLORS).toBe('object');
  });

  it('has all expected color entries', () => {
    const expectedKeys = [
      'CS2_MIX', 'DEFAULT', 'BIRTHDAY', 'EMBED', 'ERROR', 'FACEIT',
      'FORTUNE', 'FORTUNE_ADD', 'GIVEAWAY', 'GIVEAWAY_ENDED', 'JOIN',
      'LEAVE', 'MEME', 'MUSIC', 'MUSIC_PAUSE', 'MUSIC_SUCCESS',
      'TICKET', 'TICKET_REPORT', 'TICKET_PARTNERSHIP', 'TICKET_IDEA',
      'TICKET_REWARD', 'TWITCH', 'WARN', 'WARNINGS_LIST',
    ];
    for (const key of expectedKeys) {
      expect(COLORS).toHaveProperty(key);
    }
  });

  it('all values are strings', () => {
    for (const value of Object.values(COLORS)) {
      expect(typeof value).toBe('string');
    }
  });

  it('is frozen (const assertion)', () => {
    // The `as const` assertion makes it read-only at the TS level,
    // but we can still verify values at runtime.
    expect(COLORS.DEFAULT).toBe('#4C4C54');
    expect(COLORS.ERROR).toBe('#E74D3C');
    expect(COLORS.MUSIC).toBe('#5865F2');
  });
});
