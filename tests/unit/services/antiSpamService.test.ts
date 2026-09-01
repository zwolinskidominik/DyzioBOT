/**
 * Tests for antiSpamService — in-memory rate/repeat tracking, config cache,
 * per-rule escalation (ladder) i incydenty.
 */
import { AntiSpamConfigModel } from '../../../src/models/AntiSpamConfig';
import { AntiSpamIncidentModel } from '../../../src/models/AntiSpamIncident';
import {
  getConfig,
  trackMessage,
  trackFlood,
  clearUserHistory,
  clearFloodHistory,
  updateConfig,
  getNextPunishment,
  recordIncident,
  countRecentIncidents,
  _resetForTesting,
  _getTracker,
  startCleanup,
  stopCleanup,
  AntiSpamRuleSettings,
} from '../../../src/services/antiSpamService';

const GID = 'guild-spam';

const BASE_RULE: AntiSpamRuleSettings = {
  on: true,
  deleteMessage: true,
  mode: 'single',
  action: 'mute',
  steps: ['warn'],
  muteDuration: '5',
  reset: '24',
  threshold: 5,
  windowSeconds: 3,
  allowOwnServerInvites: true,
};

beforeEach(async () => {
  _resetForTesting();
  await AntiSpamConfigModel.deleteMany({});
  await AntiSpamIncidentModel.deleteMany({});
});

afterAll(() => {
  _resetForTesting();
});

/* ── getConfig ────────────────────────────────────────────── */

describe('getConfig', () => {
  it('returns sane defaults when no config exists', async () => {
    const cfg = await getConfig(GID);
    expect(cfg.enabled).toBe(false);
    expect(cfg.ignoredChannels).toEqual([]);
    expect(cfg.ignoredRoles).toEqual([]);
    expect(cfg.rate.on).toBe(true);
    expect(cfg.rate.threshold).toBe(5);
    expect(cfg.rate.windowSeconds).toBe(3);
    expect(cfg.invites.on).toBe(false);
    expect(cfg.mentions.on).toBe(false);
    expect(cfg.repeat.on).toBe(false);
  });

  it('returns stored nested rule config', async () => {
    await AntiSpamConfigModel.create({
      guildId: GID,
      enabled: true,
      rate: { ...BASE_RULE, threshold: 10, windowSeconds: 5, action: 'warn', deleteMessage: false },
      ignoredChannels: ['ch-1'],
      ignoredRoles: ['role-1'],
    });

    const cfg = await getConfig(GID);
    expect(cfg.enabled).toBe(true);
    expect(cfg.rate.threshold).toBe(10);
    expect(cfg.rate.windowSeconds).toBe(5);
    expect(cfg.rate.action).toBe('warn');
    expect(cfg.rate.deleteMessage).toBe(false);
    expect(cfg.ignoredChannels).toContain('ch-1');
    expect(cfg.ignoredRoles).toContain('role-1');
  });

  it('uses cache on second call', async () => {
    await AntiSpamConfigModel.create({ guildId: GID, enabled: true });

    const cfg1 = await getConfig(GID);
    expect(cfg1.enabled).toBe(true);

    // Change DB behind the scenes — cache should still serve the old value
    await AntiSpamConfigModel.updateOne({ guildId: GID }, { $set: { enabled: false } });

    const cfg2 = await getConfig(GID);
    expect(cfg2.enabled).toBe(true); // cached
  });
});

/* ── trackMessage (reguła 'rate') ─────────────────────────── */

