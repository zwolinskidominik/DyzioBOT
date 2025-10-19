import { getBotConfig } from '../../../src/config/bot';

describe('config/bot.getBotConfig', () => {
  test('returns specific config for known bot id', () => {
    const cfg = getBotConfig('1119327417237000285');
    expect(cfg.emojis.faceit.levels[10]).toBeDefined();
    expect(typeof cfg.emojis.next).toBe('string');
  });

  test('returns fallback config for unknown id', () => {
    const fallback = getBotConfig('1248419676740915310');
    const missing = getBotConfig('not-a-real-id');
    expect(missing).toEqual(fallback);
  });

  test('known id A and B are distinct objects (no accidental aliasing)', () => {
    const a = getBotConfig('1119327417237000285');
    const b = getBotConfig('1248419676740915310');
    expect(a).not.toBe(b);
    expect(a.emojis.next).not.toBe(b.emojis.next);
  });
});
