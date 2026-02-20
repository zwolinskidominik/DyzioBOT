import { EnvSchema } from '../../../src/config/env.schema';

describe('EnvSchema', () => {
  const validEnv = {
    TOKEN: 'some-token',
    CLIENT_ID: 'some-client-id',
    GUILD_ID: 'some-guild-id',
    DEV_GUILD_IDS: 'g1,g2',
    DEV_USER_IDS: 'u1,u2',
    DEV_ROLE_IDS: 'r1',
    MONGODB_URI: 'mongodb://localhost:27017/test',
  };

  it('parses valid base env', () => {
    const result = EnvSchema.parse(validEnv);
    expect(result.TOKEN).toBe('some-token');
    expect(result.CLIENT_ID).toBe('some-client-id');
    expect(result.GUILD_ID).toBe('some-guild-id');
    expect(result.MONGODB_URI).toBe('mongodb://localhost:27017/test');
  });

  it('transforms CSV fields into arrays', () => {
    const result = EnvSchema.parse(validEnv);
    expect(result.DEV_GUILD_IDS).toEqual(['g1', 'g2']);
    expect(result.DEV_USER_IDS).toEqual(['u1', 'u2']);
    expect(result.DEV_ROLE_IDS).toEqual(['r1']);
  });

  it('trims whitespace in CSV values', () => {
    const result = EnvSchema.parse({
      ...validEnv,
      DEV_GUILD_IDS: ' g1 , g2 , g3 ',
    });
    expect(result.DEV_GUILD_IDS).toEqual(['g1', 'g2', 'g3']);
  });

  it('filters empty CSV segments', () => {
    const result = EnvSchema.parse({
      ...validEnv,
      DEV_GUILD_IDS: 'g1,,g2,',
    });
    expect(result.DEV_GUILD_IDS).toEqual(['g1', 'g2']);
  });

  it('fails when TOKEN is missing', () => {
    const { TOKEN, ...rest } = validEnv;
    expect(() => EnvSchema.parse(rest)).toThrow();
  });

  it('fails when TOKEN is empty', () => {
    expect(() => EnvSchema.parse({ ...validEnv, TOKEN: '' })).toThrow();
  });

  it('fails when CLIENT_ID is missing', () => {
    const { CLIENT_ID, ...rest } = validEnv;
    expect(() => EnvSchema.parse(rest)).toThrow();
  });

  it('fails when MONGODB_URI is not a valid URL', () => {
    expect(() => EnvSchema.parse({ ...validEnv, MONGODB_URI: 'not-a-url' })).toThrow();
  });

  it('fails when DEV_GUILD_IDS is missing', () => {
    const { DEV_GUILD_IDS, ...rest } = validEnv;
    expect(() => EnvSchema.parse(rest)).toThrow();
  });

  it('allows optional fields to be absent', () => {
    const result = EnvSchema.parse(validEnv);
    expect(result.TWITCH_CLIENT_ID).toBeUndefined();
    expect(result.TWITCH_CLIENT_SECRET).toBeUndefined();
    expect(result.FACEIT_API_KEY).toBeUndefined();
  });

  it('accepts optional fields when provided', () => {
    const result = EnvSchema.parse({
      ...validEnv,
      TWITCH_CLIENT_ID: 'twitch-id',
      TWITCH_CLIENT_SECRET: 'twitch-secret',
      FACEIT_API_KEY: 'faceit-key',
    });
    expect(result.TWITCH_CLIENT_ID).toBe('twitch-id');
    expect(result.FACEIT_API_KEY).toBe('faceit-key');
  });
});
