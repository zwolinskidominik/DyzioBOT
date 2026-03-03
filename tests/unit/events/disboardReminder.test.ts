/**
 * Unit tests for Disboard review reminder scheduler + computeNextSendAt.
 */

/* ── Mocks ─────────────────────────────────────────────────── */
const scheduleMock = jest.fn((_cron: string, cb: Function, _opts?: any) => {
  (scheduleMock as any)._lastCb = cb;
  return { stop: jest.fn() };
});

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: scheduleMock },
  schedule: scheduleMock,
}));

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../../src/config/constants/cron', () => ({
  CRON: { DISBOARD_REMINDER_CHECK: '0 * * * *' },
}));

const mockFindLean = jest.fn();
const mockFind = jest.fn().mockReturnValue({ lean: mockFindLean });
const mockUpdateOne = jest.fn();

jest.mock('../../../src/models/DisboardConfig', () => ({
  DisboardConfigModel: {
    find: mockFind,
    updateOne: mockUpdateOne,
  },
  DEFAULT_DISBOARD_MESSAGE: 'Default disboard message',
}));

import { mockClient, mockGuild, mockTextChannel } from '../../helpers/discordMocks';
import { Collection, ChannelType } from 'discord.js';

/* ── computeNextSendAt (pure function) ─────────────────────── */
describe('computeNextSendAt', () => {
  let computeNextSendAt: typeof import('../../../src/events/clientReady/disboardReminder').computeNextSendAt;

  beforeAll(async () => {
    const mod = await import('../../../src/events/clientReady/disboardReminder');
    computeNextSendAt = mod.computeNextSendAt;
  });

  it('returns a date in the future', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    const next = computeNextSendAt(now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });

  it('returns a date between 12 and 18 days ahead', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    // Run many times to cover random range
    for (let i = 0; i < 50; i++) {
      const next = computeNextSendAt(now);
      const diffDays = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeGreaterThanOrEqual(11.5); // 12 days minus hour variance
      expect(diffDays).toBeLessThanOrEqual(19.5); // 18 days + up to ~20h
    }
  });

  it('returns a date with hour between 10 and 20', () => {
    const now = new Date('2026-03-01T12:00:00Z');
    for (let i = 0; i < 50; i++) {
      const next = computeNextSendAt(now);
      expect(next.getHours()).toBeGreaterThanOrEqual(10);
      expect(next.getHours()).toBeLessThanOrEqual(20);
    }
  });
});

/* ── Scheduler (run) ──────────────────────────────────────── */
describe('disboardReminder scheduler', () => {
  let run: typeof import('../../../src/events/clientReady/disboardReminder').default;

  beforeAll(async () => {
    run = (await import('../../../src/events/clientReady/disboardReminder')).default;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockFind.mockReturnValue({ lean: mockFindLean });
    mockFindLean.mockResolvedValue([]);
    mockUpdateOne.mockResolvedValue({});
  });

  it('registers a cron schedule', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);
    expect(scheduleMock).toHaveBeenCalledWith(
      '0 * * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'Europe/Warsaw' }),
    );
  });

  it('does nothing when no enabled configs exist', async () => {
    const client = mockClient();
    await run(client);

    mockFindLean.mockResolvedValue([]);
    const cb = (scheduleMock as any)._lastCb;
    await cb();

    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('computes initial nextSendAt when null', async () => {
    const client = mockClient();
    await run(client);

    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: 'ch1', nextSendAt: null },
    ]);

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    expect(mockUpdateOne).toHaveBeenCalledWith(
      { guildId: 'g1' },
      { $set: { nextSendAt: expect.any(Date) } },
    );
  });

  it('skips guild if nextSendAt is in the future', async () => {
    const client = mockClient();
    await run(client);

    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: 'ch1', nextSendAt: futureDate },
    ]);

    const channel = mockTextChannel({ id: 'ch1' });
    const guild = mockGuild({ id: 'g1' });
    guild.channels = { cache: new Collection([['ch1', channel]]) } as any;
    client.guilds = { cache: new Collection([['g1', guild]]) } as any;

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    // No send, no update
    expect(channel.send).not.toHaveBeenCalled();
  });

  it('sends message and updates DB when nextSendAt is in the past', async () => {
    const client = mockClient();
    await run(client);

    const pastDate = new Date(Date.now() - 60 * 1000);
    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: 'ch1', message: 'Custom reminder', nextSendAt: pastDate },
    ]);

    const channel = mockTextChannel({ id: 'ch1' });
    channel.type = ChannelType.GuildText;
    const guild = mockGuild({ id: 'g1' });
    guild.channels = { cache: new Collection([['ch1', channel]]) } as any;
    client.guilds = { cache: new Collection([['g1', guild]]) } as any;

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    expect(channel.send).toHaveBeenCalledWith('Custom reminder');
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { guildId: 'g1' },
      {
        $set: {
          lastSentAt: expect.any(Date),
          nextSendAt: expect.any(Date),
        },
      },
    );
  });

  it('falls back to default message when config.message is empty', async () => {
    const client = mockClient();
    await run(client);

    const pastDate = new Date(Date.now() - 60 * 1000);
    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: 'ch1', message: '', nextSendAt: pastDate },
    ]);

    const channel = mockTextChannel({ id: 'ch1' });
    channel.type = ChannelType.GuildText;
    const guild = mockGuild({ id: 'g1' });
    guild.channels = { cache: new Collection([['ch1', channel]]) } as any;
    client.guilds = { cache: new Collection([['g1', guild]]) } as any;

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    expect(channel.send).toHaveBeenCalledWith('Default disboard message');
  });

  it('skips when channelId is empty', async () => {
    const client = mockClient();
    await run(client);

    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: '', nextSendAt: new Date(Date.now() - 1000) },
    ]);

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it('warns when channel does not exist', async () => {
    const client = mockClient();
    await run(client);

    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: 'missing', nextSendAt: new Date(Date.now() - 1000) },
    ]);

    const guild = mockGuild({ id: 'g1' });
    guild.channels = { cache: new Collection() } as any;
    client.guilds = { cache: new Collection([['g1', guild]]) } as any;

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    const logger = require('../../../src/utils/logger').default;
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('missing'));
  });

  it('handles error in individual guild without breaking loop', async () => {
    const client = mockClient();
    await run(client);

    mockFindLean.mockResolvedValue([
      { guildId: 'g1', enabled: true, channelId: 'ch1', nextSendAt: new Date(Date.now() - 1000) },
      { guildId: 'g2', enabled: true, channelId: 'ch2', nextSendAt: new Date(Date.now() - 1000) },
    ]);

    const channel1 = mockTextChannel({ id: 'ch1' });
    channel1.type = ChannelType.GuildText;
    channel1.send = jest.fn().mockRejectedValue(new Error('no perms'));

    const channel2 = mockTextChannel({ id: 'ch2' });
    channel2.type = ChannelType.GuildText;

    const guild1 = mockGuild({ id: 'g1' });
    guild1.channels = { cache: new Collection([['ch1', channel1]]) } as any;

    const guild2 = mockGuild({ id: 'g2' });
    guild2.channels = { cache: new Collection([['ch2', channel2]]) } as any;

    client.guilds = { cache: new Collection([['g1', guild1], ['g2', guild2]]) } as any;

    const cb = (scheduleMock as any)._lastCb;
    await cb();

    // guild1 failed but guild2 still sent
    expect(channel2.send).toHaveBeenCalledWith('Default disboard message');
  });
});
