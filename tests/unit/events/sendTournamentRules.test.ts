/**
 * Tests for the refactored sendTournamentRules scheduler.
 *
 * Verifies:
 *  - syncSchedules creates/removes/updates cron tasks per config
 *  - sendTournamentMessage re-reads DB, sends to correct channel
 *  - run() schedules the every-minute sync + does initial sync
 */

/* ── schedule mock ────────────────────────────────────────── */

const stopMock = jest.fn();
const scheduleMock = jest.fn((_cron: string, _cb: Function, _opts?: any) => ({
  stop: stopMock,
}));

jest.mock('node-cron', () => ({
  __esModule: true,
  schedule: scheduleMock,
}));

/* ── logger mock ──────────────────────────────────────────── */

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

/* ── CRON constants ───────────────────────────────────────── */

jest.mock('../../../src/config/constants/cron', () => ({
  CRON: { TOURNAMENT_RULES_DEFAULT: '25 20 * * 1' },
}));

/* ── TournamentConfigModel mock ───────────────────────────── */

const mockFind = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
const mockFindOne = jest.fn().mockResolvedValue(null);

jest.mock('../../../src/models/TournamentConfig', () => ({
  TournamentConfigModel: {
    find: (...args: any[]) => mockFind(...args),
    findOne: (...args: any[]) => mockFindOne(...args),
  },
}));

/* ── Guild config mock ────────────────────────────────────── */

jest.mock('../../../src/config/guild', () => ({
  getGuildConfig: jest.fn().mockReturnValue({
    roles: { tournamentParticipants: 'role-tp', tournamentOrganizer: 'role-org' },
    channels: { tournamentVoice: 'vc-123' },
    tournament: { organizerUserIds: ['user-a', 'user-b'] },
  }),
}));

/* ── imports ──────────────────────────────────────────────── */

import { Collection, ChannelType } from 'discord.js';
import { mockClient } from '../../helpers/discordMocks';

let run: typeof import('../../../src/events/clientReady/sendTournamentRules').default;
let syncSchedules: typeof import('../../../src/events/clientReady/sendTournamentRules').syncSchedules;
let sendTournamentMessage: typeof import('../../../src/events/clientReady/sendTournamentRules').sendTournamentMessage;
let activeTasks: typeof import('../../../src/events/clientReady/sendTournamentRules').activeTasks;

beforeAll(async () => {
  const mod = await import('../../../src/events/clientReady/sendTournamentRules');
  run = mod.default;
  syncSchedules = mod.syncSchedules;
  sendTournamentMessage = mod.sendTournamentMessage;
  activeTasks = mod.activeTasks;
});

beforeEach(() => {
  jest.clearAllMocks();
  activeTasks.clear();
  mockFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
  mockFindOne.mockResolvedValue(null);
});

/* ── run() ────────────────────────────────────────────────── */

describe('run()', () => {
  it('schedules a 1-minute sync cron and does initial syncSchedules', async () => {
    scheduleMock.mockClear();
    const client = mockClient();
    await run(client);

    // Should register the sync schedule (every minute)
    expect(scheduleMock).toHaveBeenCalledWith(
      '* * * * *',
      expect.any(Function),
      expect.objectContaining({ timezone: 'Europe/Warsaw' }),
    );
  });
});

/* ── syncSchedules() ──────────────────────────────────────── */