describe('trackMessage', () => {
  const rule: AntiSpamRuleSettings = { ...BASE_RULE, threshold: 3, windowSeconds: 5 };

  it('returns isSpam=false below threshold', () => {
    const r1 = trackMessage(GID, 'u1', rule);
    expect(r1.isSpam).toBe(false);
    expect(r1.messageCount).toBe(1);

    const r2 = trackMessage(GID, 'u1', rule);
    expect(r2.isSpam).toBe(false);
    expect(r2.messageCount).toBe(2);
  });

  it('returns isSpam=true when threshold reached', () => {
    trackMessage(GID, 'u1', rule);
    trackMessage(GID, 'u1', rule);
    const r3 = trackMessage(GID, 'u1', rule);
    expect(r3.isSpam).toBe(true);
    expect(r3.messageCount).toBe(3);
  });

  it('tracks users independently', () => {
    trackMessage(GID, 'u1', rule);
    trackMessage(GID, 'u1', rule);
    const r = trackMessage(GID, 'u2', rule);
    expect(r.isSpam).toBe(false);
    expect(r.messageCount).toBe(1);
  });

  it('tracks guilds independently', () => {
    trackMessage('g1', 'u1', rule);
    trackMessage('g1', 'u1', rule);
    const r = trackMessage('g2', 'u1', rule);
    expect(r.isSpam).toBe(false);
    expect(r.messageCount).toBe(1);
  });

  it('expires old timestamps outside the window', () => {
    const tracker = _getTracker();
    const now = Date.now();
    tracker.set(`${GID}:u1`, [now - 10_000, now - 9_000]);

    const r = trackMessage(GID, 'u1', rule);
    expect(r.isSpam).toBe(false);
    expect(r.messageCount).toBe(1);
  });
});

/* ── clearUserHistory ─────────────────────────────────────── */

describe('clearUserHistory', () => {
  it('removes all message timestamps for a user', () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, threshold: 10, windowSeconds: 5 };
    trackMessage(GID, 'u1', rule);
    trackMessage(GID, 'u1', rule);
    expect(_getTracker().has(`${GID}:u1`)).toBe(true);

    clearUserHistory(GID, 'u1');
    expect(_getTracker().has(`${GID}:u1`)).toBe(false);
  });
});

/* ── updateConfig ─────────────────────────────────────────── */

describe('updateConfig', () => {
  it('creates config when none exists', async () => {
    const result = await updateConfig(GID, { enabled: true });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings.enabled).toBe(true);
    }
  });

  it('updates existing config', async () => {
    await AntiSpamConfigModel.create({ guildId: GID, enabled: true });

    const result = await updateConfig(GID, { ignoredChannels: ['ch-9'] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.settings.ignoredChannels).toContain('ch-9');
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

/* ── trackFlood (reguła 'repeat') ─────────────────────────── */

describe('trackFlood', () => {
  const rule: AntiSpamRuleSettings = { ...BASE_RULE, threshold: 3, windowSeconds: 30 };

  it('returns isFlood=false when below threshold', () => {
    const r1 = trackFlood(GID, 'u1', 'hello world', 'ch-1', rule);
    expect(r1.isFlood).toBe(false);
    expect(r1.duplicateCount).toBe(1);

    const r2 = trackFlood(GID, 'u1', 'hello world', 'ch-2', rule);
    expect(r2.isFlood).toBe(false);
    expect(r2.duplicateCount).toBe(2);
  });

  it('returns isFlood=true when threshold reached', () => {
    trackFlood(GID, 'u1', 'spam text', 'ch-1', rule);
    trackFlood(GID, 'u1', 'spam text', 'ch-2', rule);
    const r3 = trackFlood(GID, 'u1', 'spam text', 'ch-3', rule);
    expect(r3.isFlood).toBe(true);
    expect(r3.duplicateCount).toBe(3);
    expect(r3.channels).toEqual(expect.arrayContaining(['ch-1', 'ch-2', 'ch-3']));
  });

  it('normalises content (case + whitespace)', () => {
    trackFlood(GID, 'u1', '  Hello  World  ', 'ch-1', rule);
    trackFlood(GID, 'u1', 'hello world', 'ch-2', rule);
    const r = trackFlood(GID, 'u1', 'HELLO WORLD', 'ch-3', rule);
    expect(r.isFlood).toBe(true);
  });

  it('treats different content independently', () => {
    trackFlood(GID, 'u1', 'msg-a', 'ch-1', rule);
    trackFlood(GID, 'u1', 'msg-a', 'ch-2', rule);
    const r = trackFlood(GID, 'u1', 'msg-b', 'ch-3', rule);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);
  });

  it('isolates users', () => {
    trackFlood(GID, 'u1', 'same', 'ch-1', rule);
    trackFlood(GID, 'u1', 'same', 'ch-2', rule);
    const r = trackFlood(GID, 'u2', 'same', 'ch-1', rule);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);
  });

  it('expires entries older than windowSeconds', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    trackFlood(GID, 'u1', 'old', 'ch-1', rule);
    trackFlood(GID, 'u1', 'old', 'ch-2', rule);

    (Date.now as jest.Mock).mockReturnValue(now + 31_000);
    const r = trackFlood(GID, 'u1', 'old', 'ch-3', rule);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);

    (Date.now as jest.Mock).mockRestore();
  });
});

