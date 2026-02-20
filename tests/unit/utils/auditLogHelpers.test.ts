jest.mock('../../../src/utils/logger', () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }));

import { getAuditLogEntry, getModerator, getReason } from '../../../src/utils/auditLogHelpers';
import { Collection, AuditLogEvent } from 'discord.js';

/* ── mock factory ─────────────────────────────────────────── */

function mockGuild(entries: any[] = []): any {
  const c = new Collection<string, any>();
  entries.forEach((e, i) => c.set(String(i), e));
  return {
    fetchAuditLogs: jest.fn().mockResolvedValue({ entries: c }),
  };
}

function mockEntry(opts: {
  targetId?: string;
  executorId?: string;
  reason?: string | null;
  age?: number;
} = {}): any {
  return {
    createdTimestamp: Date.now() - (opts.age ?? 0),
    target: opts.targetId ? { id: opts.targetId } : null,
    executor: opts.executorId ? { id: opts.executorId, tag: `Mod#0001` } : null,
    reason: opts.reason ?? null,
  };
}

/* ── getAuditLogEntry ─────────────────────────────────────── */

describe('getAuditLogEntry', () => {
  it('returns matching entry by targetId', async () => {
    const entry = mockEntry({ targetId: 'u-1', executorId: 'mod-1' });
    const guild = mockGuild([entry]);
    const result = await getAuditLogEntry(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(result).toBe(entry);
  });

  it('returns null when no entries match targetId', async () => {
    const entry = mockEntry({ targetId: 'u-2' });
    const guild = mockGuild([entry]);
    const result = await getAuditLogEntry(guild, AuditLogEvent.MemberBanAdd, 'u-99');
    expect(result).toBeNull();
  });

  it('returns null when entry is too old', async () => {
    const entry = mockEntry({ targetId: 'u-1', age: 10_000 });
    const guild = mockGuild([entry]);
    const result = await getAuditLogEntry(guild, AuditLogEvent.MemberBanAdd, 'u-1', 5_000);
    expect(result).toBeNull();
  });

  it('returns first recent entry when no targetId provided', async () => {
    const entry = mockEntry({ executorId: 'mod-1' });
    const guild = mockGuild([entry]);
    const result = await getAuditLogEntry(guild, AuditLogEvent.MemberKick);
    expect(result).toBe(entry);
  });

  it('returns null when fetchAuditLogs throws', async () => {
    const guild = { fetchAuditLogs: jest.fn().mockRejectedValue(new Error('Forbidden')) };
    const result = await getAuditLogEntry(guild as any, AuditLogEvent.MemberBanAdd);
    expect(result).toBeNull();
  });
});

/* ── getModerator ─────────────────────────────────────────── */

describe('getModerator', () => {
  it('returns executor user when entry has executor', async () => {
    const entry = mockEntry({ targetId: 'u-1', executorId: 'mod-1' });
    const guild = mockGuild([entry]);
    const mod = await getModerator(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(mod?.id).toBe('mod-1');
  });

  it('returns null when no entry found', async () => {
    const guild = mockGuild([]);
    const mod = await getModerator(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(mod).toBeNull();
  });

  it('returns null when executor lacks tag', async () => {
    const entry = {
      createdTimestamp: Date.now(),
      target: { id: 'u-1' },
      executor: { id: 'mod-1' }, // no tag property
      reason: null,
    };
    const guild = mockGuild([entry]);
    const mod = await getModerator(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(mod).toBeNull();
  });
});

/* ── getReason ────────────────────────────────────────────── */

describe('getReason', () => {
  it('returns reason string from entry', async () => {
    const entry = mockEntry({ targetId: 'u-1', reason: 'Spamming' });
    const guild = mockGuild([entry]);
    const reason = await getReason(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(reason).toBe('Spamming');
  });

  it('returns null when entry has no reason', async () => {
    const entry = mockEntry({ targetId: 'u-1', reason: null });
    const guild = mockGuild([entry]);
    const reason = await getReason(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(reason).toBeNull();
  });

  it('returns null when no entry found', async () => {
    const guild = mockGuild([]);
    const reason = await getReason(guild, AuditLogEvent.MemberBanAdd, 'u-1');
    expect(reason).toBeNull();
  });
});
