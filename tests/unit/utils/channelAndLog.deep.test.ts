/**
 * Deep tests for channelHelpers and logHelpers.
 */

jest.mock('../../../src/utils/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

jest.mock('../../../src/models/ChannelStats', () => ({
  ChannelStatsModel: {
    findOne: jest.fn(),
  },
}));

jest.mock('../../../src/models/LogConfiguration', () => ({
  LogConfigurationModel: {
    findOne: jest.fn().mockReturnValue({ lean: jest.fn() }),
  },
}));

jest.mock('../../../src/interfaces/LogEvent', () => ({
  LOG_EVENT_CONFIGS: {
    channelCreate: { color: 0x00ff00, emoji: '📢', name: 'Channel Created' },
    channelDelete: { color: 0xff0000, emoji: '🗑️', name: 'Channel Deleted' },
    messageDelete: { color: 0xff0000, emoji: '🗑️', name: 'Message Deleted' },
  },
}));

/* ═══════════════ channelHelpers ═══════════════ */
import {
  safeSetChannelName,
  updateChannelName,
  updateChannelStats,
} from '../../../src/utils/channelHelpers';

describe('channelHelpers', () => {
  describe('safeSetChannelName', () => {
    it('does nothing when name is the same', async () => {
      const channel = { id: 'ch1', name: 'test', setName: jest.fn() };
      await safeSetChannelName(channel as any, 'test');
      expect(channel.setName).not.toHaveBeenCalled();
    });

    it('sets new name', async () => {
      const channel = { id: 'ch2', name: 'old', setName: jest.fn().mockResolvedValue(undefined) };
      await safeSetChannelName(channel as any, 'new');
      expect(channel.setName).toHaveBeenCalledWith('new');
    });

    it('handles missing permissions error (code 50013)', async () => {
      const channel = {
        id: 'ch3',
        name: 'old',
        setName: jest.fn().mockRejectedValue({ code: 50_013 }),
      };
      await safeSetChannelName(channel as any, 'new');
      // Should not throw, just logs
    });

    it('retries on rate limit (429)', async () => {
      let calls = 0;
      const channel = {
        id: 'ch4',
        name: 'old',
        setName: jest.fn().mockImplementation(() => {
          calls++;
          if (calls === 1) return Promise.reject({ httpStatus: 429 });
          return Promise.resolve();
        }),
      };
      await safeSetChannelName(channel as any, 'new', 2, 10);
      expect(channel.setName).toHaveBeenCalledTimes(2);
    });

    it('throws non-rate-limit errors', async () => {
      const channel = {
        id: 'ch5',
        name: 'old',
        setName: jest.fn().mockRejectedValue(new Error('Unknown')),
      };
      await expect(safeSetChannelName(channel as any, 'new')).rejects.toThrow('Unknown');
    });
  });

  describe('updateChannelName', () => {
    it('does nothing when config has no channelId', async () => {
      const guild = { channels: { cache: new Map() } } as any;
      await updateChannelName(guild, undefined, 'val');
      await updateChannelName(guild, {}, 'val');
      await updateChannelName(guild, { channelId: '' }, 'val');
    });

    it('updates channel name with template', async () => {
      const setName = jest.fn().mockResolvedValue(undefined);
      const guild = {
        channels: {
          cache: new Map([['ch1', { id: 'ch1', name: 'old', setName, type: 0 }]]),
        },
      } as any;
      await updateChannelName(guild, { channelId: 'ch1', template: 'Users: {count}' }, 42);
    });

    it('replaces {count} in template', async () => {
      const setName = jest.fn().mockResolvedValue(undefined);
      const ch = { id: 'ch1', name: 'Users: 0', setName };
      const guild = { channels: { cache: new Map([['ch1', ch]]) } } as any;
      await updateChannelName(guild, { channelId: 'ch1', template: 'Users: {count}' }, 42);
      expect(setName).toHaveBeenCalledWith('Users: 42');
    });

    it('handles missing channel gracefully', async () => {
      const guild = { channels: { cache: new Map() } } as any;
      await updateChannelName(guild, { channelId: 'missing' }, 0);
      // Should not throw
    });
  });

  describe('updateChannelStats', () => {
    const { ChannelStatsModel } = require('../../../src/models/ChannelStats');

    it('does nothing when no config found', async () => {
      ChannelStatsModel.findOne.mockResolvedValue(null);
      const guild = { id: 'g1' } as any;
      await updateChannelStats(guild);
    });

    it('updates channels when config exists', async () => {
      const setName = jest.fn().mockResolvedValue(undefined);
      const save = jest.fn().mockResolvedValue(undefined);
      ChannelStatsModel.findOne.mockResolvedValue({
        channels: {
          users: { channelId: 'chUsers', template: 'Users: {count}' },
        },
        save,
      });

      const membersData: [string, any][] = [
        ['u1', { user: { bot: false, username: 'User1' }, joinedTimestamp: 1000, id: 'u1' }],
        ['b1', { user: { bot: true, username: 'Bot1' }, joinedTimestamp: 2000, id: 'b1' }],
      ];
      const members = new Map(membersData);
      (members as any).filter = (fn: Function) => {
        const result = new Map();
        for (const [k, v] of members) if (fn(v, k)) result.set(k, v);
        return result;
      };

      const guild = {
        id: 'g-chanstats',
        memberCount: 2,
        members: { cache: members, fetch: jest.fn().mockResolvedValue(undefined) },
        channels: {
          cache: new Map([['chUsers', { id: 'chUsers', name: 'Users: 0', setName }]]),
        },
        bans: { cache: new Map(), fetch: jest.fn().mockResolvedValue(new Map()) },
      } as any;

      // Should complete without throwing
      await updateChannelStats(guild);
    });
  });
});

/* ═══════════════ logHelpers ═══════════════ */
import { createLogEmbed, sendLog, truncate } from '../../../src/utils/logHelpers';

describe('logHelpers', () => {
  describe('createLogEmbed', () => {
    it('creates embed with event config', () => {
      const embed = createLogEmbed('channelCreate' as any, {
        description: 'A channel was created',
      });
      expect(embed).toBeDefined();
      expect(embed.data.description).toBe('A channel was created');
    });

    it('sets default title from config', () => {
      const embed = createLogEmbed('channelCreate' as any, {});
      expect(embed.data.title).toContain('Channel Created');
    });

    it('uses custom title when provided', () => {
      const embed = createLogEmbed('channelCreate' as any, { title: 'Custom' });
      expect(embed.data.title).toBe('Custom');
    });

    it('sets null title when title=null', () => {
      const embed = createLogEmbed('channelCreate' as any, { title: null });
      expect(embed.data.title).toBeUndefined();
    });

    it('adds fields', () => {
      const embed = createLogEmbed('channelCreate' as any, {
        fields: [{ name: 'Field1', value: 'Val1' }],
      });
      expect(embed.data.fields).toHaveLength(1);
    });

    it('sets author', () => {
      const embed = createLogEmbed('channelCreate' as any, {
        authorName: 'Bot',
        authorIcon: 'https://example.com/icon.png',
      });
      expect(embed.data.author?.name).toBe('Bot');
    });

    it('sets image', () => {
      const embed = createLogEmbed('channelCreate' as any, {
        image: 'https://example.com/img.png',
      });
      expect(embed.data.image?.url).toBe('https://example.com/img.png');
    });

    it('sets thumbnail', () => {
      const embed = createLogEmbed('channelCreate' as any, {
        thumbnail: 'https://example.com/thumb.png',
      });
      expect(embed.data.thumbnail?.url).toBe('https://example.com/thumb.png');
    });

    it('sets footer', () => {
      const embed = createLogEmbed('channelCreate' as any, {
        footer: 'Footer text',
        footerIcon: 'https://example.com/ficon.png',
      });
      expect(embed.data.footer?.text).toBe('Footer text');
    });

    it('handles Date timestamp', () => {
      const date = new Date('2026-01-01');
      const embed = createLogEmbed('channelCreate' as any, { timestamp: date });
      expect(embed.data.timestamp).toBeDefined();
    });

    it('handles false timestamp', () => {
      const embed = createLogEmbed('channelCreate' as any, { timestamp: false });
      // No timestamp set
    });
  });

  describe('sendLog', () => {
    const { LogConfigurationModel } = require('../../../src/models/LogConfiguration');

    it('returns when no config', async () => {
      LogConfigurationModel.findOne.mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
      const client = { guilds: { cache: new Map() } } as any;
      await sendLog(client, 'g1', 'channelCreate' as any, {});
    });

    it('returns when event not enabled', async () => {
      LogConfigurationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          guildId: 'g1',
          enabled: true,
          enabledEvents: { channelCreate: false },
          logChannels: {},
        }),
      });
      const client = { guilds: { cache: new Map() } } as any;
      await sendLog(client, 'g1', 'channelCreate' as any, {});
    });

    it('sends log when properly configured', async () => {
      const send = jest.fn().mockResolvedValue(undefined);
      LogConfigurationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          guildId: 'g1',
          enabled: true,
          enabledEvents: { channelCreate: true },
          logChannels: { channelCreate: 'logCh1' },
        }),
      });
      const client = {
        guilds: {
          cache: new Map([
            ['g1', { channels: { cache: new Map([['logCh1', { send }]]) } }],
          ]),
        },
      } as any;
      await sendLog(client, 'g1', 'channelCreate' as any, { description: 'test' });
      expect(send).toHaveBeenCalled();
    });

    it('respects ignored channels', async () => {
      const send = jest.fn();
      LogConfigurationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          guildId: 'g1',
          enabledEvents: { channelCreate: true },
          logChannels: { channelCreate: 'logCh1' },
          ignoredChannels: ['ignoredCh'],
        }),
      });
      const client = {
        guilds: { cache: new Map([['g1', { channels: { cache: new Map([['logCh1', { send }]]) } }]]) },
      } as any;
      await sendLog(client, 'g1', 'channelCreate' as any, {}, { channelId: 'ignoredCh' });
      expect(send).not.toHaveBeenCalled();
    });

    it('respects ignored users', async () => {
      const send = jest.fn();
      LogConfigurationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          guildId: 'g1',
          enabledEvents: { channelCreate: true },
          logChannels: { channelCreate: 'logCh1' },
          ignoredUsers: ['ignoredUser'],
        }),
      });
      const client = {
        guilds: { cache: new Map([['g1', { channels: { cache: new Map([['logCh1', { send }]]) } }]]) },
      } as any;
      await sendLog(client, 'g1', 'channelCreate' as any, {}, { userId: 'ignoredUser' });
      expect(send).not.toHaveBeenCalled();
    });

    it('respects ignored roles', async () => {
      const send = jest.fn();
      LogConfigurationModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          guildId: 'g1',
          enabledEvents: { channelCreate: true },
          logChannels: { channelCreate: 'logCh1' },
          ignoredRoles: ['ignoredRole'],
        }),
      });
      const client = {
        guilds: { cache: new Map([['g1', { channels: { cache: new Map([['logCh1', { send }]]) } }]]) },
      } as any;
      const member = { roles: { cache: new Map([['ignoredRole', true]]) } } as any;
      await sendLog(client, 'g1', 'channelCreate' as any, {}, { member });
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('truncate', () => {
    it('returns short text unchanged', () => {
      expect(truncate('hello', 100)).toBe('hello');
    });
    it('truncates with ellipsis', () => {
      const long = 'a'.repeat(200);
      const result = truncate(long, 50);
      expect(result.length).toBe(50);
      expect(result.endsWith('...')).toBe(true);
    });
    it('uses default max of 1024', () => {
      const long = 'a'.repeat(2000);
      expect(truncate(long).length).toBe(1024);
    });
  });
});
