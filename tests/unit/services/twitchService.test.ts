import { TwitchStreamerModel } from '../../../src/models/TwitchStreamer';
import {
  getActiveStreamers,
  addStreamer,
  removeStreamer,
  setLiveStatus,
  listStreamers,
} from '../../../src/services/twitchService';

const GID = 'guild-twitch';

beforeEach(async () => {
  await TwitchStreamerModel.deleteMany({});
});

/* ── addStreamer ───────────────────────────────────────────── */

describe('addStreamer', () => {
  it('creates a new streamer record', async () => {
    const res = await addStreamer(GID, 'user-1', 'TestChannel');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.twitchChannel).toBe('testchannel');
    expect(res.data.isLive).toBe(false);
    expect(res.data.active).toBe(true);
  });

  it('fails with ALREADY_EXISTS for duplicate channel', async () => {
    await addStreamer(GID, 'user-1', 'mychannel');
    const res = await addStreamer(GID, 'user-2', 'MyChannel');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('ALREADY_EXISTS');
  });
});

/* ── getActiveStreamers ───────────────────────────────────── */

describe('getActiveStreamers', () => {
  it('returns only active streamers', async () => {
    await addStreamer(GID, 'u1', 'ch1');
    await addStreamer(GID, 'u2', 'ch2');
    // deactivate one by removing
    await TwitchStreamerModel.findOneAndUpdate(
      { guildId: GID, twitchChannel: 'ch2' },
      { active: false },
    );

    const res = await getActiveStreamers(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(1);
    expect(res.data[0].twitchChannel).toBe('ch1');
  });

  it('returns all active when guildId omitted', async () => {
    await addStreamer(GID, 'u1', 'ch1');
    await addStreamer('other-guild', 'u2', 'ch2');

    const res = await getActiveStreamers();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);
  });
});

/* ── removeStreamer ────────────────────────────────────────── */

describe('removeStreamer', () => {
  it('deletes the streamer record', async () => {
    await addStreamer(GID, 'u1', 'ch1');
    const res = await removeStreamer(GID, 'ch1');
    expect(res.ok).toBe(true);

    const doc = await TwitchStreamerModel.findOne({ guildId: GID, twitchChannel: 'ch1' });
    expect(doc).toBeNull();
  });

  it('fails with NOT_FOUND for unknown channel', async () => {
    const res = await removeStreamer(GID, 'nonexistent');
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── setLiveStatus ────────────────────────────────────────── */

describe('setLiveStatus', () => {
  it('updates isLive to true', async () => {
    await addStreamer(GID, 'u1', 'ch1');
    const res = await setLiveStatus(GID, 'ch1', true);
    expect(res.ok).toBe(true);

    const doc = await TwitchStreamerModel.findOne({ guildId: GID, twitchChannel: 'ch1' });
    expect(doc?.isLive).toBe(true);
  });

  it('fails with NOT_FOUND for unknown', async () => {
    const res = await setLiveStatus(GID, 'none', true);
    expect(res.ok).toBe(false);
  });
});

/* ── listStreamers ────────────────────────────────────────── */

describe('listStreamers', () => {
  it('returns all streamers for guild (active + inactive)', async () => {
    await addStreamer(GID, 'u1', 'ch1');
    await addStreamer(GID, 'u2', 'ch2');
    await TwitchStreamerModel.findOneAndUpdate(
      { guildId: GID, twitchChannel: 'ch2' },
      { active: false },
    );

    const res = await listStreamers(GID);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);
  });
});
