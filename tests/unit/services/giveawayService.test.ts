import { GiveawayModel } from '../../../src/models/Giveaway';
import { GiveawayConfigModel } from '../../../src/models/GiveawayConfig';
import {
  createGiveaway,
  editGiveaway,
  deleteGiveaway,
  endGiveaway,
  joinGiveaway,
  leaveGiveaway,
  rerollGiveaway,
  listActiveGiveaways,
  finalizeExpiredGiveaways,
  parseDuration,
  pickWinnerIds,
  computeMultiplier,
  getAdditionalNote,
} from '../../../src/services/giveawayService';

const GID = 'guild-giveaway';

beforeEach(async () => {
  await GiveawayModel.deleteMany({});
  await GiveawayConfigModel.deleteMany({});
});

/* ── helper: create a giveaway via service ────────────────── */
let seedCounter = 0;

async function seedGiveaway(overrides: Partial<Parameters<typeof createGiveaway>[0]> = {}) {
  seedCounter++;
  const res = await createGiveaway({
    guildId: GID,
    channelId: 'ch1',
    messageId: `msg-${Date.now()}-${seedCounter}`,
    prize: 'Nitro',
    description: 'Win Nitro!',
    winnersCount: 1,
    durationMs: 86_400_000,
    hostId: 'host1',
    ...overrides,
  });
  if (!res.ok) throw new Error(`seedGiveaway failed: ${res.message}`);
  return res.data;
}

/* ── parseDuration (pure) ─────────────────────────────────── */

describe('parseDuration', () => {
  it('parses days, hours, minutes, seconds', () => {
    expect(parseDuration('1 day 2 hours 30 minutes 10 seconds')).toBe(
      86_400_000 + 7_200_000 + 1_800_000 + 10_000,
    );
  });

  it('parses short units', () => {
    expect(parseDuration('5d 4h 2m')).toBe(
      5 * 86_400_000 + 4 * 3_600_000 + 2 * 60_000,
    );
  });

  it('returns 0 for gibberish', () => {
    expect(parseDuration('abc xyz')).toBe(0);
  });
});

/* ── pickWinnerIds (pure) ─────────────────────────────────── */

describe('pickWinnerIds', () => {
  it('returns empty for empty participants', () => {
    expect(pickWinnerIds([], 5)).toEqual([]);
  });

  it('returns unique winners', () => {
    const pool = ['a', 'a', 'b', 'b', 'c', 'c'];
    const winners = pickWinnerIds(pool, 3);
    expect(winners).toHaveLength(3);
    expect(new Set(winners).size).toBe(3);
  });

  it('returns at most count winners', () => {
    const pool = ['a', 'b', 'c', 'd', 'e'];
    const winners = pickWinnerIds(pool, 2);
    expect(winners).toHaveLength(2);
  });

  it('returns all unique if count > unique', () => {
    const pool = ['a', 'a', 'b'];
    const winners = pickWinnerIds(pool, 10);
    expect(winners.length).toBeLessThanOrEqual(2);
    expect(new Set(winners).size).toBe(winners.length);
  });
});

/* ── computeMultiplier (pure) ─────────────────────────────── */

describe('computeMultiplier', () => {
  it('returns 1 when no matching roles', () => {
    expect(computeMultiplier(['r1'], { r2: 3 })).toBe(1);
  });

  it('returns highest matching multiplier', () => {
    expect(computeMultiplier(['r1', 'r2'], { r1: 2, r2: 5 })).toBe(5);
  });

  it('returns 1 when no multipliers defined', () => {
    expect(computeMultiplier(['r1'], {})).toBe(1);
  });
});

/* ── createGiveaway ───────────────────────────────────────── */

