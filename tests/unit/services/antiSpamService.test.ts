/**
 * Tests for antiSpamService — in-memory rate tracking, config cache, spam detection.
 */
import { AntiSpamConfigModel } from '../../../src/models/AntiSpamConfig';
import {
  getConfig,
  trackMessage,
  trackFlood,
  clearUserHistory,
  clearFloodHistory,
  updateConfig,
  _resetForTesting,
  _getTracker,
  startCleanup,
  stopCleanup,
  AntiSpamSettings,
} from '../../../src/services/antiSpamService';

const GID = 'guild-spam';

const DEFAULT: AntiSpamSettings = {
  enabled: false,
  messageThreshold: 5,
  timeWindowMs: 3000,
  action: 'timeout',
  timeoutDurationMs: 5 * 60 * 1000,
  deleteMessages: true,
  ignoredChannels: [],
  ignoredRoles: [],
  blockInviteLinks: false,
  blockMassMentions: false,
  maxMentionsPerMessage: 5,
  blockEveryoneHere: true,
  blockFlood: false,
  floodThreshold: 3,
  floodWindowMs: 30_000,
};

beforeEach(async () => {
  _resetForTesting();
  await AntiSpamConfigModel.deleteMany({});
});

afterAll(() => {
  _resetForTesting();
});

/* ── getConfig ────────────────────────────────────────────── */

describe('getConfig', () => {
  it('returns defaults when no config exists', async () => {
    const cfg = await getConfig(GID);
    expect(cfg).toEqual(DEFAULT);
  });

  it('returns stored config', async () => {
    await AntiSpamConfigModel.create({
      guildId: GID,
      enabled: true,
      messageThreshold: 10,
      timeWindowMs: 5000,
      action: 'warn',
      timeoutDurationMs: 60_000,
      deleteMessages: false,
      ignoredChannels: ['ch-1'],
      ignoredRoles: ['role-1'],
    });

    const cfg = await getConfig(GID);
    expect(cfg.enabled).toBe(true);
    expect(cfg.messageThreshold).toBe(10);
    expect(cfg.timeWindowMs).toBe(5000);
    expect(cfg.action).toBe('warn');
    expect(cfg.timeoutDurationMs).toBe(60_000);
    expect(cfg.deleteMessages).toBe(false);
    expect(cfg.ignoredChannels).toContain('ch-1');
    expect(cfg.ignoredRoles).toContain('role-1');
  });

  it('uses cache on second call', async () => {
    await AntiSpamConfigModel.create({ guildId: GID, enabled: true });

    const cfg1 = await getConfig(GID);
    expect(cfg1.enabled).toBe(true);

    // Change DB behind the scenes — cache should still serve the old value
    await AntiSpamConfigModel.updateOne({ guildId: GID }, { enabled: false });

    const cfg2 = await getConfig(GID);
    expect(cfg2.enabled).toBe(true); // cached
  });
});

/* ── trackMessage ─────────────────────────────────────────── */

describe('trackMessage', () => {
  const settings: AntiSpamSettings = { ...DEFAULT, enabled: true, messageThreshold: 3, timeWindowMs: 5000 };

  it('returns isSpam=false below threshold', () => {
    const r1 = trackMessage(GID, 'u1', settings);
    expect(r1.isSpam).toBe(false);
    expect(r1.messageCount).toBe(1);

    const r2 = trackMessage(GID, 'u1', settings);
    expect(r2.isSpam).toBe(false);
    expect(r2.messageCount).toBe(2);
  });

  it('returns isSpam=true when threshold reached', () => {
    trackMessage(GID, 'u1', settings);
    trackMessage(GID, 'u1', settings);
    const r3 = trackMessage(GID, 'u1', settings);
    expect(r3.isSpam).toBe(true);
    expect(r3.messageCount).toBe(3);
  });

  it('tracks users independently', () => {
    trackMessage(GID, 'u1', settings);
    trackMessage(GID, 'u1', settings);
    const r = trackMessage(GID, 'u2', settings);
    expect(r.isSpam).toBe(false);
    expect(r.messageCount).toBe(1);
  });

  it('tracks guilds independently', () => {
    trackMessage('g1', 'u1', settings);
    trackMessage('g1', 'u1', settings);
    const r = trackMessage('g2', 'u1', settings);
    expect(r.isSpam).toBe(false);
    expect(r.messageCount).toBe(1);
  });

  it('expires old timestamps outside the window', () => {
    const tracker = _getTracker();
    const now = Date.now();
    // Plant old timestamps manually
    tracker.set(`${GID}:u1`, [now - 10_000, now - 9_000]);

    const r = trackMessage(GID, 'u1', settings);
    // Old ones should be filtered out — only the fresh one counts
    expect(r.isSpam).toBe(false);
    expect(r.messageCount).toBe(1);
  });
});

/* ── clearUserHistory ─────────────────────────────────────── */

describe('clearUserHistory', () => {
  it('removes all message timestamps for a user', () => {
    const settings: AntiSpamSettings = { ...DEFAULT, messageThreshold: 10, timeWindowMs: 5000 };
    trackMessage(GID, 'u1', settings);
    trackMessage(GID, 'u1', settings);
    expect(_getTracker().has(`${GID}:u1`)).toBe(true);

    clearUserHistory(GID, 'u1');
    expect(_getTracker().has(`${GID}:u1`)).toBe(false);
  });
});

