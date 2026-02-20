/* pretty-ms is ESM-only — mock it so Jest can import moderationHelpers */
jest.mock('pretty-ms', () => ({
  __esModule: true,
  default: (ms: number) => `${ms}ms`,
}));

import {
  canModerate,
  getModFailMessage,
  parseDuration,
  formatHumanDuration,
} from '../../../src/utils/moderationHelpers';

/* ── Mock GuildMember factory ─────────────────────────────── */

function mockMember(id: string, highestPos: number, guildOwnerId = 'owner-id') {
  return {
    id,
    guild: { ownerId: guildOwnerId },
    roles: { highest: { position: highestPos } },
  } as any;
}

/* ── canModerate ──────────────────────────────────────────── */

describe('canModerate', () => {
  it('returns allowed when target is lower than both', () => {
    const result = canModerate(mockMember('target', 1), mockMember('mod', 5), mockMember('bot', 10));
    expect(result.allowed).toBe(true);
  });

  it('rejects when any param is null', () => {
    expect(canModerate(null, mockMember('m', 5), mockMember('b', 10)).reason).toBe('MISSING_PARAM');
  });

  it('rejects when target is server owner', () => {
    const target = mockMember('owner-id', 1, 'owner-id');
    expect(canModerate(target, mockMember('m', 5), mockMember('b', 10)).reason).toBe('TARGET_IS_OWNER');
  });

  it('rejects self-action', () => {
    const mem = mockMember('same', 5);
    expect(canModerate(mem, mem, mockMember('b', 10)).reason).toBe('SELF_ACTION');
  });

  it('rejects when target role >= requester role', () => {
    const result = canModerate(mockMember('t', 5), mockMember('m', 5), mockMember('b', 10));
    expect(result.reason).toBe('TARGET_NOT_LOWER_THAN_REQUESTER');
  });

  it('rejects when target role >= bot role', () => {
    const result = canModerate(mockMember('t', 5), mockMember('m', 10), mockMember('b', 3));
    expect(result.reason).toBe('TARGET_NOT_LOWER_THAN_BOT');
  });
});

/* ── getModFailMessage ────────────────────────────────────── */

describe('getModFailMessage', () => {
  it('returns null when action is allowed', () => {
    expect(
      getModFailMessage(mockMember('t', 1), mockMember('m', 5), mockMember('b', 10), 'ban'),
    ).toBeNull();
  });

  it('returns localized message for self-action ban', () => {
    const m = mockMember('same', 5);
    const msg = getModFailMessage(m, m, mockMember('b', 10), 'ban');
    expect(msg).toContain('zbanować');
    expect(msg).toContain('samego siebie');
  });

  it('returns error when botMember is null', () => {
    const msg = getModFailMessage(mockMember('t', 1), mockMember('m', 5), null, 'kick');
    expect(msg).toBeTruthy();
  });

  it('uses correct verb for each action', () => {
    const m1 = mockMember('same', 5);
    expect(getModFailMessage(m1, m1, mockMember('b', 10), 'mute')).toContain('wyciszyć');
    expect(getModFailMessage(m1, m1, mockMember('b', 10), 'warn')).toContain('ostrzec');
    expect(getModFailMessage(m1, m1, mockMember('b', 10), 'kick')).toContain('wyrzucić');
  });
});

/* ── parseDuration ────────────────────────────────────────── */

describe('parseDuration', () => {
  it('parses "1d" to 86400000ms', () => {
    expect(parseDuration('1d')).toBe(86_400_000);
  });

  it('parses compound "1h 30m" (space-separated)', () => {
    expect(parseDuration('1h 30m')).toBe(3_600_000 + 30 * 60_000);
  });

  it('parses compound "1h30m" (no space)', () => {
    expect(parseDuration('1h30m')).toBe(3_600_000 + 30 * 60_000);
  });

  it('parses "10s" to 10000ms', () => {
    expect(parseDuration('10s')).toBe(10_000);
  });

  it('returns null for too short durations (< 5s)', () => {
    expect(parseDuration('3s')).toBeNull();
  });

  it('returns null for empty/no-match string', () => {
    expect(parseDuration('abc')).toBeNull();
  });

  it('returns null for extremely long durations', () => {
    expect(parseDuration('999999d')).toBeNull();
  });
});

/* ── formatHumanDuration ───────────────────────────────────── */

describe('formatHumanDuration', () => {
  it('formats milliseconds as human-readable', () => {
    const result = formatHumanDuration(3_600_000);
    expect(result).toBe('3600000ms');
  });
});
