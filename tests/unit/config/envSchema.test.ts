import { EnvSchema } from '../../../src/config/env.schema';

describe('config/env.schema', () => {
  test('missing required field -> error', () => {
    const env:any = { CLIENT_ID: 'c', GUILD_ID: 'g', DEV_GUILD_IDS: '1', DEV_USER_IDS: '2', DEV_ROLE_IDS: '3', MONGODB_URI: 'https://x', TOKEN: '' };
    expect(()=> EnvSchema.parse(env)).toThrow(/TOKEN/);
  });

  test('valid environment passes and transforms CSV', () => {
    const env:any = { TOKEN: 't', CLIENT_ID: 'c', GUILD_ID: 'g', DEV_GUILD_IDS: 'a,b', DEV_USER_IDS: 'u1, u2', DEV_ROLE_IDS: 'r1', MONGODB_URI: 'https://x' };
    const parsed = EnvSchema.parse(env);
    expect(parsed.DEV_GUILD_IDS).toEqual(['a','b']);
    expect(parsed.DEV_USER_IDS).toEqual(['u1','u2']);
  });

  test('multiple missing keys reports all issues with names', () => {
    const env: any = {
      CLIENT_ID: '',
      DEV_GUILD_IDS: '',
      DEV_USER_IDS: '',
      DEV_ROLE_IDS: '',
      MONGODB_URI: 'notaurl',
    };
    try {
      EnvSchema.parse(env);
      throw new Error('should not pass');
    } catch (e: any) {
      const errs = e.errors || e.issues || [];
      expect(errs.length).toBeGreaterThanOrEqual(6);
      const joined = JSON.stringify(errs);
      expect(joined).toMatch(/TOKEN|CLIENT_ID|GUILD_ID/);
      expect(joined).toMatch(/DEV_GUILD_IDS|DEV_USER_IDS|DEV_ROLE_IDS/);
      expect(joined).toMatch(/MONGODB_URI/);
    }
  });
});