/* ── updateConfig ─────────────────────────────────────────── */

describe('updateConfig', () => {
  it('creates config when none exists', async () => {
    const result = await updateConfig(GID, { enabled: true, messageThreshold: 8 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings.enabled).toBe(true);
      expect(result.data.settings.messageThreshold).toBe(8);
    }
  });

  it('updates existing config', async () => {
    await AntiSpamConfigModel.create({ guildId: GID, enabled: true, messageThreshold: 5 });

    const result = await updateConfig(GID, { messageThreshold: 12 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings.messageThreshold).toBe(12);
    }
  });

  it('invalidates cache after update', async () => {
    await AntiSpamConfigModel.create({ guildId: GID, enabled: false });
    await getConfig(GID); // populate cache

    await updateConfig(GID, { enabled: true });
    const cfg = await getConfig(GID);
    expect(cfg.enabled).toBe(true);
  });
});

/* ── cleanup timer ────────────────────────────────────────── */

/* ── trackFlood ────────────────────────────────────────────── */

describe('trackFlood', () => {
  const floodSettings: AntiSpamSettings = {
    ...DEFAULT,
    blockFlood: true,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  };

  it('returns isFlood=false when below threshold', () => {
    const r1 = trackFlood(GID, 'u1', 'hello world', 'ch-1', floodSettings);
    expect(r1.isFlood).toBe(false);
    expect(r1.duplicateCount).toBe(1);

    const r2 = trackFlood(GID, 'u1', 'hello world', 'ch-2', floodSettings);
    expect(r2.isFlood).toBe(false);
    expect(r2.duplicateCount).toBe(2);
  });

  it('returns isFlood=true when threshold reached', () => {
    trackFlood(GID, 'u1', 'spam text', 'ch-1', floodSettings);
    trackFlood(GID, 'u1', 'spam text', 'ch-2', floodSettings);
    const r3 = trackFlood(GID, 'u1', 'spam text', 'ch-3', floodSettings);
    expect(r3.isFlood).toBe(true);
    expect(r3.duplicateCount).toBe(3);
    expect(r3.channels).toEqual(expect.arrayContaining(['ch-1', 'ch-2', 'ch-3']));
  });

  it('normalises content (case + whitespace)', () => {
    trackFlood(GID, 'u1', '  Hello  World  ', 'ch-1', floodSettings);
    trackFlood(GID, 'u1', 'hello world', 'ch-2', floodSettings);
    const r = trackFlood(GID, 'u1', 'HELLO WORLD', 'ch-3', floodSettings);
    expect(r.isFlood).toBe(true);
  });

  it('treats different content independently', () => {
    trackFlood(GID, 'u1', 'msg-a', 'ch-1', floodSettings);
    trackFlood(GID, 'u1', 'msg-a', 'ch-2', floodSettings);
    const r = trackFlood(GID, 'u1', 'msg-b', 'ch-3', floodSettings);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);
  });

  it('isolates users', () => {
    trackFlood(GID, 'u1', 'same', 'ch-1', floodSettings);
    trackFlood(GID, 'u1', 'same', 'ch-2', floodSettings);
    const r = trackFlood(GID, 'u2', 'same', 'ch-1', floodSettings);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);
  });

  it('expires entries older than floodWindowMs', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    trackFlood(GID, 'u1', 'old', 'ch-1', floodSettings);
    trackFlood(GID, 'u1', 'old', 'ch-2', floodSettings);

    // advance time past window
    (Date.now as jest.Mock).mockReturnValue(now + 31_000);
    const r = trackFlood(GID, 'u1', 'old', 'ch-3', floodSettings);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);

    (Date.now as jest.Mock).mockRestore();
  });
});

/* ── clearFloodHistory ────────────────────────────────────── */

describe('clearFloodHistory', () => {
  const floodSettings: AntiSpamSettings = {
    ...DEFAULT,
    blockFlood: true,
    floodThreshold: 3,
    floodWindowMs: 30_000,
  };

  it('removes flood entries for the given user', () => {
    trackFlood(GID, 'u1', 'x', 'ch-1', floodSettings);
    trackFlood(GID, 'u1', 'x', 'ch-2', floodSettings);

    clearFloodHistory(GID, 'u1');

    // after clearing, counter resets to 1
    const r = trackFlood(GID, 'u1', 'x', 'ch-3', floodSettings);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);
  });

  it('does not affect other users', () => {
    trackFlood(GID, 'u1', 'y', 'ch-1', floodSettings);
    trackFlood(GID, 'u2', 'y', 'ch-1', floodSettings);
    trackFlood(GID, 'u2', 'y', 'ch-2', floodSettings);

    clearFloodHistory(GID, 'u1');

    const r = trackFlood(GID, 'u2', 'y', 'ch-3', floodSettings);
    expect(r.duplicateCount).toBe(3);
  });
});

/* ── cleanup timer ────────────────────────────────────────── */

describe('cleanup', () => {
  it('startCleanup / stopCleanup do not throw', () => {
    expect(() => startCleanup()).not.toThrow();
    expect(() => stopCleanup()).not.toThrow();
  });
});