/* ── clearFloodHistory ────────────────────────────────────── */

describe('clearFloodHistory', () => {
  const rule: AntiSpamRuleSettings = { ...BASE_RULE, threshold: 3, windowSeconds: 30 };

  it('removes flood entries for the given user', () => {
    trackFlood(GID, 'u1', 'x', 'ch-1', rule);
    trackFlood(GID, 'u1', 'x', 'ch-2', rule);

    clearFloodHistory(GID, 'u1');

    const r = trackFlood(GID, 'u1', 'x', 'ch-3', rule);
    expect(r.isFlood).toBe(false);
    expect(r.duplicateCount).toBe(1);
  });

  it('does not affect other users', () => {
    trackFlood(GID, 'u1', 'y', 'ch-1', rule);
    trackFlood(GID, 'u2', 'y', 'ch-1', rule);
    trackFlood(GID, 'u2', 'y', 'ch-2', rule);

    clearFloodHistory(GID, 'u1');

    const r = trackFlood(GID, 'u2', 'y', 'ch-3', rule);
    expect(r.duplicateCount).toBe(3);
  });
});

/* ── getNextPunishment (single vs ladder) ─────────────────── */

describe('getNextPunishment', () => {
  it('single mode always returns the configured action', async () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, mode: 'single', action: 'kick' };
    const p = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p).toBe('kick');
  });

  it('ladder mode returns the first step with no prior incidents', async () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, mode: 'ladder', steps: ['warn', 'mute', 'kick'] };
    const p = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p).toBe('warn');
  });

  it('ladder mode escalates based on recorded incidents within the reset window', async () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, mode: 'ladder', steps: ['warn', 'mute', 'kick'], reset: '24' };

    await recordIncident(GID, 'u1', 'rate', 'warn');
    const p2 = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p2).toBe('mute');

    await recordIncident(GID, 'u1', 'rate', 'mute');
    const p3 = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p3).toBe('kick');
  });

  it('ladder mode repeats the last step beyond the configured steps', async () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, mode: 'ladder', steps: ['warn', 'kick'], reset: '24' };

    await recordIncident(GID, 'u1', 'rate', 'warn');
    await recordIncident(GID, 'u1', 'rate', 'kick');
    const p = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p).toBe('kick');
  });

  it('does not count incidents from a different rule', async () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, mode: 'ladder', steps: ['warn', 'mute'] };
    await recordIncident(GID, 'u1', 'mentions', 'warn');
    const p = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p).toBe('warn');
  });

  it('does not count incidents outside the reset window', async () => {
    const rule: AntiSpamRuleSettings = { ...BASE_RULE, mode: 'ladder', steps: ['warn', 'mute'], reset: '1' };

    const doc = await AntiSpamIncidentModel.create({ guildId: GID, userId: 'u1', rule: 'rate', actionTaken: 'warn' });
    await AntiSpamIncidentModel.updateOne(
      { _id: doc._id },
      { $set: { createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) } }
    );

    const p = await getNextPunishment(GID, 'u1', 'rate', rule);
    expect(p).toBe('warn');
  });
});

/* ── recordIncident + countRecentIncidents ────────────────── */

describe('recordIncident + countRecentIncidents', () => {
  it('counts incidents within the given window', async () => {
    await recordIncident(GID, 'u1', 'rate', 'warn');
    await recordIncident(GID, 'u2', 'mentions', 'mute');

    const count = await countRecentIncidents(GID, 24 * 7);
    expect(count).toBe(2);
  });

  it('ignores incidents from other guilds', async () => {
    await recordIncident(GID, 'u1', 'rate', 'warn');
    await recordIncident('other-guild', 'u1', 'rate', 'warn');

    const count = await countRecentIncidents(GID, 24 * 7);
    expect(count).toBe(1);
  });
});

/* ── cleanup timer ────────────────────────────────────────── */

describe('cleanup', () => {
  it('startCleanup / stopCleanup do not throw', () => {
    expect(() => startCleanup()).not.toThrow();
    expect(() => stopCleanup()).not.toThrow();
  });
});