describe('syncSchedules()', () => {
  const client = mockClient();

  it('does nothing when no configs exist', async () => {
    mockFind.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });
    await syncSchedules(client);
    expect(activeTasks.size).toBe(0);
  });

  it('creates a task for an enabled config', async () => {
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '0 20 * * 5' },
      ]),
    });

    await syncSchedules(client);
    expect(activeTasks.size).toBe(1);
    expect(activeTasks.has('g1')).toBe(true);
    expect(activeTasks.get('g1')!.cron).toBe('0 20 * * 5');

    // schedule called for the guild's cron
    expect(scheduleMock).toHaveBeenCalledWith(
      '0 20 * * 5',
      expect.any(Function),
      expect.objectContaining({ timezone: 'Europe/Warsaw' }),
    );
  });

  it('skips disabled configs', async () => {
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: false, cronSchedule: '0 20 * * 5' },
      ]),
    });

    await syncSchedules(client);
    expect(activeTasks.size).toBe(0);
  });

  it('removes task when config is disabled', async () => {
    // First sync — enabled
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '0 20 * * 5' },
      ]),
    });
    await syncSchedules(client);
    expect(activeTasks.size).toBe(1);

    // Second sync — disabled
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: false },
      ]),
    });
    await syncSchedules(client);
    expect(activeTasks.size).toBe(0);
    expect(stopMock).toHaveBeenCalled();
  });

  it('re-creates task when cron schedule changes', async () => {
    // Initial schedule
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '0 20 * * 5' },
      ]),
    });
    await syncSchedules(client);
    // Verify task was created
    expect(activeTasks.has('g1')).toBe(true);

    // Changed schedule
    stopMock.mockClear();
    scheduleMock.mockClear();
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '30 19 * * 3' },
      ]),
    });
    await syncSchedules(client);

    expect(stopMock).toHaveBeenCalled(); // old task stopped
    expect(scheduleMock).toHaveBeenCalledWith(
      '30 19 * * 3',
      expect.any(Function),
      expect.any(Object),
    );
    expect(activeTasks.get('g1')!.cron).toBe('30 19 * * 3');
  });

  it('does NOT re-create task when cron is unchanged', async () => {
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '0 20 * * 5' },
      ]),
    });
    await syncSchedules(client);
    scheduleMock.mockClear();

    // Same config again
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '0 20 * * 5' },
      ]),
    });
    await syncSchedules(client);

    // Should NOT have called schedule again
    expect(scheduleMock).not.toHaveBeenCalled();
  });

  it('uses TOURNAMENT_RULES_DEFAULT when cronSchedule is empty', async () => {
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '' },
      ]),
    });

    await syncSchedules(client);
    expect(activeTasks.get('g1')!.cron).toBe('25 20 * * 1');
  });

  it('supports multiple guilds simultaneously', async () => {
    mockFind.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { guildId: 'g1', enabled: true, cronSchedule: '0 20 * * 1' },
        { guildId: 'g2', enabled: true, cronSchedule: '0 21 * * 3' },
        { guildId: 'g3', enabled: false },
      ]),
    });

    await syncSchedules(client);
    expect(activeTasks.size).toBe(2);
    expect(activeTasks.has('g1')).toBe(true);
    expect(activeTasks.has('g2')).toBe(true);
    expect(activeTasks.has('g3')).toBe(false);
  });
});

/* ── sendTournamentMessage() ──────────────────────────────── */

describe('sendTournamentMessage()', () => {
  it('does nothing when config not found', async () => {
    mockFindOne.mockResolvedValue(null);
    const client = mockClient();
    await expect(sendTournamentMessage(client, 'g1')).resolves.not.toThrow();
  });

  it('does nothing when config is disabled', async () => {
    mockFindOne.mockResolvedValue({ guildId: 'g1', enabled: false });
    const client = mockClient();
    await expect(sendTournamentMessage(client, 'g1')).resolves.not.toThrow();
  });

  it('warns when channelId is missing', async () => {
    mockFindOne.mockResolvedValue({
      guildId: 'g1',
      enabled: true,
      channelId: null,
      messageTemplate: 'Hello',
    });
    const client = mockClient();
    await sendTournamentMessage(client, 'g1');

    const logger = require('../../../src/utils/logger').default;
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('brak skonfigurowanego kanału'));
  });

  it('warns when channel is not in cache', async () => {
    mockFindOne.mockResolvedValue({
      guildId: 'g1',
      enabled: true,
      channelId: 'ch-unknown',
      messageTemplate: 'Hello',
    });

    const channels = new Collection<string, any>();
    const client = mockClient({ channels: { cache: channels } });

    await sendTournamentMessage(client, 'g1');

    const logger = require('../../../src/utils/logger').default;
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('nie istnieje'));
  });

  it('sends message with replaced variables and reacts', async () => {
    const sendMock = jest.fn().mockResolvedValue({ react: jest.fn().mockResolvedValue(undefined) });
    const channel = {
      type: ChannelType.GuildText,
      guild: { id: 'g1' },
      name: 'turniej',
      send: sendMock,
    };

    const channels = new Collection<string, any>();
    channels.set('ch-1', channel);

    const client = mockClient({ channels: { cache: channels } });

    mockFindOne.mockResolvedValue({
      guildId: 'g1',
      enabled: true,
      channelId: 'ch-1',
      messageTemplate: 'Turniej {roleMention} org:{organizerRoleMention} users:{organizerUserPings} vc:{voiceChannelLink}',
      reactionEmoji: '🎮',
    });

    await sendTournamentMessage(client, 'g1');

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentMsg = sendMock.mock.calls[0][0];
    expect(sentMsg).toContain('<@&role-tp>');
    expect(sentMsg).toContain('<@&role-org>');
    expect(sentMsg).toContain('<@user-a>');
    expect(sentMsg).toContain('<@user-b>');
    expect(sentMsg).toContain('https://discord.com/channels/g1/vc-123');
  });
});
