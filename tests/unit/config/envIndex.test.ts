// Tests for src/config/index.ts — env() caching

// We must reset modules between tests to test the caching behaviour
describe('env()', () => {
  const VALID_ENV = {
    TOKEN: 'tok',
    CLIENT_ID: 'cid',
    GUILD_ID: 'gid',
    DEV_GUILD_IDS: 'dg1',
    DEV_USER_IDS: 'du1',
    DEV_ROLE_IDS: 'dr1',
    MONGODB_URI: 'mongodb://localhost:27017/test',
  };

  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, ...VALID_ENV };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses env vars on first call', () => {
    const { env } = require('../../../src/config/index');
    const result = env();
    expect(result.TOKEN).toBe('tok');
    expect(result.CLIENT_ID).toBe('cid');
  });

  it('returns cached result on subsequent calls', () => {
    const { env } = require('../../../src/config/index');
    const a = env();
    const b = env();
    expect(a).toBe(b); // strict reference equality
  });

  it('throws on invalid env', () => {
    // Mock dotenv to prevent it from repopulating TOKEN from .env
    jest.mock('dotenv/config', () => {});
    delete process.env.TOKEN;
    const { env } = require('../../../src/config/index');
    expect(() => env()).toThrow();
  });
});
