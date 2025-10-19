import { Client } from 'discord.js';
import { dbManager } from '../setup/db';
import { setupMSW, server } from '../mocks/server';
import { http, HttpResponse } from 'msw';
import { StreamConfigurationModel } from '../../../src/models/StreamConfiguration';
import { TwitchStreamerModel } from '../../../src/models/TwitchStreamer';

// MSW setup (thumbnail fetch + optional helix endpoints if used)
setupMSW();

// Mock node-cron identical style to other scheduler tests
jest.mock('node-cron', () => ({
  schedule: jest.fn((cronExpression: string, callback: any, options: any) => {
    (callback as any).__cronCallback = callback;
    (callback as any).__cronExpression = cronExpression;
    (callback as any).__cronOptions = options;
    return {
      destroy: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    };
  }),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
import logger from '../../../src/utils/logger';
const mockLogger = logger as jest.Mocked<typeof logger>;

// Provide env for Twitch client
jest.mock('../../../src/config', () => ({
  env: () => ({
    NODE_ENV: 'test',
    TWITCH_CLIENT_ID: 'test-client-id',
    TWITCH_CLIENT_SECRET: 'test-client-secret',
  }),
}));

// Minimal embed helper to avoid Discord Builder complexity
jest.mock('../../../src/utils/embedHelpers', () => ({
  createBaseEmbed: jest.fn(() => {
    const embed: any = {
      data: { image: undefined },
      setImage(url: string) {
        this.data.image = url;
        return this;
      },
    };
    return embed;
  }),
}));

// Twurple mocks routed through closures so tests can control responses
const twurpleStubs = {
  getUserByName: jest.fn(),
  getStreamByUserId: jest.fn(),
};

jest.mock('@twurple/auth', () => ({
  AppTokenAuthProvider: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@twurple/api', () => ({
  ApiClient: jest.fn().mockImplementation(() => ({
    users: {
      getUserByName: (...args: any[]) => twurpleStubs.getUserByName(...args),
    },
    streams: {
      getStreamByUserId: (...args: any[]) => twurpleStubs.getStreamByUserId(...args),
    },
  })),
}));

import cron from 'node-cron';

describe('TwitchScheduler Integration Tests', () => {
  let client: Client;
  let guild: any;
  let textChannel: any;
  let streamJob: () => Promise<void>;

  beforeAll(async () => {
    await dbManager.startDb();
  });

  afterAll(async () => {
    await dbManager.stopDb();
  });

  beforeEach(async () => {
    await dbManager.clearCollections();
    jest.clearAllMocks();

    // Discord mocks
    textChannel = {
      id: '123456789012345678',
      type: 0, // GuildText
      send: jest.fn().mockResolvedValue({ id: 'msg-1' }),
    };

    guild = {
      id: 'guild-1',
      channels: {
        cache: new Map([[textChannel.id, textChannel]]),
      },
    };

    client = {
      guilds: {
        cache: new Map([[guild.id, guild]]),
      },
      user: { username: 'TestBot', displayAvatarURL: () => 'https://example.com/av.png' },
    } as any;

    // Default: allow Twitch CDN thumbnail requests to be handled (empty body) to avoid MSW unhandled errors.
    server.use(
      http.get('https://static-cdn.jtvnw.net/:rest*', () => {
        return HttpResponse.arrayBuffer(new ArrayBuffer(0));
      })
    );

    // Import and init scheduler
    const twitchScheduler = require('../../../src/events/ready/twitchScheduler').default;
    await twitchScheduler(client);

    // Capture stream check callback (the */* schedule)
    const calls = (cron.schedule as jest.Mock).mock.calls;
    const streamCall = calls.find((c: any[]) => c[0] === '* * * * *');
    expect(streamCall).toBeTruthy();
    streamJob = streamCall[1];
  });

  afterEach(async () => {
    // Destroy scheduled jobs to avoid dangling timers
    const results = (cron.schedule as jest.Mock).mock.results || [];
    for (const r of results) {
      const handle = r.value;
      if (handle && typeof handle.destroy === 'function') {
        try { handle.destroy(); } catch {}
      }
    }
  });

  describe('Cron registration', () => {
    it('registers cleanup and stream check jobs with timezone', async () => {
      const calls = (cron.schedule as jest.Mock).mock.calls;
      const crons = calls.map((c: any[]) => c[0]);
      expect(crons).toContain('0 0 * * *');
      expect(crons).toContain('* * * * *');

      for (const c of calls) {
        expect(c[2]).toEqual({ timezone: 'Europe/Warsaw' });
        expect(typeof c[1]).toBe('function');
      }
    });
  });

  describe('Stream notifications', () => {
    it('sends notification when streamer goes live (with thumbnail file)', async () => {
      // Arrange DB
  await StreamConfigurationModel.create({ guildId: guild.id, channelId: textChannel.id });
      await TwitchStreamerModel.create({
        guildId: guild.id,
        twitchChannel: 'teststreamer',
        userId: 'user-1',
        isLive: false,
        active: true,
      });

      // Twurple stubs
      twurpleStubs.getUserByName.mockResolvedValue({
        id: '987654321',
        displayName: 'TestStreamer',
        profilePictureUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/profile.png',
      });
      twurpleStubs.getStreamByUserId.mockResolvedValue({
        id: 'stream-1',
        title: 'Live now',
        gameName: 'Counter-Strike 2',
        thumbnailUrl:
          'https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-{width}x{height}.jpg',
      });

      // MSW: serve thumbnail bytes
      server.use(
        http.get('https://static-cdn.jtvnw.net/previews-ttv/:rest*', () => {
          const bytes = new TextEncoder().encode('fake-jpeg');
          return HttpResponse.arrayBuffer(bytes.buffer);
        })
      );

      // Act
      await streamJob();

      // Assert send with file
      expect(textChannel.send).toHaveBeenCalledTimes(1);
      const arg = (textChannel.send as jest.Mock).mock.calls[0][0];
      expect(arg.embeds).toBeDefined();
      expect(arg.files).toBeDefined();
      expect(arg.files[0].name).toBe('thumbnail.jpg');

      const db = await TwitchStreamerModel.findOne({ guildId: guild.id, twitchChannel: 'teststreamer' });
      expect(db?.isLive).toBe(true);
    });

    it('does not send when streamer is offline', async () => {
  await StreamConfigurationModel.create({ guildId: guild.id, channelId: textChannel.id });
      await TwitchStreamerModel.create({
        guildId: guild.id,
        twitchChannel: 'offline_streamer',
        userId: 'u2',
        isLive: false,
        active: true,
      });

      twurpleStubs.getUserByName.mockResolvedValue({ id: 'id-off', displayName: 'Off', profilePictureUrl: '' });
      twurpleStubs.getStreamByUserId.mockResolvedValue(null);

      await streamJob();
      expect(textChannel.send).not.toHaveBeenCalled();

      const db = await TwitchStreamerModel.findOne({ twitchChannel: 'offline_streamer' });
      expect(db?.isLive).toBe(false);
    });

  it('falls back to remote image on thumbnail 429 (no file), but still sends embed', async () => {
      await StreamConfigurationModel.create({ guildId: guild.id, channelId: textChannel.id });
      await TwitchStreamerModel.create({
        guildId: guild.id,
        twitchChannel: 'teststreamer',
        userId: 'user-1',
        isLive: false,
        active: true,
      });

      twurpleStubs.getUserByName.mockResolvedValue({ id: '987654321', displayName: 'TestStreamer', profilePictureUrl: '' });
      twurpleStubs.getStreamByUserId.mockResolvedValue({
        id: 'stream-2',
        title: 'Live now',
        gameName: 'Counter-Strike 2',
        thumbnailUrl:
          'https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-{width}x{height}.jpg',
      });

      // Force undici.fetch to return HTTP 429 for thumbnail request
      const undici: any = require('undici');
      const fetchSpy = jest
        .spyOn(undici, 'fetch')
        .mockResolvedValue({ ok: false, status: 429, arrayBuffer: async () => new ArrayBuffer(0) } as any);

      await streamJob();

  expect(textChannel.send).toHaveBeenCalledTimes(1);
      const arg = (textChannel.send as jest.Mock).mock.calls[0][0];
      expect(arg.embeds).toBeDefined();
      expect(arg.files).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Błąd pobierania miniatury:',
        expect.objectContaining({ message: expect.stringMatching(/HTTP 429/) })
      );

      fetchSpy.mockRestore();
    });

    it('warns and skips when channel is not text-based', async () => {
      // Replace channel with non-text shape
  guild.channels.cache.set('222222222222222222', { id: '222222222222222222', type: 2 });
  await StreamConfigurationModel.create({ guildId: guild.id, channelId: '222222222222222222' });
      await TwitchStreamerModel.create({
        guildId: guild.id,
        twitchChannel: 'teststreamer',
        userId: 'user-1',
        isLive: false,
        active: true,
      });

      twurpleStubs.getUserByName.mockResolvedValue({ id: '987654321', displayName: 'TestStreamer', profilePictureUrl: '' });
      twurpleStubs.getStreamByUserId.mockResolvedValue({
        id: 'stream-3',
        title: 'Live',
        gameName: 'Game',
        thumbnailUrl:
          'https://static-cdn.jtvnw.net/previews-ttv/live_user_teststreamer-{width}x{height}.jpg',
      });

      await streamJob();

      expect(textChannel.send).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('nie jest to kanał tekstowy')
      );
    });
  });
});