import { TicketConfigModel } from '../../../src/models/TicketConfig';
import { TicketStateModel } from '../../../src/models/TicketState';
import { TicketStatsModel } from '../../../src/models/TicketStats';
import {
  validateTicketCreation,
  takeTicket,
  closeTicket,
  getTicketState,
  getTicketTypes,
  registerTicketChannel,
  touchTicketActivity,
  getStaffRoleIdsForChannel,
  findIdleTicketGroups,
  getTranscriptDestination,
  slugifyChannelPrefix,
} from '../../../src/services/ticketService';

const GID = 'guild-ticket';

beforeEach(async () => {
  await TicketConfigModel.deleteMany({});
  await TicketStateModel.deleteMany({});
  await TicketStatsModel.deleteMany({});
});

/* ── seed helpers ─────────────────────────────────────────── */

const SAMPLE_TYPES = [
  {
    id: 'help',
    emoji: '❓',
    name: 'Dział pomocy',
    description: 'Witaj {user}! Opisz swój problem.',
    roleIds: ['role-mod'],
    color: '#5865F2',
    banner: { mode: 'preset' as const, presetId: 'ticketBanner' },
  },
  {
    id: 'report',
    emoji: '🚫',
    name: 'Zgłoszenie',
    description: 'Witaj {user}! Opisz naruszenie.',
    roleIds: ['role-mod', 'role-admin'],
    color: '#ED4245',
    banner: { mode: 'text' as const, text: 'Zgłoszenie' },
  },
];

async function seedConfig(
  overrides: Partial<{
    guildId: string;
    categoryId: string;
    types: typeof SAMPLE_TYPES;
    automation: Partial<{
      maxOpenPerUser: number;
      autoCloseHours: number;
      transcriptEnabled: boolean;
      transcriptChannelId: string;
    }>;
  }> = {},
) {
  return TicketConfigModel.create({
    guildId: GID,
    categoryId: 'cat-1',
    enabled: true,
    types: SAMPLE_TYPES,
    ...overrides,
  });
}

/* ── getTicketTypes ───────────────────────────────────────── */

describe('getTicketTypes', () => {
  it('returns configured types for a guild', async () => {
    await seedConfig();
    const res = await getTicketTypes(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);
    expect(res.data.map((t) => t.id)).toEqual(['help', 'report']);
  });

  it('returns an empty array when no config exists', async () => {
    const res = await getTicketTypes(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });
});

/* ── slugifyChannelPrefix ─────────────────────────────────── */

describe('slugifyChannelPrefix', () => {
  it('lowercases and hyphenates', () => {
    expect(slugifyChannelPrefix('Zgłoszenie')).toBe('zgloszenie');
  });

  it('transliterates ł since it does not decompose under NFD', () => {
    expect(slugifyChannelPrefix('Dział pomocy')).toBe('dzial-pomocy');
  });

  it('falls back to "ticket" for empty/symbol-only input', () => {
    expect(slugifyChannelPrefix('!!!')).toBe('ticket');
  });
});

/* ── validateTicketCreation ───────────────────────────────── */

describe('validateTicketCreation', () => {
  it('returns config data for a valid, user-defined type', async () => {
    await seedConfig();
    const res = await validateTicketCreation(GID, 'help', 'user-1', 'TestUser');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.categoryId).toBe('cat-1');
    expect(res.data.ticketType.name).toBe('Dział pomocy');
    expect(res.data.ticketType.roleIds).toEqual(['role-mod']);
    expect(res.data.ticketType.color).toBe('#5865F2');
    expect(res.data.channelName).toBe('dzial-pomocy-testuser');
  });

  it('fails with NO_CONFIG when no config exists', async () => {
    const res = await validateTicketCreation(GID, 'help', 'user-1', 'User');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_CONFIG');
  });

  it('fails with INVALID_TYPE for an unknown type id', async () => {
    await seedConfig();
    const res = await validateTicketCreation(GID, 'unknown', 'user-1', 'User');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_TYPE');
  });

  it('builds channel name as slug(name)-lowercase(username)', async () => {
    await seedConfig();
    const res = await validateTicketCreation(GID, 'report', 'user-1', 'CamelCase');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.channelName).toBe('zgloszenie-camelcase');
  });

  it('allows ticket creation when under the configured open-ticket limit', async () => {
    await seedConfig({ automation: { maxOpenPerUser: 2 } });
    await registerTicketChannel('ch-existing', GID, 'help', 'user-1');

    const res = await validateTicketCreation(GID, 'report', 'user-1', 'User');
    expect(res.ok).toBe(true);
  });

  it('fails with LIMIT_REACHED once the user hits automation.maxOpenPerUser', async () => {
    await seedConfig({ automation: { maxOpenPerUser: 1 } });
    await registerTicketChannel('ch-existing', GID, 'help', 'user-1');

    const res = await validateTicketCreation(GID, 'report', 'user-1', 'User');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('LIMIT_REACHED');
  });

  it('ignores the limit for other users', async () => {
    await seedConfig({ automation: { maxOpenPerUser: 1 } });
    await registerTicketChannel('ch-existing', GID, 'help', 'user-1');

    const res = await validateTicketCreation(GID, 'report', 'user-2', 'User');
    expect(res.ok).toBe(true);
  });
});

/* ── takeTicket ───────────────────────────────────────────── */

