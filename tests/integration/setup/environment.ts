process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

export const TEST_ENV = {
  MONGO_URI: process.env.TEST_MONGO_URI,
  
  DISCORD_TOKEN: process.env.TEST_DISCORD_TOKEN || 'fake_test_token',
  GUILD_ID: process.env.TEST_GUILD_ID || '123456789012345678',
  
  JEST_TIMEOUT: 30000,
  DB_TIMEOUT: 10000,
  
  SKIP_CANVAS_TESTS: process.env.SKIP_CANVAS_TESTS === 'true',
  SKIP_HTTP_TESTS: process.env.SKIP_HTTP_TESTS === 'true',
  KEEP_TEST_DB: process.env.KEEP_TEST_DB === 'true',
  
  DEBUG_TESTS: process.env.DEBUG_TESTS === 'true',
  VERBOSE_LOGS: process.env.VERBOSE_LOGS === 'true',
};

if (typeof jest !== 'undefined') {
  jest.setTimeout(TEST_ENV.JEST_TIMEOUT);
}

export default TEST_ENV;