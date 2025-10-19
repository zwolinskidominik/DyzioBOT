import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';

describe('Config Index Module', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear module cache to test fresh imports
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('env() function', () => {
    it('should export env function', () => {
      const configModule = require('../../../src/config/index');
      expect(typeof configModule.env).toBe('function');
    });

    it('should return parsed environment variables', () => {
      // Set up test environment variables
      process.env.TOKEN = 'test-discord-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test-uri';
      process.env.DEV_GUILD_IDS = 'guild1,guild2';
      process.env.DEV_USER_IDS = 'user1,user2';
      process.env.DEV_ROLE_IDS = 'role1,role2';

      const { env } = require('../../../src/config/index');
      const config = env();

      expect(config).toBeDefined();
      expect(config.TOKEN).toBe('test-discord-token');
      expect(config.CLIENT_ID).toBe('test-client-id');
      expect(config.GUILD_ID).toBe('test-guild-id');
      expect(config.MONGODB_URI).toBe('mongodb://test-uri');
      expect(Array.isArray(config.DEV_GUILD_IDS)).toBe(true);
      expect(Array.isArray(config.DEV_USER_IDS)).toBe(true);
      expect(Array.isArray(config.DEV_ROLE_IDS)).toBe(true);
    });

    it('should cache the result on subsequent calls', () => {
      // Set up test environment variables
      process.env.TOKEN = 'test-discord-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test-uri';
      process.env.DEV_GUILD_IDS = 'guild1,guild2';
      process.env.DEV_USER_IDS = 'user1,user2';
      process.env.DEV_ROLE_IDS = 'role1,role2';

      const { env } = require('../../../src/config/index');
      
      const config1 = env();
      const config2 = env();

      // Should return the same object reference (cached)
      expect(config1).toBe(config2);
    });

    it('should parse comma-separated strings into arrays', () => {
      process.env.TOKEN = 'test-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test';
      process.env.DEV_GUILD_IDS = 'guild1,guild2,guild3';
      process.env.DEV_USER_IDS = 'user1,user2';
      process.env.DEV_ROLE_IDS = 'role1';

      const { env } = require('../../../src/config/index');
      const config = env();

      expect(config.DEV_GUILD_IDS).toEqual(['guild1', 'guild2', 'guild3']);
      expect(config.DEV_USER_IDS).toEqual(['user1', 'user2']);
      expect(config.DEV_ROLE_IDS).toEqual(['role1']);
    });

    it('should handle single values in comma-separated strings', () => {
      process.env.TOKEN = 'test-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test';
      process.env.DEV_GUILD_IDS = 'single-guild';
      process.env.DEV_USER_IDS = 'single-user';
      process.env.DEV_ROLE_IDS = 'single-role';

      const { env } = require('../../../src/config/index');
      const config = env();

      expect(config.DEV_GUILD_IDS).toEqual(['single-guild']);
      expect(config.DEV_USER_IDS).toEqual(['single-user']);
      expect(config.DEV_ROLE_IDS).toEqual(['single-role']);
    });
  });

  describe('Module structure', () => {
    it('should import dotenv/config', () => {
      const fs = require('fs');
      const path = require('path');
      
      const configPath = path.join(__dirname, '../../../src/config/index.ts');
      const content = fs.readFileSync(configPath, 'utf8');
      
      expect(content).toContain("import 'dotenv/config'");
    });

    it('should import EnvSchema from env.schema', () => {
      const fs = require('fs');
      const path = require('path');
      
      const configPath = path.join(__dirname, '../../../src/config/index.ts');
      const content = fs.readFileSync(configPath, 'utf8');
      
      expect(content).toContain("import { EnvSchema, type Env } from './env.schema'");
    });

    it('should use caching mechanism', () => {
      const fs = require('fs');
      const path = require('path');
      
      const configPath = path.join(__dirname, '../../../src/config/index.ts');
      const content = fs.readFileSync(configPath, 'utf8');
      
      expect(content).toContain('let cache: Env | null = null');
      expect(content).toContain('if (cache) return cache');
      expect(content).toContain('cache = EnvSchema.parse(process.env)');
    });

    it('should use Zod schema parsing', () => {
      const fs = require('fs');
      const path = require('path');
      
      const configPath = path.join(__dirname, '../../../src/config/index.ts');
      const content = fs.readFileSync(configPath, 'utf8');
      
      expect(content).toContain('EnvSchema.parse(process.env)');
    });
  });

  describe('Error handling', () => {
    it('should handle optional environment variables', () => {
      // Set up all required variables plus optional ones
      process.env.TOKEN = 'test-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test';
      process.env.DEV_GUILD_IDS = 'guild1';
      process.env.DEV_USER_IDS = 'user1';
      process.env.DEV_ROLE_IDS = 'role1';
      process.env.TOURNAMENT_CHANNEL_ID = 'tournament-channel';
      process.env.TWITCH_CLIENT_ID = 'twitch-client-id';
      process.env.TWITCH_CLIENT_SECRET = 'twitch-secret';
      process.env.FACEIT_API_KEY = 'faceit-key';

      const { env } = require('../../../src/config/index');
      const config = env();

      expect(config.TOURNAMENT_CHANNEL_ID).toBe('tournament-channel');
      expect(config.TWITCH_CLIENT_ID).toBe('twitch-client-id');
      expect(config.TWITCH_CLIENT_SECRET).toBe('twitch-secret');
      expect(config.FACEIT_API_KEY).toBe('faceit-key');
    });

    it('should throw validation error for empty required string fields', () => {
      process.env.TOKEN = ''; // Empty token should be invalid
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test';
      process.env.DEV_GUILD_IDS = 'guild1';
      process.env.DEV_USER_IDS = 'user1';
      process.env.DEV_ROLE_IDS = 'role1';

      const { env } = require('../../../src/config/index');
      
      expect(() => env()).toThrow();
    });

    it('should throw validation error for invalid MONGODB_URI', () => {
      process.env.TOKEN = 'valid-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'invalid-uri'; // Invalid URL format
      process.env.DEV_GUILD_IDS = 'guild1';
      process.env.DEV_USER_IDS = 'user1';
      process.env.DEV_ROLE_IDS = 'role1';

      const { env } = require('../../../src/config/index');
      
      expect(() => env()).toThrow();
    });

    it('should throw validation error for empty DEV_GUILD_IDS', () => {
      process.env.TOKEN = 'valid-token';
      process.env.CLIENT_ID = 'test-client-id';
      process.env.GUILD_ID = 'test-guild-id';
      process.env.MONGODB_URI = 'mongodb://test';
      process.env.DEV_GUILD_IDS = ''; // Empty string should be invalid
      process.env.DEV_USER_IDS = 'user1';
      process.env.DEV_ROLE_IDS = 'role1';

      const { env } = require('../../../src/config/index');
      
      expect(() => env()).toThrow();
    });
  });
});