describe('takeTicket', () => {
  it('creates ticket state and increments stats', async () => {
    const res = await takeTicket('ch-1', GID, 'mod-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.assignedTo).toBe('mod-1');
    expect(res.data.statsCount).toBe(1);

    const state = await TicketStateModel.findOne({ channelId: 'ch-1' });
    expect(state?.assignedTo).toBe('mod-1');
  });

  it('fails with ALREADY_TAKEN if already assigned', async () => {
    await takeTicket('ch-1', GID, 'mod-1');
    const res = await takeTicket('ch-1', GID, 'mod-2');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('ALREADY_TAKEN');
  });

  it('increments stats count on repeated takes', async () => {
    await takeTicket('ch-1', GID, 'mod-1');
    const res = await takeTicket('ch-2', GID, 'mod-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.statsCount).toBe(2);
  });
});

/* ── closeTicket ──────────────────────────────────────────── */

describe('closeTicket', () => {
  it('deletes ticket state', async () => {
    await takeTicket('ch-1', GID, 'mod-1');
    const res = await closeTicket('ch-1');
    expect(res.ok).toBe(true);
    const state = await TicketStateModel.findOne({ channelId: 'ch-1' });
    expect(state).toBeNull();
  });

  it('succeeds even when no state exists', async () => {
    const res = await closeTicket('nonexistent');
    expect(res.ok).toBe(true);
  });
});

/* ── getTicketState ───────────────────────────────────────── */

describe('getTicketState', () => {
  it('returns assigned moderator', async () => {
    await takeTicket('ch-1', GID, 'mod-1');
    const res = await getTicketState('ch-1');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.assignedTo).toBe('mod-1');
    expect(res.data.channelId).toBe('ch-1');
  });

  it('returns null assignedTo/typeId/creatorId when no state exists', async () => {
    const res = await getTicketState('nonexistent');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.assignedTo).toBeNull();
    expect(res.data.typeId).toBeNull();
    expect(res.data.creatorId).toBeNull();
  });
});

/* ── registerTicketChannel / getStaffRoleIdsForChannel ───── */

describe('registerTicketChannel + getStaffRoleIdsForChannel', () => {
  it('resolves staff roleIds from the type the channel was created under', async () => {
    await seedConfig();
    await registerTicketChannel('ch-1', GID, 'report', 'user-1');

    const roleIds = await getStaffRoleIdsForChannel(GID, 'ch-1');
    expect(roleIds).toEqual(['role-mod', 'role-admin']);

    const state = await TicketStateModel.findOne({ channelId: 'ch-1' });
    expect(state?.creatorId).toBe('user-1');
    expect(state?.typeId).toBe('report');
    expect(state?.guildId).toBe(GID);
    expect(state?.lastActivityAt).toBeInstanceOf(Date);
  });

  it('returns an empty array for a channel with no registered state', async () => {
    const roleIds = await getStaffRoleIdsForChannel(GID, 'unknown-channel');
    expect(roleIds).toEqual([]);
  });
});

/* ── touchTicketActivity ──────────────────────────────────── */

describe('touchTicketActivity', () => {
  it('bumps lastActivityAt for a registered ticket channel', async () => {
    await seedConfig();
    await registerTicketChannel('ch-1', GID, 'help', 'user-1');
    const before = (await TicketStateModel.findOne({ channelId: 'ch-1' }))!.lastActivityAt;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await touchTicketActivity('ch-1');

    const after = (await TicketStateModel.findOne({ channelId: 'ch-1' }))!.lastActivityAt;
    expect(after!.getTime()).toBeGreaterThanOrEqual(before!.getTime());
  });

  it('no-ops silently for a channel with no ticket state', async () => {
    await expect(touchTicketActivity('not-a-ticket-channel')).resolves.toBeUndefined();
  });
});

/* ── findIdleTicketGroups ─────────────────────────────────── */

describe('findIdleTicketGroups', () => {
  it('returns nothing when autoCloseHours is disabled (0)', async () => {
    await seedConfig();
    await registerTicketChannel('ch-1', GID, 'help', 'user-1');
    await TicketStateModel.updateOne({ channelId: 'ch-1' }, { lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 999) });

    const groups = await findIdleTicketGroups();
    expect(groups).toEqual([]);
  });

  it('groups idle channels past the guild threshold', async () => {
    await seedConfig({ automation: { autoCloseHours: 1 } });
    await registerTicketChannel('ch-idle', GID, 'help', 'user-1');
    await registerTicketChannel('ch-fresh', GID, 'help', 'user-2');

    await TicketStateModel.updateOne(
      { channelId: 'ch-idle' },
      { lastActivityAt: new Date(Date.now() - 1000 * 60 * 60 * 2) },
    );

    const groups = await findIdleTicketGroups();
    expect(groups).toHaveLength(1);
    expect(groups[0].guildId).toBe(GID);
    expect(groups[0].autoCloseHours).toBe(1);
    expect(groups[0].channelIds).toEqual(['ch-idle']);
  });
});

/* ── getTranscriptDestination ─────────────────────────────── */

describe('getTranscriptDestination', () => {
  it('returns null when transcripts are disabled', async () => {
    await seedConfig();
    const dest = await getTranscriptDestination(GID);
    expect(dest).toBeNull();
  });

  it('returns null when enabled but no channel is configured', async () => {
    await seedConfig({ automation: { transcriptEnabled: true } });
    const dest = await getTranscriptDestination(GID);
    expect(dest).toBeNull();
  });

  it('returns the destination channel when fully configured', async () => {
    await seedConfig({ automation: { transcriptEnabled: true, transcriptChannelId: 'log-channel' } });
    const dest = await getTranscriptDestination(GID);
    expect(dest).toEqual({ transcriptChannelId: 'log-channel' });
  });
});
