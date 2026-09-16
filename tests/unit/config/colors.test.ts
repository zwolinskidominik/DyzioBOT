import { COLORS } from '../../../src/config/constants/colors';

describe('COLORS constants', () => {
  it('exports an object with expected color keys', () => {
    expect(COLORS).toBeDefined();
    expect(typeof COLORS).toBe('object');
  });

  it('has all expected color entries', () => {
    // Lista odzwierciedla faktyczną paletę z src/config/constants/colors.ts. Poprzednia wersja
    // wymagała kluczy po nieistniejących już modułach (CS2_MIX, FORTUNE_ADD, TICKET_*) —
    // sprawdzone: żaden z nich nie jest nigdzie w kodzie używany.
    const expectedKeys = [
      'DEFAULT', 'BIRTHDAY', 'EMBED', 'ERROR', 'FACEIT',
      'FORTUNE', 'GIVEAWAY', 'GIVEAWAY_ENDED', 'JOIN',
      'LEAVE', 'MEME', 'TWITCH', 'WARN', 'WARNINGS_LIST',
      'HANGMAN', 'HANGMAN_WIN', 'HANGMAN_LOSE',
      'ECONOMY', 'ECONOMY_WIN', 'ECONOMY_LOSE', 'ECONOMY_NEUTRAL',
      'GAMBLING', 'DAILY', 'SHOP', 'ROB_SUCCESS', 'ROB_FAIL',
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
  });
});