describe('createGiveaway', () => {
  it('creates a giveaway with UUID', async () => {
    const res = await createGiveaway({
      guildId: GID,
      channelId: 'ch1',
      messageId: 'msg1',
      prize: 'Nitro',
      description: 'Free Nitro!',
      winnersCount: 2,
      durationMs: 3_600_000,
      hostId: 'host1',
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.giveawayId).toBeTruthy();
      expect(res.data.prize).toBe('Nitro');
      expect(res.data.active).toBe(true);
      expect(res.data.participants).toEqual([]);
      expect(res.data.endTime.getTime()).toBeGreaterThan(Date.now());
    }
  });

  it('fails for invalid duration', async () => {
    const res = await createGiveaway({
      guildId: GID,
      channelId: 'ch1',
      messageId: 'msg1',
      prize: 'Nitro',
      description: 'Desc',
      winnersCount: 1,
      durationMs: 0,
      hostId: 'host1',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_DURATION');
  });

  it('stores roleMultipliers', async () => {
    const ga = await seedGiveaway({ roleMultipliers: { r1: 3 } });
    const doc = await GiveawayModel.findOne({ giveawayId: ga.giveawayId }).lean();
    expect(doc).not.toBeNull();
  });
});

/* ── editGiveaway ─────────────────────────────────────────── */

describe('editGiveaway', () => {
  it('updates prize', async () => {
    const ga = await seedGiveaway();
    const res = await editGiveaway(ga.giveawayId, GID, { prize: 'Discord Nitro Classic' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.prize).toBe('Discord Nitro Classic');
  });

  it('fails if no changes', async () => {
    const ga = await seedGiveaway();
    const res = await editGiveaway(ga.giveawayId, GID, {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NO_CHANGES');
  });

  it('fails if not found', async () => {
    const res = await editGiveaway('nonexistent', GID, { prize: 'X' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── deleteGiveaway ───────────────────────────────────────── */

describe('deleteGiveaway', () => {
  it('deletes and returns channelId+messageId', async () => {
    const ga = await seedGiveaway();
    const res = await deleteGiveaway(ga.giveawayId, GID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.channelId).toBe('ch1');
      expect(res.data.messageId).toBe(ga.messageId);
    }

    const doc = await GiveawayModel.findOne({ giveawayId: ga.giveawayId });
    expect(doc).toBeNull();
  });

  it('fails if not found', async () => {
    const res = await deleteGiveaway('nope', GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── endGiveaway ──────────────────────────────────────────── */

describe('endGiveaway', () => {
  it('marks giveaway as inactive+finalized and picks winners', async () => {
    const ga = await seedGiveaway({ winnersCount: 1 });
    // add participants directly
    await GiveawayModel.updateOne(
      { giveawayId: ga.giveawayId },
      { $push: { participants: { $each: ['u1', 'u2', 'u3'] } } },
    );

    const res = await endGiveaway(ga.giveawayId, GID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.giveaway.active).toBe(false);
      expect(res.data.giveaway.finalized).toBe(true);
      expect(res.data.winnerIds).toHaveLength(1);
      expect(['u1', 'u2', 'u3']).toContain(res.data.winnerIds[0]);
    }
  });

  it('fails if already ended', async () => {
    const ga = await seedGiveaway();
    await endGiveaway(ga.giveawayId, GID);
    const res = await endGiveaway(ga.giveawayId, GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('ALREADY_ENDED');
  });

  it('fails if not found', async () => {
    const res = await endGiveaway('nope', GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });
});

/* ── joinGiveaway ─────────────────────────────────────────── */

describe('joinGiveaway', () => {
  it('adds user to participants', async () => {
    const ga = await seedGiveaway();
    const res = await joinGiveaway(ga.giveawayId, GID, 'u1', []);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.multiplier).toBe(1);
      expect(res.data.totalParticipants).toBe(1);
    }
  });

  it('applies role multiplier (adds multiple entries)', async () => {
    const ga = await seedGiveaway({ roleMultipliers: { booster: 3 } });
    const res = await joinGiveaway(ga.giveawayId, GID, 'u1', ['booster']);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.multiplier).toBe(3);
      expect(res.data.totalParticipants).toBe(3);
    }
  });

  it('applies global config multiplier', async () => {
    await GiveawayConfigModel.create({
      guildId: GID,
      enabled: true,
      roleMultipliers: [{ roleId: 'vip', multiplier: 2 }],
    });

    const ga = await seedGiveaway();
    const res = await joinGiveaway(ga.giveawayId, GID, 'u1', ['vip']);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.multiplier).toBe(2);
  });

  it('fails if already joined', async () => {
    const ga = await seedGiveaway();
    await joinGiveaway(ga.giveawayId, GID, 'u1', []);
    const res = await joinGiveaway(ga.giveawayId, GID, 'u1', []);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('ALREADY_JOINED');
  });

  it('fails if giveaway not active', async () => {
    const ga = await seedGiveaway();
    await endGiveaway(ga.giveawayId, GID);
    const res = await joinGiveaway(ga.giveawayId, GID, 'u1', []);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_ACTIVE');
  });
});

/* ── leaveGiveaway ────────────────────────────────────────── */

describe('leaveGiveaway', () => {
  it('removes all entries for user', async () => {
    const ga = await seedGiveaway({ roleMultipliers: { r1: 3 } });
    await joinGiveaway(ga.giveawayId, GID, 'u1', ['r1']); // adds 3 entries
    const res = await leaveGiveaway(ga.giveawayId, GID, 'u1');
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.totalParticipants).toBe(0);
  });

  it('fails if not joined', async () => {
    const ga = await seedGiveaway();
    const res = await leaveGiveaway(ga.giveawayId, GID, 'u1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_JOINED');
  });
});

/* ── rerollGiveaway ───────────────────────────────────────── */

describe('rerollGiveaway', () => {
  it('picks new winners from ended giveaway', async () => {
    const ga = await seedGiveaway({ winnersCount: 1 });
    await GiveawayModel.updateOne(
      { giveawayId: ga.giveawayId },
      { $push: { participants: { $each: ['u1', 'u2'] } } },
    );
    await endGiveaway(ga.giveawayId, GID);

    const res = await rerollGiveaway(ga.giveawayId, GID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.winnerIds).toHaveLength(1);
      expect(['u1', 'u2']).toContain(res.data.winnerIds[0]);
    }
  });

  it('fails if still active', async () => {
    const ga = await seedGiveaway();
    const res = await rerollGiveaway(ga.giveawayId, GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('STILL_ACTIVE');
  });

  it('fails if no participants', async () => {
    const ga = await seedGiveaway();
    await endGiveaway(ga.giveawayId, GID);
    const res = await rerollGiveaway(ga.giveawayId, GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NO_PARTICIPANTS');
  });
});

/* ── listActiveGiveaways ──────────────────────────────────── */

describe('listActiveGiveaways', () => {
  it('returns active giveaways sorted by endTime', async () => {
    await seedGiveaway({ durationMs: 100_000, prize: 'Late' });
    await seedGiveaway({ durationMs: 50_000, prize: 'Early' });

    const res = await listActiveGiveaways(GID);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      expect(res.data[0].prize).toBe('Early');
      expect(res.data[1].prize).toBe('Late');
    }
  });

  it('fails when none active', async () => {
    const res = await listActiveGiveaways(GID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NONE');
  });
});

/* ── finalizeExpiredGiveaways ─────────────────────────────── */

describe('finalizeExpiredGiveaways', () => {
  it('finalizes expired giveaways and returns winner IDs', async () => {
    // Create giveaway that's already expired
    await GiveawayModel.create({
      giveawayId: 'exp1',
      guildId: GID,
      channelId: 'ch1',
      messageId: 'msg1',
      prize: 'Expired Prize',
      description: 'Desc',
      winnersCount: 1,
      endTime: new Date(Date.now() - 10_000),
      hostId: 'host1',
      active: true,
      participants: ['u1', 'u2'],
      createdAt: new Date(),
      finalized: false,
    });

    const res = await finalizeExpiredGiveaways();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].giveawayId).toBe('exp1');
      expect(res.data[0].winnerIds.length).toBeGreaterThanOrEqual(1);
    }

    const doc = await GiveawayModel.findOne({ giveawayId: 'exp1' }).lean();
    expect(doc!.finalized).toBe(true);
    expect(doc!.active).toBe(false);
  });

  it('returns empty array if nothing expired', async () => {
    await seedGiveaway(); // future endTime
    const res = await finalizeExpiredGiveaways();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toHaveLength(0);
  });
});

/* ── getAdditionalNote ────────────────────────────────────── */

describe('getAdditionalNote', () => {
  it('returns empty string if no config', async () => {
    const note = await getAdditionalNote(GID);
    expect(note).toBe('');
  });

  it('returns note from config', async () => {
    await GiveawayConfigModel.create({
      guildId: GID,
      enabled: true,
      additionalNote: 'Powered by DyzioBOT',
    });

    const note = await getAdditionalNote(GID);
    expect(note).toBe('\n\nPowered by DyzioBOT');
  });
});
