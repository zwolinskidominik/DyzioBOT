import { TicketConfigModel } from '../../../src/models/TicketConfig';
import { TicketStateModel } from '../../../src/models/TicketState';
import { TicketStatsModel } from '../../../src/models/TicketStats';
import {
  validateTicketCreation,
  takeTicket,
  closeTicket,
  getTicketState,
  TICKET_TYPES,
} from '../../../src/services/ticketService';

const GID = 'guild-ticket';

beforeEach(async () => {
  await TicketConfigModel.deleteMany({});
  await TicketStateModel.deleteMany({});
  await TicketStatsModel.deleteMany({});
});

/* ── seed helpers ─────────────────────────────────────────── */

async function seedConfig(overrides: Partial<{ guildId: string; categoryId: string }> = {}) {
  return TicketConfigModel.create({
    guildId: GID,
    categoryId: 'cat-1',
    enabled: true,
    ...overrides,
  });
}

/* ── TICKET_TYPES ─────────────────────────────────────────── */

describe('TICKET_TYPES', () => {
  it('defines all 5 ticket types', () => {
    expect(Object.keys(TICKET_TYPES)).toHaveLength(5);
    expect(TICKET_TYPES).toHaveProperty('help');
    expect(TICKET_TYPES).toHaveProperty('report');
    expect(TICKET_TYPES).toHaveProperty('partnership');
    expect(TICKET_TYPES).toHaveProperty('idea');
    expect(TICKET_TYPES).toHaveProperty('rewards');
  });

  it('each type has required fields', () => {
    for (const info of Object.values(TICKET_TYPES)) {
      expect(info.title).toBeTruthy();
      expect(info.channelPrefix).toBeTruthy();
      expect(info.color).toBeTruthy();
      expect(info.image).toBeTruthy();
    }
  });
});

/* ── validateTicketCreation ───────────────────────────────── */

describe('validateTicketCreation', () => {
  it('returns config data for valid type', async () => {
    await seedConfig();
    const res = await validateTicketCreation(GID, 'help', 'TestUser');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.categoryId).toBe('cat-1');
    expect(res.data.ticketType.title).toBe('Dział pomocy');
    expect(res.data.channelName).toBe('pomoc-testuser');
  });

  it('fails with NO_CONFIG when no config exists', async () => {
    const res = await validateTicketCreation(GID, 'help', 'User');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NO_CONFIG');
  });

  it('fails with INVALID_TYPE for unknown type', async () => {
    await seedConfig();
    const res = await validateTicketCreation(GID, 'unknown', 'User');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('INVALID_TYPE');
  });

  it('builds channel name as prefix-lowercase(username)', async () => {
    await seedConfig();
    const res = await validateTicketCreation(GID, 'report', 'CamelCase');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.channelName).toBe('zgloszenie-camelcase');
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

  it('returns null assignedTo when no state exists', async () => {
    const res = await getTicketState('nonexistent');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.assignedTo).toBeNull();
  });
});
