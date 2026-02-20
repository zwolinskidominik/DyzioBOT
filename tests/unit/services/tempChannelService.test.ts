import { TempChannelModel } from '../../../src/models/TempChannel';
import { TempChannelConfigurationModel } from '../../../src/models/TempChannelConfiguration';
import {
  getMonitoredChannels,
  saveTempChannel,
  deleteTempChannel,
  transferOwnership,
  getTempChannel,
  validateOwnership,
  setControlMessageId,
} from '../../../src/services/tempChannelService';

const GID = 'guild-temp';

beforeEach(async () => {
  await TempChannelModel.deleteMany({});
  await TempChannelConfigurationModel.deleteMany({});
});

/* ── seed helpers ─────────────────────────────────────────── */

async function seedChannel(overrides: Partial<{
  guildId: string; parentId: string; channelId: string; ownerId: string;
}> = {}) {
  const res = await saveTempChannel({
    guildId: GID,
    parentId: 'parent-1',
    channelId: `ch-${Date.now()}-${Math.random()}`,
    ownerId: 'owner-1',
    ...overrides,
  });
  if (!res.ok) throw new Error('seedChannel failed');
  return res.data;
}

/* ── getMonitoredChannels ─────────────────────────────────── */

describe('getMonitoredChannels', () => {
  it('returns channel IDs from config', async () => {
    await TempChannelConfigurationModel.create({
      guildId: GID,
      channelIds: ['vc-1', 'vc-2'],
    });
    const res = await getMonitoredChannels(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual(['vc-1', 'vc-2']);
  });

  it('returns empty array when no config exists', async () => {
    const res = await getMonitoredChannels(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual([]);
  });
});

/* ── saveTempChannel ──────────────────────────────────────── */

describe('saveTempChannel', () => {
  it('creates a record and returns data', async () => {
    const res = await saveTempChannel({
      guildId: GID,
      parentId: 'parent-1',
      channelId: 'ch-new',
      ownerId: 'owner-1',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.guildId).toBe(GID);
    expect(res.data.channelId).toBe('ch-new');
    expect(res.data.ownerId).toBe('owner-1');
  });

  it('persists in DB', async () => {
    await saveTempChannel({
      guildId: GID,
      parentId: 'p1',
      channelId: 'ch-persist',
      ownerId: 'o1',
    });
    const doc = await TempChannelModel.findOne({ channelId: 'ch-persist' });
    expect(doc).not.toBeNull();
    expect(doc?.ownerId).toBe('o1');
  });
});

/* ── deleteTempChannel ────────────────────────────────────── */

describe('deleteTempChannel', () => {
  it('removes the record', async () => {
    const ch = await seedChannel({ channelId: 'ch-del' });
    await deleteTempChannel(ch.channelId);
    const doc = await TempChannelModel.findOne({ channelId: 'ch-del' });
    expect(doc).toBeNull();
  });

  it('succeeds when record does not exist', async () => {
    const res = await deleteTempChannel('nonexistent');
    expect(res.ok).toBe(true);
  });
});

/* ── transferOwnership ────────────────────────────────────── */

describe('transferOwnership', () => {
  it('updates owner and returns old/new IDs', async () => {
    const ch = await seedChannel({ channelId: 'ch-transfer', ownerId: 'old-owner' });
    const res = await transferOwnership(ch.channelId, 'new-owner');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.oldOwnerId).toBe('old-owner');
    expect(res.data.newOwnerId).toBe('new-owner');

    const doc = await TempChannelModel.findOne({ channelId: 'ch-transfer' });
    expect(doc?.ownerId).toBe('new-owner');
  });

  it('fails with NOT_FOUND for unknown channel', async () => {
    const res = await transferOwnership('nonexistent', 'someone');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── getTempChannel ───────────────────────────────────────── */

describe('getTempChannel', () => {
  it('returns channel data when found', async () => {
    const ch = await seedChannel({ channelId: 'ch-get', ownerId: 'owner-get' });
    const res = await getTempChannel(ch.channelId);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).not.toBeNull();
    expect(res.data!.ownerId).toBe('owner-get');
  });

  it('returns null when not found', async () => {
    const res = await getTempChannel('nonexistent');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toBeNull();
  });
});

/* ── validateOwnership ────────────────────────────────────── */

describe('validateOwnership', () => {
  it('returns data when user is the owner', async () => {
    await seedChannel({ channelId: 'ch-own', ownerId: 'the-owner' });
    const res = await validateOwnership('ch-own', 'the-owner');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.ownerId).toBe('the-owner');
  });

  it('fails with NOT_OWNER for non-owner', async () => {
    await seedChannel({ channelId: 'ch-own2', ownerId: 'real-owner' });
    const res = await validateOwnership('ch-own2', 'impostor');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_OWNER');
  });

  it('fails with NOT_FOUND for unknown channel', async () => {
    const res = await validateOwnership('nonexistent', 'anyone');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── setControlMessageId ──────────────────────────────────── */

describe('setControlMessageId', () => {
  it('updates the control message ID', async () => {
    await seedChannel({ channelId: 'ch-ctrl' });
    const res = await setControlMessageId('ch-ctrl', 'msg-42');
    expect(res.ok).toBe(true);

    const doc = await TempChannelModel.findOne({ channelId: 'ch-ctrl' });
    expect(doc?.controlMessageId).toBe('msg-42');
  });

  it('fails with NOT_FOUND for unknown channel', async () => {
    const res = await setControlMessageId('nonexistent', 'msg-1');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_FOUND');
  });
});
