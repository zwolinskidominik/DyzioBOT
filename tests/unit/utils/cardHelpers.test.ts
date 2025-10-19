jest.useFakeTimers();

let loadCalls: string[] = [];
let failOnceFor: string | null = null;
let failAlwaysFor: string | null = null;

jest.mock('canvacord', () => {
  return {
    Builder: class {
      width: number;
      height: number;
      options = new Map<string, unknown>();
      constructor(w: number, h: number) {
        this.width = w;
        this.height = h;
      }
      bootstrap() {
        /* no-op */
      }
    },
    loadImage: (src: string) => {
      loadCalls.push(src);
      if (failOnceFor && src.includes(failOnceFor)) {
        failOnceFor = null;
        throw new Error('load fail');
      }
      if (failAlwaysFor && src.includes(failAlwaysFor)) {
        throw new Error('permanent fail');
      }
      return Promise.resolve({
        src,
        toDataURL: () => `data:${src}`,
      });
    },
    JSX: {
      createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }),
    },
  };
});

describe('GreetingsCard', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    loadCalls = [];
    jest.resetModules();
  failAlwaysFor = null;
  });

  test('caches images between renders (no duplicate loadImage calls)', async () => {
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    const card1 = new GreetingsCard()
      .setType('welcome')
      .setDisplayName('User')
      .setAvatar('https://cdn.example/avatar1.png')
      .setMessage('Hello');

    const out1 = card1.render();
    await out1;
    expect(loadCalls.length).toBe(2);

    const card2 = new GreetingsCard()
      .setType('leave')
      .setDisplayName('Other')
      .setAvatar('https://cdn.example/avatar1.png')
      .setMessage('Bye');

    await card2.render();
    expect(loadCalls.length).toBe(2);
  });

  test('retries once for discord CDN avatar failure', async () => {
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    failOnceFor = 'cdn.discordapp.com';
    const avatarUrl = 'https://cdn.discordapp.com/avatars/123.png';
    const card = new GreetingsCard()
      .setType('welcome')
      .setDisplayName('Retry')
      .setAvatar(avatarUrl)
      .setMessage('Hi');

    const renderPromise = card.render();
    jest.advanceTimersByTime(200);
    const out = await renderPromise;

    expect(loadCalls.filter((c) => c === avatarUrl).length).toBe(2);
    expect(loadCalls.length).toBe(3);
    expect(out.type).toBe('div');
  });

  test('falls back to blank avatar after two failures (cdn retry + fallback)', async () => {
    jest.mock('../../../src/utils/logger', () => ({
      __esModule: true,
      default: { warn: jest.fn(), error: jest.fn() },
    }));
    const logger = require('../../../src/utils/logger').default;
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    const avatarUrl = 'https://cdn.discordapp.com/avatars/999.png';
    failAlwaysFor = 'cdn.discordapp.com';
    const card = new GreetingsCard()
      .setType('welcome')
      .setDisplayName('FailUser')
      .setAvatar(avatarUrl)
      .setMessage('Hi');

    const renderPromise = card.render();
    jest.advanceTimersByTime(200);
    const out = await renderPromise;
    const avatarAttempts = loadCalls.filter((c) => c === avatarUrl).length;
    expect(avatarAttempts).toBeGreaterThanOrEqual(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Avatar load failed'));
    expect(out.type).toBe('div');
  });

  test('non-CDN single failure fallback -> uses blank & warns', async () => {
    jest.mock('../../../src/utils/logger', () => ({
      __esModule: true,
      default: { warn: jest.fn(), error: jest.fn() },
    }));
    const logger = require('../../../src/utils/logger').default;
    failAlwaysFor = 'external.example.com';
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    const avatarUrl = 'https://external.example.com/img.png';
    const card = new GreetingsCard().setAvatar(avatarUrl).setDisplayName('X').setMessage('Y');
    await card.render();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Image load failed'));
    const imageCache = (GreetingsCard as any).imageCache as Map<string, any>;
    expect(imageCache.has(avatarUrl)).toBe(true);
  });

  test('LRU eviction removes earliest inserted key when cache exceeds MAX_CACHE', async () => {
    jest.mock('../../../src/utils/logger', () => ({
      __esModule: true,
      default: { warn: jest.fn(), error: jest.fn() },
    }));
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    const imageCache = (GreetingsCard as any).imageCache as Map<string, any>;
    const earlyKeys: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c = new GreetingsCard().setAvatar(`https://cdn.example/seed${i}.png`);
      await c.render();
      earlyKeys.push(`https://cdn.example/seed${i}.png`);
    }
    for (let i = 1; i <= 55; i++) {
      const c = new GreetingsCard().setAvatar(`https://cdn.example/av${i}.png`);
      await c.render();
    }
    expect(imageCache.size).toBe(50);
    const evictedCount = earlyKeys.filter((k) => !imageCache.has(k)).length;
    expect(evictedCount).toBeGreaterThanOrEqual(1);
    expect(imageCache.has('https://cdn.example/av55.png')).toBe(true);
  });

  test('render() catch path: primary pass failure triggers secondary fallback loads', async () => {
    jest.mock('../../../src/utils/logger', () => ({
      __esModule: true,
      default: { warn: jest.fn(), error: jest.fn() },
    }));
    const logger = require('../../../src/utils/logger').default;
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    const orig = (GreetingsCard as any).loadImageCached;
    (GreetingsCard as any).loadImageCached = jest.fn(async () => { throw new Error('boom'); });
    const card = new GreetingsCard().setAvatar('https://cdn.discordapp.com/avatars/err.png').setDisplayName('Err').setMessage('Msg');
    const out = await card.render();
    expect(out.type).toBe('div');
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('primary pass'));
    (GreetingsCard as any).loadImageCached = orig;
  });

  test('setAvatar with null uses blank image path', async () => {
    const { GreetingsCard } = require('../../../src/utils/cardHelpers');
    const card = new GreetingsCard().setAvatar(null as any).setDisplayName('X').setMessage('Y');
    const out = await card.render();
    expect(out.type).toBe('div');
  });
});
